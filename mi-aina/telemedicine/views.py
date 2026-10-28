import json as _json
from django.http import JsonResponse
from django.db.models import Q
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.decorators import role_required
from accounts.models import Compte
from consultations.models import Consultation
from consultations.routing import same_care_site
from notifications.models import Notif
from .models import CallSession


def _body(request):
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def doctors(request):
    """Annuaire cherchable : médecins ACTIF, filtrés par nom, CSB, région ou district."""
    q = (request.GET.get('q') or '').strip().lower()
    name = (request.GET.get('name') or '').strip().lower()
    region_filter = (request.GET.get('region') or '').strip().lower()
    district_filter = (request.GET.get('district') or '').strip().lower()
    facility_filter = (request.GET.get('facility') or '').strip().lower()
    qs = Compte.objects.filter(role='MEDECIN', statut='ACTIF').select_related('csb')
    busy_ids = set(CallSession.objects.filter(medecin__in=qs, ended_at__isnull=True)
                   .values_list('medecin_id', flat=True))
    items = []
    for m in qs:
        csb = m.csb.nom if m.csb else ''
        region = m.region or (m.csb.region if m.csb else '') or 'National'
        district = m.district or (m.csb.district if m.csb else '')
        hay = f'{m.prenom} {m.nom} {csb} {region} {district} {m.etablissement or ""}'.lower()
        if q and q not in hay:
            continue
        if name and name not in f'{m.prenom} {m.nom}'.lower():
            continue
        if region_filter and region_filter not in region.lower():
            continue
        if district_filter and district_filter not in district.lower():
            continue
        if facility_filter and facility_filter not in f'{csb} {m.etablissement or ""}'.lower():
            continue
        agent_site = (request.user.etablissement or '').strip().lower()
        doctor_site = (m.etablissement or '').strip().lower()
        local = bool(request.user.role == 'PREMIERE_LIGNE' and (
            (request.user.csb_id and request.user.csb_id == m.csb_id) or
            (agent_site and doctor_site and agent_site == doctor_site)
        ))
        items.append({
            'id': str(m.id),
            'nom': f'Dr {m.prenom} {m.nom}',
            'initiales': (m.prenom[:1] + m.nom[:1]).upper(),
            'photo': m.photo.url if m.photo else '',
            'etablissement': m.etablissement or csb or 'Télé-expertise',
            'csb': csb,
            'region': region,
            'district': district or 'National',
            'online': False,
            'local': local,
            'dispo': 'Déjà en appel' if m.id in busy_ids else ('De garde' if m.direction else 'Aucun appel en cours'),
        })
    u = request.user
    if u.role == 'PREMIERE_LIGNE':
        items.sort(key=lambda x: (not x['local'], x['nom']))
    return JsonResponse({'ok': True, 'items': items[:20]})


@require_POST
@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def start_call(request):
    """Un appel est possible depuis le terrain ou par un médecin de même secteur."""
    data = _body(request)
    if request.user.role == 'PREMIERE_LIGNE':
        agent = request.user
        med = Compte.objects.filter(pk=data.get('medecin_id'),
            role='MEDECIN', statut='ACTIF').first()
        if not med:
            return JsonResponse({'ok': False, 'erreur': 'Médecin introuvable ou indisponible.'}, status=404)
    else:
        med = request.user
        agent = Compte.objects.filter(pk=data.get('agent_id'),
            role='PREMIERE_LIGNE', statut='ACTIF').select_related('csb').first()
        if not agent:
            return JsonResponse({'ok': False, 'erreur': 'Agent introuvable ou indisponible.'}, status=404)
        if not same_care_site(agent, med):
            return JsonResponse({'ok': False,
                'erreur': 'Pour appeler un agent, vous devez partager son CSB ou établissement.'}, status=403)
    if CallSession.objects.filter(Q(agent=agent) | Q(medecin=med), ended_at__isnull=True).exists():
        return JsonResponse({'ok': False, 'erreur': 'Un des participants est déjà en visioconsultation.'}, status=409)
    consultation = None
    consultation_id = data.get('consultation_id')
    if consultation_id:
        scope = {'premiere_ligne': agent}
        if request.user.role == 'MEDECIN':
            scope['medecin'] = med
        consultation = Consultation.objects.filter(pk=consultation_id, **scope).select_related(
            'patient', 'patient__csb'
        ).first()
        if not consultation:
            return JsonResponse({'ok': False,
                'erreur': 'Consultation introuvable ou non rattachée à cet échange.'}, status=404)
    session = CallSession.objects.create(agent=agent, medecin=med,
        consultation=consultation, mode_eco=bool(data.get('eco', True)))
    contexte = ''
    if consultation:
        contexte = ' Consultation de ' + str(consultation.patient)
        if consultation.patient.csb:
            contexte += ' — ' + consultation.patient.csb.nom
    destinataire = med if request.user.role == 'PREMIERE_LIGNE' else agent
    Notif.objects.create(destinataire=destinataire, icone='video',
                         titre='Appel entrant — ' + str(request.user),
                         texte=('Demande de visioconsultation.' + contexte)[:200],
                         goto_view='visio')
    peer = agent if request.user.role == 'MEDECIN' else med
    peer_nom = f'{peer.prenom} {peer.nom}' if peer.role == 'PREMIERE_LIGNE' else f'Dr {peer.prenom} {peer.nom}'
    return JsonResponse({'ok': True, 'call': str(session.id),
                         'medecin': f'Dr {med.prenom} {med.nom}',
                         'initiales': (med.prenom[:1] + med.nom[:1]).upper(),
                         'role': med.etablissement or 'Télé-expertise',
                         'peer': peer_nom,
                         'peer_initiales': (peer.prenom[:1] + peer.nom[:1]).upper(),
                         'peer_role': peer.get_role_display(),
                         'patient': str(consultation.patient) if consultation else ''})


@require_POST
@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def end_call(request, pk):
    data = _body(request)
    s = CallSession.objects.filter(pk=pk).filter(
        Q(agent=request.user) | Q(medecin=request.user)
    ).first()
    if s:
        s.ended_at = timezone.now()
        s.resume = (str(data.get('resume') or '').strip()[:10000]
                    or s.resume or 'Téléconsultation effectuée — aucun résumé saisi.')
        s.save(update_fields=['ended_at', 'resume'])
    return JsonResponse({'ok': True})
