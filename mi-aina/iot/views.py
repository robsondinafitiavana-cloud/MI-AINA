import json
import uuid
from decimal import Decimal, InvalidOperation

from django.contrib.auth.hashers import check_password
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from consultations.models import Consultation
from .models import Device, Measure
from core.decorators import role_required


MAX_REQUEST_BYTES = 64 * 1024
MAX_ECG_ADC = 4095  # Le prototype courant configure l'ADC ESP32 sur 12 bits.
TERMINAL_CONSULTATION_STATES = {'VALIDEE', 'ORIENTEE', 'TERMINEE'}


def _error(message, status):
    return JsonResponse({'ok': False, 'erreur': message}, status=status)


def _device_token(request):
    auth = request.headers.get('Authorization', '')
    scheme, _, value = auth.partition(' ')
    if scheme.lower() == 'bearer' and value.strip():
        return value.strip()
    return ''


def _parse_temperature(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError('Température invalide.')
    try:
        temperature = Decimal(str(value).replace(',', '.'))
    except (InvalidOperation, ValueError):
        raise ValueError('Température invalide.')
    if not temperature.is_finite() or not Decimal('25') <= temperature <= Decimal('45'):
        raise ValueError('Température hors plage (25 à 45 °C).')
    return temperature.quantize(Decimal('0.1'))


def _parse_ecg(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_ECG_ADC:
        raise ValueError('Échantillon ECG invalide (valeur ADC attendue entre 0 et 4095).')
    return value


def _parse_timestamp(value):
    if not value:
        return timezone.now()
    if not isinstance(value, str):
        raise ValueError('timestamp doit être une date ISO-8601.')
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValueError('timestamp doit être une date ISO-8601.')
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _device_can_use_consultation(device, consultation):
    agent = consultation.premiere_ligne
    if not agent or not agent.is_active or agent.statut != 'ACTIF':
        return False
    if device.assigne_a_id:
        allowed = device.assigne_a_id == agent.pk
    else:
        allowed = bool(device.csb_id and device.csb_id == agent.csb_id)
    patient_agent_id = consultation.patient.agent_referent_id
    return allowed and (not patient_agent_id or patient_agent_id == agent.pk)


@csrf_exempt
@require_POST
def receive_measurement(request):
    """Reçoit un relevé ESP32 authentifié et relié à une consultation existante."""
    if len(request.body) > MAX_REQUEST_BYTES:
        return _error('Requête trop volumineuse.', 413)
    if request.content_type != 'application/json':
        return _error('Content-Type application/json requis.', 415)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return _error('JSON invalide.', 400)
    if not isinstance(data, dict):
        return _error('Un objet JSON est attendu.', 400)

    device_code = str(data.get('device_id') or '').strip()
    token = _device_token(request)
    if not device_code or not token:
        return _error('Identifiant et authentification du boîtier requis.', 401)
    device = Device.objects.filter(code=device_code).select_related('assigne_a', 'csb').first()
    if not device:
        return _error('Boîtier inconnu.', 404)
    if not device.actif:
        return _error('Boîtier désactivé.', 403)
    if not device.token_hash or not check_password(token, device.token_hash):
        return _error('Authentification du boîtier invalide.', 401)

    consultation_id = str(data.get('consultation_id') or '').strip()
    if not consultation_id:
        return _error('consultation_id est requis.', 400)
    consultation = Consultation.objects.filter(pk=consultation_id).select_related(
        'patient', 'premiere_ligne', 'premiere_ligne__csb'
    ).first()
    if not consultation:
        return _error('Consultation introuvable.', 404)
    if consultation.statut in TERMINAL_CONSULTATION_STATES:
        return _error('Cette consultation est terminée.', 409)
    if not _device_can_use_consultation(device, consultation):
        return _error('Boîtier non autorisé pour cette consultation ou ce patient.', 403)

    try:
        temperature = _parse_temperature(data.get('temperature'))
        ecg_raw = _parse_ecg(data.get('ecg_raw', data.get('ecg')))
        captured_at = _parse_timestamp(data.get('timestamp'))
    except ValueError as exc:
        return _error(str(exc), 400)
    if temperature is None and ecg_raw is None:
        return _error('Au moins une mesure de température ou un échantillon ECG est requis.', 400)

    electrodes_connected = data.get('electrodes_connected')
    if electrodes_connected is not None and not isinstance(electrodes_connected, bool):
        return _error('electrodes_connected doit être un booléen.', 400)

    try:
        event_id = uuid.UUID(str(data.get('event_id') or ''))
    except (ValueError, TypeError, AttributeError):
        return _error('event_id UUID requis pour permettre les renvois sans doublons.', 400)

    with transaction.atomic():
        try:
            measure, created = Measure.objects.get_or_create(
                device=device,
                event_id=event_id,
                defaults={
                    'patient': consultation.patient,
                    'consultation': consultation,
                    'temperature': temperature,
                    'ecg_brut': ecg_raw,
                    'electrodes_connectees': electrodes_connected,
                    'captured_at': captured_at,
                    'synchronise': True,
                },
            )
        except IntegrityError:
            return _error('Événement déjà reçu; réessayez avec le même event_id.', 409)

        if not created:
            same_payload = (
                measure.consultation_id == consultation.pk and
                measure.temperature == temperature and
                measure.ecg_brut == ecg_raw and
                measure.electrodes_connectees == electrodes_connected
            )
            if not same_payload:
                return _error('event_id déjà utilisé avec des données différentes.', 409)

        device.statut = 'CONNECTÉ'
        device.derniere_communication = timezone.now()
        device.save(update_fields=['statut', 'derniere_communication'])

    return JsonResponse({
        'ok': True,
        'measure_id': measure.pk,
        'duplicate': not created,
        'device_id': device.code,
        'consultation_id': consultation.pk,
        'patient_code': consultation.patient.code_patient,
        'source': measure.source,
        'temperature': str(measure.temperature) if measure.temperature is not None else None,
        'ecg_received': measure.ecg_brut is not None,
        'ecg_raw': measure.ecg_brut,
        'heart_rate_bpm': None,
        'heart_rate_status': 'non calculée',
        'captured_at': measure.captured_at.isoformat() if measure.captured_at else None,
        'received_at': measure.created_at.isoformat(),
    }, status=200 if not created else 201)


@login_required
@require_POST
@role_required('PREMIERE_LIGNE')
def receive_simulation(request):
    """Enregistre un relevé de démonstration dans une voie distincte et étiquetée."""
    if not getattr(settings, 'IOT_SIMULATION_ENABLED', True):
        return _error('Le mode de démonstration IoT est désactivé.', 404)
    if len(request.body) > MAX_REQUEST_BYTES:
        return _error('Requête trop volumineuse.', 413)
    if request.content_type != 'application/json':
        return _error('Content-Type application/json requis.', 415)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return _error('JSON invalide.', 400)
    if not isinstance(data, dict):
        return _error('Un objet JSON est attendu.', 400)

    consultation = Consultation.objects.filter(pk=data.get('consultation_id')).select_related(
        'patient', 'premiere_ligne', 'premiere_ligne__csb'
    ).first()
    if not consultation:
        return _error('Consultation introuvable.', 404)
    if consultation.premiere_ligne_id != request.user.pk or consultation.patient.agent_referent_id != request.user.pk:
        return _error('Consultation non autorisée pour cet agent.', 403)
    if consultation.statut in TERMINAL_CONSULTATION_STATES:
        return _error('Cette consultation est terminée.', 409)

    try:
        temperature = _parse_temperature(data.get('temperature'))
        if temperature is not None and not Decimal('36.3') <= temperature <= Decimal('37.2'):
            raise ValueError('Température de démonstration attendue entre 36,3 et 37,2 °C.')
        bpm = data.get('bpm')
        if isinstance(bpm, bool) or not isinstance(bpm, int) or not 60 <= bpm <= 90:
            raise ValueError('BPM simulé attendu entre 60 et 90.')
        if data.get('ecg_samples') is not None:
            raise ValueError('Le mode démonstration actuel ne transmet pas de signal ECG.')
        samples = []
        event_id = uuid.UUID(str(data.get('event_id') or ''))
        captured_at = _parse_timestamp(data.get('timestamp'))
    except (ValueError, TypeError, AttributeError) as exc:
        return _error(str(exc) or 'Données de simulation invalides.', 400)
    if temperature is None:
        return _error('La température est requise pour ce relevé simulé.', 400)

    device_code = f'MI-AINA-SIM-{request.user.pk}'
    with transaction.atomic():
        device, _ = Device.objects.get_or_create(
            code=device_code,
            defaults={
                'nom': 'Boîtier virtuel · démonstration', 'actif': True,
                'is_simulated': True, 'csb_id': request.user.csb_id,
                'assigne_a': request.user, 'statut': 'HORS LIGNE',
            },
        )
        if not device.is_simulated or device.assigne_a_id != request.user.pk:
            return _error('Identifiant du boîtier de démonstration déjà utilisé.', 409)
        measure, created = Measure.objects.get_or_create(
            device=device, event_id=event_id,
            defaults={
                'patient': consultation.patient, 'consultation': consultation,
                'temperature': temperature, 'bpm': bpm,
                'ecg_brut': samples[-1] if samples else None,
                'ecg_signal': samples or None,
                'electrodes_connectees': True, 'source': 'SIMULATION',
                'captured_at': captured_at, 'synchronise': True,
            },
        )
        if not created:
            if (measure.source != 'SIMULATION' or measure.consultation_id != consultation.pk or
                    measure.temperature != temperature or measure.bpm != bpm or measure.ecg_signal != (samples or None)):
                return _error('event_id déjà utilisé avec des données différentes.', 409)

    return JsonResponse({
        'ok': True, 'source': 'SIMULATION', 'measure_id': measure.pk,
        'duplicate': not created, 'device_id': device.code,
        'consultation_id': consultation.pk, 'temperature': str(measure.temperature),
        'heart_rate_bpm': measure.bpm, 'ecg_samples': len(samples),
        'captured_at': measure.captured_at.isoformat() if measure.captured_at else None,
    }, status=200 if not created else 201)
