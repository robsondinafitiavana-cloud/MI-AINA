import json as _json
import unicodedata
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.db import transaction
from django.shortcuts import redirect
from django.views.decorators.http import require_POST

from core.decorators import role_required
from .models import Consultation, Ordonnance
from iot.models import Device, Measure
from patients.models import Patient
from messaging.models import Thread
from alerts.models import Alerte
from notifications.models import Notif
from accounts.models import Compte
from .routing import local_doctors_for, same_care_site
from telemedicine.models import CallSession


_EPIDEMIC_DISEASES = ('Paludisme', 'Dengue', 'Rougeole', 'Diarrhée aqueuse', 'Grippe', 'Peste')


def _epidemic_type_from_prediction(prediction):
    disease = prediction.get('maladie') if isinstance(prediction, dict) else ''
    normalized = ''.join(ch for ch in unicodedata.normalize('NFKD', str(disease)).lower()
                         if not unicodedata.combining(ch))
    return next((name for name in _EPIDEMIC_DISEASES
                 if ''.join(ch for ch in unicodedata.normalize('NFKD', name).lower()
                            if not unicodedata.combining(ch)) in normalized), '')


def _body(request):
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


def _consultation_for_doctor(user, pk):
    return Consultation.objects.filter(pk=pk, medecin=user).select_related(
        'patient', 'premiere_ligne', 'medecin').first()


@require_POST
@role_required('PREMIERE_LIGNE')
def consult_save(request):
    data = _body(request)
    a = request.user
    ref = str(data.get('patient') or '').strip()
    patient = Patient.objects.filter(code_patient=ref).first() if ref else None
    if not patient and ref:
        try:  # l'interface peut envoyer le code PAT-XXXXXX ou l'identifiant interne
            patient = Patient.objects.filter(pk=ref).first()
        except Exception:
            patient = None
    if not patient and ref:
        patient = Patient.objects.filter(code_patient=ref.upper()).first()
    if not patient:
        return JsonResponse({'ok': False, 'erreur': 'Patient introuvable.'}, status=404)
    if patient.agent_referent_id != a.id:
        return JsonResponse({'ok': False,
            'erreur': 'Ce patient ne fait pas partie de votre secteur de suivi.'}, status=403)

    prediction = data.get('prediction') or {}
    auto_epidemic_type = _epidemic_type_from_prediction(prediction)
    epidemic_suspect = bool(data.get('epidemic_suspect')) or bool(auto_epidemic_type)
    # Toute suspicion épidémique rejoint automatiquement la file médicale.
    escal = bool(data.get('demande_avis')) or epidemic_suspect
    severite = data.get('severite') or 'MODÉRÉ'
    motif = (data.get('motif') or 'Consultation de suivi').strip()
    temperature = None
    raw_temperature = data.get('temperature')
    if raw_temperature not in (None, ''):
        try:
            temperature = Decimal(str(raw_temperature).replace(',', '.'))
        except (InvalidOperation, ValueError):
            return JsonResponse({'ok': False, 'erreur': 'Température invalide.'}, status=400)
        if not Decimal('25') <= temperature <= Decimal('45'):
            return JsonResponse({'ok': False,
                'erreur': 'Vérifiez la température saisie (plage attendue : 25 à 45 °C).'}, status=400)

    medecin_prefere = None
    local_doctors = local_doctors_for(a) if escal else Compte.objects.none()
    routed_reason = ''
    if escal:
        preferred_id = str(data.get('medecin_prefere') or '').strip()
        if preferred_id:
            medecin_prefere = local_doctors.filter(pk=preferred_id).first()
            if not medecin_prefere:
                return JsonResponse({'ok': False,
                    'erreur': 'Le médecin choisi n’est pas rattaché à votre structure.'}, status=403)
        routed_reason = 'File partagée de la structure'

    c = Consultation.objects.create(
        patient=patient, premiere_ligne=a,
        medecin=None,
        medecin_prefere=medecin_prefere,
        motif=motif, symptomes=data.get('symptomes') or '',
        duree=data.get('duree') or '', exams_suggeres=data.get('exams') or '',
        severite=severite,
        statut='EN_ATTENTE' if escal else 'EN_COURS',
        ia_diagnostic=prediction.get('maladie', ''),
        ia_confiance=prediction.get('confiance') or None,
        ia_transcription=data.get('symptomes') or '',
        ia_engine=data.get('ia_engine') or 'manuel',
        agent_modified=bool(data.get('agent_modified')),
        epidemic_suspect=epidemic_suspect,
        epidemic_type=auto_epidemic_type or data.get('epidemic_type') or '',
        routed_reason=routed_reason,
    )

    measurement_saved = False
    if temperature is not None:
        dev = Device.objects.filter(assigne_a=a).first()
        if not dev and a.csb_id:
            dev = Device.objects.filter(csb_id=a.csb_id).first()
        if dev:
            Measure.objects.create(device=dev, patient=patient, consultation=c,
                                   temperature=temperature, synchronise=True)
            measurement_saved = True

    if escal and local_doctors.exists():
        for doctor in local_doctors:
            preference = ' — médecin préféré : ' + str(medecin_prefere) if medecin_prefere else ''
            Notif.objects.create(destinataire=doctor, icone='inbox',
                titre='Nouvel avis dans la file de votre structure',
                texte=motif[:70] + ' · sévérité ' + severite + preference,
                goto_view='triage')
    elif escal:
        Notif.objects.create(destinataire=a, icone='clock-3',
            titre='Avis en attente — ' + str(patient),
            texte='Aucun médecin actif n’est rattaché à votre CSB ou établissement. Vous pouvez demander une visio via la recherche.',
            goto_view='consults')
        for pilotage in Compte.objects.filter(role='PILOTAGE', statut='ACTIF'):
            Notif.objects.create(destinataire=pilotage, icone='inbox',
                titre='Avis local sans médecin — ' + patient.code_patient,
                texte=(a.csb.nom if a.csb else a.etablissement or 'Secteur non renseigné')[:100],
                goto_view='overview')

    if c.epidemic_suspect:
        Alerte.objects.create(niveau='crit', tag='TRANSMISSION',
            titre='Suspicion ' + (c.epidemic_type or 'épidémique') + ' — ' + patient.code_patient,
            description=motif + ' · CSB ' + (a.csb.nom if a.csb else '—') +
                        ' · agent ' + str(a) + '. Suspicion à confirmer par un professionnel de santé.')
        for p in Compte.objects.filter(role='PILOTAGE', statut='ACTIF'):
            Notif.objects.create(destinataire=p, icone='siren',
                titre='Alerte épidémique — ' + (c.epidemic_type or 'suspect'),
                texte=patient.code_patient + ' · ' + (a.csb.nom if a.csb else '') + ' · agent ' + str(a),
                goto_view='alerts')

    return JsonResponse({'ok': True, 'id': c.id,
        'routed': {'medecin': str(medecin_prefere) if medecin_prefere else
                              ('file partagée de la structure' if escal and local_doctors.exists() else ''),
                   'medecin_id': '',
                   'etablissement': a.csb.nom if a.csb else a.etablissement,
                   'reason': routed_reason},
        'prediction': prediction,
        'measurement_saved': measurement_saved,
        'epidemic': bool(c.epidemic_suspect)})


