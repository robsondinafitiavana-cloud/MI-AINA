import os
import json as _json
import tempfile

from django.conf import settings
from django.http import JsonResponse, FileResponse
from django.views.decorators.http import require_POST

from core.decorators import role_required
from .engine import transcribe_audio, classify, speak
from .models import TranscriptionLog
from .mlp_engine import predict_disease
from prevention.models import DiseasePrevention
from django.urls import reverse
from patients.models import Patient
from iot.models import Measure


@require_POST
@role_required('PREMIERE_LIGNE')
def transcribe(request):
    """Reçoit l'audio (WebM/Ogg du micro), renvoie la transcription faster-whisper."""
    f = request.FILES.get('audio')
    if not f:
        return JsonResponse({'ok': False, 'moteur': 'none',
                             'erreur': 'Aucun audio reçu.'}, status=400)
    langue = request.POST.get('langue') or None      # 'mg' ou 'fr'
    if langue == 'mg-MG':
        langue = 'mg'
    if langue == 'fr-FR':
        langue = 'fr'

    ext = os.path.splitext(f.name or 'a.webm')[1] or '.webm'
    path = os.path.join(tempfile.gettempdir(), f'miaina_stt_{os.getpid()}{ext}')
    with open(path, 'wb') as out:
        for chunk in f.chunks():
            out.write(chunk)

    try:
        texte, langue_det, ms = transcribe_audio(path, langue)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

    if texte is None:
        # faster-whisper indisponible -> le front garde Web Speech / manuel
        return JsonResponse({'ok': False, 'moteur': 'none',
                             'erreur': 'STT local indisponible — utilisez la voix navigateur ou le clavier.'})

    TranscriptionLog.objects.create(
        agent=request.user, moteur='whisper', langue=langue_det or '',
        duree_s=int(request.POST.get('duree') or 0), texte=texte,
        duree_traitement_ms=ms)

    return JsonResponse({'ok': True, 'moteur': 'whisper',
                         'texte': texte, 'langue': langue_det, 'ms': ms})


@require_POST
@role_required('PREMIERE_LIGNE')
def classify_view(request):
    """Transcription (+ constantes) -> JSON structuré. Ollama puis règles."""
    if request.body:
        try:
            data = _json.loads(request.body)
        except Exception:
            data = {}
    else:
        data = request.POST

    texte = data.get('texte') or ''
    vitals = data.get('vitals') or {}
    village = data.get('village') or ''

    d = classify(texte, vitals, village)
    return JsonResponse({'ok': True, 'prediction': d})


@require_POST
@role_required('PREMIERE_LIGNE')
def predict_disease_view(request):
    """Predict from a selected patient and manually recorded symptoms/vitals."""
    try:
        data = _json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'ok': False, 'status': 'invalid_request'}, status=400)
    patient = Patient.objects.filter(code_patient=data.get('patient'),
                                     agent_referent=request.user).first()
    if not patient:
        return JsonResponse({'ok': False, 'status': 'patient_unavailable'}, status=404)
    symptoms = data.get('symptoms')
    if not isinstance(symptoms, dict):
        symptoms = {}
    latest = Measure.objects.filter(patient=patient).first()
    temperature = data.get('temperature')
    clinical_data = {'age': patient.age, 'sex': patient.sexe, 'symptoms': symptoms,
        'temperature': temperature if temperature not in (None, '') else (latest.temperature if latest else None),
        'oxygen_saturation': latest.spo2 if latest else None,
        'heart_rate': latest.bpm if latest else None}
    result = predict_disease(clinical_data)
    if result.get('ok'):
        disease_names = [item.get('disease') for item in result.get('results', [])]
        prevention_slugs = dict(DiseasePrevention.objects.filter(
            name__in=disease_names).values_list('name', 'slug'))
        for item in result.get('results', []):
            slug = prevention_slugs.get(item.get('disease'))
            item['prevention_url'] = reverse('prevention:detail', args=[slug]) if slug else ''
    return JsonResponse(result)


@require_POST
def speak_view(request):
    """Texte -> MP3 edge-tts. Accessible aux agents authentifiés."""
    if not request.user.is_authenticated:
        return JsonResponse({'ok': False}, status=403)
    if request.body:
        try:
            data = _json.loads(request.body)
        except Exception:
            data = {}
    else:
        data = request.POST
    texte = (data.get('texte') or '').strip()
    langue = data.get('langue') or 'fr'
    if not texte:
        return JsonResponse({'ok': False}, status=400)

    path = speak(texte, langue)
    if not path or not os.path.exists(path):
        return JsonResponse({'ok': False,
                             'erreur': 'TTS indisponible (pip install edge-tts).'}, status=503)
    resp = FileResponse(open(path, 'rb'), content_type='audio/mpeg')
    resp['Cache-Control'] = 'no-store'
    return resp