@require_POST
@role_required('MEDECIN')
def prendre(request, pk):
    with transaction.atomic():
        c = Consultation.objects.select_for_update().filter(
            pk=pk, statut='EN_ATTENTE'
        ).select_related('premiere_ligne__csb', 'medecin', 'patient').first()
        if not c:
            return JsonResponse({'ok': False, 'erreur': 'Cas introuvable.'}, status=404)
        if c.medecin_id and c.medecin_id != request.user.id:
            return JsonResponse({'ok': False, 'erreur': 'Ce cas est déjà attribué à un autre médecin.'}, status=409)
        explicit_visio = CallSession.objects.filter(
            consultation=c, medecin=request.user, ended_at__isnull=True
        ).exists()
        same_patient_site = bool(c.patient.csb_id and c.patient.csb_id == request.user.csb_id)
        if (not c.medecin_id and not explicit_visio and not same_patient_site and
                not same_care_site(c.premiere_ligne, request.user)):
            return JsonResponse({'ok': False,
                'erreur': 'Ce cas est réservé au médecin du même CSB ou établissement.'}, status=403)
        c.medecin = request.user
        c.statut = 'EN_COURS'
        c.save(update_fields=['medecin', 'statut'])
        if c.premiere_ligne_id:
            Thread.objects.get_or_create(agent=c.premiere_ligne, medecin=request.user)
            Notif.objects.create(destinataire=c.premiere_ligne, icone='stethoscope',
                titre='Un médecin prend en charge votre avis',
                texte='Le cas a été attribué au médecin de votre structure.', goto_view='consults')
    return JsonResponse({'ok': True})


@require_POST
@role_required('MEDECIN')
def valider_ia(request, pk):
    c = _consultation_for_doctor(request.user, pk)
    if not c:
        return JsonResponse({'ok': False}, status=404)
    c.ia_validee = True
    c.save(update_fields=['ia_validee'])
    return JsonResponse({'ok': True})


@require_POST
@role_required('MEDECIN')
def ordonnance(request, pk):
    c = _consultation_for_doctor(request.user, pk)
    if not c:
        return JsonResponse({'ok': False, 'erreur': 'Consultation introuvable.'}, status=404)
    data = _body(request)
    contenu = (data.get('contenu') or '').strip()
    if not contenu:
        return JsonResponse({'ok': False, 'erreur': 'Prescription vide.'}, status=400)
    rdv = (data.get('rdv') or '').strip()
    Ordonnance.objects.update_or_create(consultation=c,
        defaults={'contenu': contenu, 'suivi': data.get('suivi') or '',
                  'rdv_date': rdv or None,
                  'signee_par': request.user})
    c.statut = 'VALIDEE'
    c.save(update_fields=['statut'])
    # Retour au terrain : l'agent qui a escalade le cas est notifie.
    if c.premiere_ligne:
        Notif.objects.create(destinataire=c.premiere_ligne, icone='file-signature',
            titre='Ordonnance recue — ' + str(c.patient),
            texte=contenu[:100], goto_view='consults')
    return JsonResponse({'ok': True, 'statut': c.statut})


@require_POST
@role_required('MEDECIN')
def orienter(request, pk):
    c = _consultation_for_doctor(request.user, pk)
    if not c:
        return JsonResponse({'ok': False}, status=404)
    data = _body(request)
    c.statut = 'ORIENTEE'
    c.orientee_vers = data.get('dest') or 'CSB'
    c.orientee_struct = data.get('structure') or ''
    c.orientee_note = data.get('note') or ''
    c.save()
    if c.premiere_ligne:
        Notif.objects.create(destinataire=c.premiere_ligne, icone='send',
            titre='Orientation — ' + str(c.patient),
            texte=(str(c.orientee_vers) + ' · ' + (c.orientee_struct or ''))[:100],
            goto_view='consults')
    return JsonResponse({'ok': True, 'dest': c.orientee_vers})


@require_POST
@role_required('PREMIERE_LIGNE')
def remise(request, pk):
    o = Ordonnance.objects.filter(consultation__pk=pk,
                                  consultation__premiere_ligne=request.user).first()
    if not o:
        return JsonResponse({'ok': False}, status=404)
    o.remise = True
    o.save(update_fields=['remise'])
    return JsonResponse({'ok': True})


@require_POST
@role_required(['MEDECIN'])
def retour(request, pk):
    """Le medecin renvoie le dossier au terrain : fin de la tele-expertise."""
    c = _consultation_for_doctor(request.user, pk)
    if not c:
        return JsonResponse({'ok': False, 'erreur': 'Consultation introuvable.'}, status=404)
    data = _body(request)
    c.statut = 'TERMINEE'
    note = (data.get('note') or '').strip()
    if note:
        c.observation = ((c.observation + '\n') if c.observation else '') + note
    c.save()
    if c.premiere_ligne:
        Notif.objects.create(destinataire=c.premiere_ligne, icone='undo-2',
            titre='Dossier renvoye — ' + str(c.patient),
            texte=(note or 'Le medecin a termine la tele-expertise.')[:100],
            goto_view='consults')
    return JsonResponse({'ok': True, 'statut': c.statut})


@require_POST
@role_required(['PREMIERE_LIGNE'])
def remise_page(request, pk):
    """Version Django (formulaire) de l'accuse de remise — redirige vers le tableau de bord."""
    o = Ordonnance.objects.filter(consultation__pk=pk,
                                  consultation__premiere_ligne=request.user).first()
    if o:
        o.remise = True
        o.save(update_fields=['remise'])
        if o.consultation.medecin:
            Notif.objects.create(destinataire=o.consultation.medecin, icone='check',
                titre='Ordonnance remise — ' + str(o.consultation.patient),
                texte='L\u2019agent confirme la remise au patient.', goto_view='consults')
    return redirect('/premiere-ligne/')
