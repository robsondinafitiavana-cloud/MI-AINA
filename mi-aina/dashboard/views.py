from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.utils import timezone
from django.conf import settings
from django.http import JsonResponse
from django.db.models import Q, Case, When, IntegerField, Prefetch
from pathlib import Path
import random
from core.decorators import role_required
from accounts.models import Compte
from accounts.forms import ProfilePhotoForm
from csb.models import CSB
from patients.models import Patient
from consultations.models import Consultation
from consultations.routing import local_unassigned_cases, local_doctors_for
from iot.models import Device, Measure
from reports.models import Signalement
from alerts.models import Alerte
from messaging.models import Thread
from notifications.models import Notif
from publications.models import Publication, PublicationLu
from formation.models import ForumPost, ForumReply
from messaging.models import Fil, MessageFil
from messaging.fils import _ser_fil
from telemedicine.models import CallSession
import json as _json
from django.views.decorators.http import require_POST

AI_SYMPTOM_CATALOG = _json.loads(
    (Path(settings.BASE_DIR) / 'ai' / 'clinical_features.json').read_text(encoding='utf-8')
)['symptoms']
# Coordonnées réelles (lat, lng) des districts — héritées par leurs CSB
DISTRICT_COORDS = {
    'Antsiranana I': (-12.28, 49.30), 'Antsiranana II': (-12.35, 49.35), 'Ambilobe': (-13.20, 49.05),
    'Ambanja': (-13.68, 48.45), 'Nosy Be': (-13.32, 48.26),
    'Sambava': (-14.27, 50.17), 'Andapa': (-14.65, 49.65), 'Vohemar': (-13.37, 50.00), 'Antalaha': (-14.90, 50.28),
    'Mahajanga I': (-15.72, 46.32), 'Mahajanga II': (-15.80, 46.35), 'Marovoay': (-16.10, 46.65),
    'Ambato-Boeni': (-16.42, 46.52),
    'Antsohihy': (-15.32, 47.98), 'Bealanana': (-15.75, 48.22), 'Mandritsara': (-15.95, 48.80),
    'Analalava': (-15.17, 47.77),
    'Maevatanana': (-16.95, 47.15), 'Tsaratanana': (-16.78, 47.65),
    'Maintirano': (-18.06, 44.03), 'Morafenobe': (-17.95, 44.85),
    'Ambatondrazaka': (-17.83, 48.42), 'Moramanga': (-18.91, 48.22), 'Andilamena': (-17.55, 48.75),
    'Fenoarivo-Atsinanana': (-17.38, 49.41), 'Soanierana-Ivongo': (-16.95, 49.50), 'Maroantsetra': (-15.43, 49.74),
    'Toamasina I': (-18.15, 49.40), 'Toamasina II': (-18.15, 49.45), 'Vatomandry': (-19.28, 48.99),
    'Brickaville': (-18.82, 49.05),
    'Miarinarivo': (-18.62, 46.81), 'Arivonimamo': (-18.99, 47.05), 'Soavinandriana': (-19.18, 46.77),
    'Antananarivo Renivohitra': (-18.91, 47.52), 'Antananarivo Atsimondrano': (-18.98, 47.50),
    'Ambohidratrimo': (-18.80, 47.48), 'Manjakandriana': (-18.92, 47.83), 'Anjozorobe': (-18.38, 47.87),
    'Tsiroanomandidy': (-18.78, 46.05), 'Fenoarivobe': (-19.35, 46.83),
    'Antsirabe I': (-19.87, 47.03), 'Antsirabe II': (-19.80, 47.05), 'Betafo': (-19.83, 46.85),
    'Ambatolampy': (-19.38, 47.42),
    'Morondava': (-20.28, 44.28), 'Belo-sur-Tsiribihina': (-19.70, 44.55), 'Mahabo': (-20.40, 44.73),
    'Ambositra': (-20.48, 47.25), 'Fandriana': (-20.38, 47.62), 'Ambatofinandrahana': (-20.55, 47.35),
    'Mananjary': (-21.23, 48.34), 'Nosy Varika': (-21.02, 48.62), 'Ikongo': (-21.55, 47.85),
    'Ifanadiana': (-21.48, 47.63),
    'Fianarantsoa I': (-21.45, 47.10), 'Ambalavao': (-21.83, 47.02), 'Ikalamavony': (-21.58, 46.85),
    'Manakara': (-22.15, 48.02), 'Vohipeno': (-22.17, 47.85),
    'Ihosy': (-22.40, 46.12), 'Iakora': (-23.00, 46.53), 'Ivohibe': (-22.48, 46.87),
    'Farafangana': (-22.80, 47.83), 'Vangaindrano': (-23.35, 47.72),
    'Toliara I': (-23.35, 43.67), 'Toliara II': (-23.35, 43.72), 'Sakaraha': (-22.87, 44.52),
    'Morombe': (-21.73, 43.37), 'Ampanihy': (-24.69, 44.75),
    'Taolagnaro': (-25.03, 46.99), 'Betroka': (-23.28, 45.63), 'Amboasary-Sud': (-25.02, 46.53),
    'Ambovombe': (-25.18, 46.08), 'Tsihombe': (-25.29, 45.97), 'Bekily': (-24.22, 46.13),
}
# Centres régionaux de repli : un foyer reste visible sur la carte même si
# son district n'est pas renseigné ou n'a pas encore de coordonnées précises.
REGION_COORDS = {
    'Diana': (-13.2, 49.5), 'Sava': (-14.1, 50.2), 'Boeny': (-16.1, 46.6),
    'Sofia': (-14.9, 48.1), 'Betsiboka': (-16.5, 47.0), 'Melaky': (-18.1, 44.3),
    'Alaotra-Mangoro': (-17.9, 48.5), 'Analanjirofo': (-16.7, 49.8),
    'Atsinanana': (-18.2, 49.4), 'Itasy': (-19.0, 46.8), 'Analamanga': (-18.9, 47.5),
    'Bongolava': (-18.6, 46.4), 'Vakinankaratra': (-19.8, 47.0), 'Menabe': (-20.3, 44.3),
    'Amoron’i Mania': (-20.5, 47.2),
    'Vatovavy': (-21.2, 48.3), 'Haute Matsiatra': (-21.5, 47.1), 'Fitovinany': (-22.0, 47.9),
    'Ihorombe': (-22.4, 46.1), 'Atsimo-Atsinanana': (-23.0, 47.8),
    'Atsimo-Andrefana': (-23.4, 43.7), 'Anosy': (-25.0, 47.0), 'Androy': (-25.2, 46.1),
}
MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
           'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']


def _fmt_date(dt):
    """'5 juin' — portable Windows/Linux (strftime %-d ne marche pas sous Windows)."""
    if not dt:
        return '—'
    return f'{dt.day} {MOIS_FR[dt.month - 1]}'


def _ser_pending(x):
    return {
        'id': str(x.id), 'nom': x.nom, 'prenom': x.prenom, 'role': x.role,
        'ident': x.identifiant_court,
        'struct': x.csb.nom if x.csb else (x.etablissement or x.direction or '—'),
        'region': x.csb.region if x.csb else '—',
        'date': _fmt_date(x.cree_le),
    }


def _ser_user(x):
    if x.derniere_connexion and (timezone.now() - x.derniere_connexion).seconds < 300:
        last = 'en ligne'
    elif x.derniere_connexion:
        last = _fmt_date(x.derniere_connexion)
    else:
        last = '—'
    return {**_ser_pending(x), 'statut': x.statut, 'last': last,
            'photo': x.photo.url if x.photo else ''}
def _stats_full():
    """Agrégation pour le module Statistiques — 100 % données réelles."""
    now = timezone.now()
    d7, d30, d90 = now - timezone.timedelta(days=7), now - timezone.timedelta(days=30), now - timezone.timedelta(days=90)

    # Pipeline consultations
    pipeline = {s: Consultation.objects.filter(statut=s).count()
                for s in ['EN_ATTENTE', 'EN_COURS', 'VALIDEE', 'ORIENTEE', 'TERMINEE']}

    # Sévérité par région (top 8 par consultations)
    sev_by_region = []
    region_rows = {}
    for c in Consultation.objects.select_related('patient__agent_referent__csb'):
        reg = (c.patient.agent_referent.csb.region
               if c.patient.agent_referent and c.patient.agent_referent.csb else '—')
        row = region_rows.setdefault(reg, {'region': reg, 'CRITIQUE': 0, 'PRÉOCCUPANT': 0, 'MODÉRÉ': 0, 'total': 0})
        if c.severite in row:
            row[c.severite] += 1
        row['total'] += 1
    sev_by_region = sorted(region_rows.values(), key=lambda r: -r['total'])[:8]

    # Croissance comptes (6 derniers mois, par rôle)
    growth, months = [], []
    m0 = now.replace(day=1, hour=0, minute=0)
    for i in range(5, -1, -1):
        m = (m0 - timezone.timedelta(days=30 * i))
        label = MOIS_FR[m.month - 1][:4] + ' ' + str(m.year)[2:]
        months.append(label)
        start = m.replace(day=1)
        end = (start + timezone.timedelta(days=32)).replace(day=1)
        growth.append({
            'pl': Compte.objects.filter(role='PREMIERE_LIGNE', cree_le__gte=start, cree_le__lt=end).count(),
            'med': Compte.objects.filter(role='MEDECIN', cree_le__gte=start, cree_le__lt=end).count(),
        })

    # Signalements par type
    sig_types = {}
    for r in Signalement.objects.exclude(statut='ANNULE'):
        sig_types[r.type] = sig_types.get(r.type, 0) + r.nb_cas
    sig_list = sorted(sig_types.items(), key=lambda kv: -kv[1])[:8]

    # KPIs + deltas
    cons_30 = Consultation.objects.filter(created_at__gte=d30).count()
    cons_prev = Consultation.objects.filter(created_at__gte=d90, created_at__lt=d30).count()
    decide_total = Compte.objects.exclude(statut='EN_ATTENTE').count()
    decide_ok = Compte.objects.filter(statut='ACTIF', valide_par__isnull=False).count()
    districts_all = set(CSB.objects.values_list('district', flat=True))
    districts_cov = set(CSB.objects.filter(agents__statut='ACTIF').values_list('district', flat=True))

    # Histoire du jour : région la plus critique sur 7 jours
    top_region, top_n = '—', 0
    for r in sev_by_region:
        if r['CRITIQUE'] > top_n:
            top_region, top_n = r['region'], r['CRITIQUE']

    # Temps moyen de prise en charge (heures entre création et attribution médecin)
    # Temps moyen de prise en charge (création → attribution médecin)
    delays = []
    for c in Consultation.objects.filter(medecin__isnull=False)[:100]:
        ref = getattr(c, 'maj_le', None)   # tolère les modèles sans maj_le
        if ref:
            h = (ref - c.created_at).total_seconds() / 3600
            if 0 <= h < 720:               # filtre les aberrations (> 30 j)
                delays.append(h)
    avg_delay = round(sum(delays) / len(delays), 1) if delays else 0

    return {
        'pipeline': pipeline,
        'sev_by_region': sev_by_region,
        'growth': {'labels': months, 'data': growth},
        'sig_types': sig_list,
        'kpis': {
            'cons_30': cons_30,
            'cons_delta': (round((cons_30 - cons_prev) / max(cons_prev, 1) * 100) if cons_prev else None),
            'validation_rate': round(decide_ok / max(decide_total, 1) * 100),
            'coverage': round(len(districts_cov) / max(len(districts_all), 1) * 100),
            'avg_delay': avg_delay,
            'patients_per_agent': round(Patient.objects.count() / max(Compte.objects.filter(role='PREMIERE_LIGNE', statut='ACTIF').count(), 1), 1),
        },
        'story': {'region': top_region, 'n': top_n},
        'csb_rows': list(CSB.objects.order_by('region').values('code', 'nom', 'district', 'region')),
    }

# ---------- Routeur ----------

@login_required
def dashboard_redirect(request):
    mapping = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}
    if request.user.role == 'PREMIERE_LIGNE' and not request.user.prise_en_main_terminee:
        return redirect('/premiere-ligne/?view=onboarding')
    return redirect(mapping[request.user.role])


# ---------- PILOTAGE ----------

@role_required('PILOTAGE')
def pilotage(request):
    urls = {
        'decide': '/comptes/<ID>/decision/',
        'statut': '/comptes/<ID>/statut/',
        'csb_create': '/csb/create/',
        'alerte_traiter': '/alerts/<ID>/traiter/',
        'zone_analyse': '/ai/zone-analyse/',      # ← nouveau
    }
    pend = Compte.objects.filter(statut='EN_ATTENTE').order_by('cree_le')
    users = Compte.objects.exclude(statut='EN_ATTENTE').order_by('-maj_le')
    csbs = CSB.objects.order_by('nom')
    alerts = Alerte.objects.filter(traitee=False).select_related(
        'signalement', 'signalement__agent', 'signalement__agent__csb'
    ).order_by('-created_at')

    COORDS = {'Diana': (149, 20), 'Sava': (133, 58), 'Boeny': (82, 92),
              'Sofia': (88, 102), 'Betsiboka': (90, 122), 'Melaky': (45, 135),
              'Alaotra-Mangoro': (112, 128), 'Analanjirofo': (135, 115),
              'Atsinanana': (157, 150), 'Itasy': (85, 165), 'Analamanga': (111, 172),
              'Bongolava': (78, 178), 'Vakinankaratra': (93, 186), 'Menabe': (42, 195),
              'Amoron\u2019i Mania': (95, 215), 'Vatovavy': (126, 222),
              'Haute Matsiatra': (99, 230), 'Fitovinany': (122, 242),
              'Ihorombe': (85, 245), 'Atsimo-Atsinanana': (118, 262),
              'Atsimo-Andrefana': (38, 282), 'Anosy': (75, 300), 'Androy': (100, 305)}
    seen = {}
    for c in csbs:
        r = seen.setdefault(c.region, {
            'nom': c.region, 'csb': 0, 'agents': 0, 'patients': 0,
            'x': 95, 'y': 170, 'statut': 'OK', 'sync': '—'})
        r['csb'] += 1
        r['agents'] += c.agents.count()
        r['patients'] += Patient.objects.filter(agent_referent__csb=c).count()
        # Dernière activité réellement enregistrée sur ce CSB.
        dernier = c.agents.order_by('-maj_le').first()
        if dernier and dernier.maj_le:
            r['sync'] = _fmt_date(dernier.maj_le)
        for a in alerts:
            if a.niveau == 'crit' and c.region.lower() in (a.titre or '').lower():
                r['statut'] = 'ALERTE'
                r['sync'] = 'silence radio'
    for nom, r in seen.items():
        if nom in COORDS:
            r['x'], r['y'] = COORDS[nom]
    regions = list(seen.values())

    stats = {
        'users_total': Compte.objects.filter(statut='ACTIF').count(),
        'users_pl': Compte.objects.filter(role='PREMIERE_LIGNE', statut='ACTIF').count(),
        'users_med': Compte.objects.filter(role='MEDECIN', statut='ACTIF').count(),
        'users_pil': Compte.objects.filter(role='PILOTAGE', statut='ACTIF').count(),
        'csb_total': csbs.count(),
    }

    csb_list = []
    for c in csbs:
        # Coordonnées réelles : celles saisies sur le CSB, sinon celles du district.
        if c.latitude is not None and c.longitude is not None:
            lat, lng = float(c.latitude), float(c.longitude)
        else:
            base = DISTRICT_COORDS.get(c.district)
            lat, lng = (base[0], base[1]) if base else (None, None)
        csb_list.append({
                'code': c.code, 'nom': c.nom, 'district': c.district, 'region': c.region,
                'agents': c.agents.count(),
                'patients': Patient.objects.filter(agent_referent__csb=c).count(),
                'lat': lat, 'lng': lng,
            })

    alert_list = [{
        'id': a.id, 'lvl': a.niveau, 'tag': a.tag, 'title': a.titre,
        'desc': a.description, 'time': _fmt_date(a.created_at),
        'report': ({
            'id': a.signalement_id,
            'type': a.signalement.type,
            'village': a.signalement.village,
            'cases': a.signalement.nb_cas,
            'note': a.signalement.note,
            'status': a.signalement.statut,
            'reporter': f'{a.signalement.agent.prenom} {a.signalement.agent.nom}',
            'role': a.signalement.agent.get_role_display(),
            'structure': (a.signalement.agent.csb.nom if a.signalement.agent.csb else (a.signalement.agent.etablissement or a.signalement.agent.direction or '—')),
            'district': a.signalement.agent.district or (a.signalement.agent.csb.district if a.signalement.agent.csb else '—'),
            'region': a.signalement.agent.region or (a.signalement.agent.csb.region if a.signalement.agent.csb else '—'),
        } if a.signalement_id else None),
    } for a in alerts]

    urls = {
        'decide': '/comptes/<ID>/decision/',
        'statut': '/comptes/<ID>/statut/',
        'csb_create': '/csb/create/',
        'alerte_traiter': '/alerts/<ID>/traiter/',
        'zone_analyse': '/ai/zone-analyse/',
        'pub_feed': '/publications/feed/',
        'pub_publish': '/publications/publish/',
        'pub_lu': '/publications/<ID>/lu/',
        'forum_list': '/formation/forum/',
        'forum_create': '/formation/forum/creer/',
        'forum_reply': '/formation/forum/<ID>/repondre/',
        'fils': '/messaging/fils/',
        'fil_create': '/messaging/fils/creer/',
        'fils_annuaire': '/messaging/fils/annuaire/',
        'fil_messages': '/messaging/fils/<FIL>/messages/',
        'fil_send': '/messaging/fils/<FIL>/send/',
        'fil_delete': '/messaging/fils/message/<ID>/delete/',
    }

    ctx = {
        'form': ProfilePhotoForm(instance=request.user),
        'profile_dashboard': True,
        'pending_json': [_ser_pending(x) for x in pend],
        'users_json':   [_ser_user(x) for x in users],
        'csb_json': csb_list,
        'alerts_json': alert_list,
        'regions_json': regions,
        'stats_json': stats,
        'urls_json': urls,
        'me_json': {'prenom': request.user.prenom},
        'stats_full_json': _stats_full(),
        # Pilotage : lecture des publications et du forum, messagerie inter-rôles
        'pubs_json': [_ser_pub(p, request.user) for p in Publication.objects.all()[:40]],
        'forum_json': [_ser_forum(f, request.user) for f in ForumPost.objects.all()[:40]],
        'fils_json': [_ser_fil(f, request.user) for f in
                      Fil.objects.filter(participants=request.user).prefetch_related(
                          'participants', 'messages__auteur')],
    }

    template = 'dashboards/pilotage.html'
    if not (Path(settings.BASE_DIR) / 'templates' / template).exists():
        return JsonResponse({
            'message': 'Template pilotage.html pas encore créé — mais la vue fonctionne !',
            'role': request.user.role,
            'contexte_ok': True,
            'pending': ctx['pending_json'],
            'stats': ctx['stats_json'],
        })
    return render(request, template, ctx)
    


# ---------- MÉDECIN ----------

@role_required('MEDECIN')
def medecin(request):
    u = request.user
    cases = Consultation.objects.filter(
        statut='EN_ATTENTE', severite__isnull=False
    ).exclude(severite='').filter(
        Q(medecin=u) | (Q(medecin__isnull=True) & local_unassigned_cases(u)) |
        Q(pk__in=CallSession.objects.filter(medecin=u, ended_at__isnull=True,
            consultation__isnull=False).values_list('consultation_id', flat=True))
    ).select_related('patient', 'premiere_ligne', 'patient__csb', 'premiere_ligne__csb').prefetch_related(
        Prefetch('measure_set', queryset=Measure.objects.filter(
            temperature__isnull=False).order_by('-created_at'), to_attr='expertise_measures')
    ).order_by(
        Case(When(medecin_prefere=u, then=0), default=1, output_field=IntegerField()), '-created_at')

    def ser_case(c):
        latest_measure = next(iter(getattr(c, 'expertise_measures', ())), None)
        vitals = {}
        if latest_measure and latest_measure.temperature is not None:
            vitals['temp'] = float(latest_measure.temperature)
        return {
            'id': str(c.id),
            'patient': str(c.patient),
            'code': getattr(c.patient, 'code_patient', '') or '',
            'age': c.patient.age,
            'sexe': c.patient.sexe,
            'csb': c.patient.agent_referent.csb.nom if c.patient.agent_referent and c.patient.agent_referent.csb else '—',
            'agent': str(c.premiere_ligne) if c.premiere_ligne else '—',
            'preferred': c.medecin_prefere_id == u.id,
            'motif': c.motif,
            'symptomes': c.symptomes,
            'sev': c.severite,
            'ia': {'dx': c.ia_diagnostic or 'En attente d\u2019analyse',
                   'conf': c.ia_confiance or 0},
            # N'afficher que les mesures réelles enregistrées pour ce dossier.
            # Le démarrage du délai est l'heure persistante de création de la consultation.
            'vitals': vitals,
            'created_at_ms': int(c.created_at.timestamp() * 1000),
            'wait': max(0, int((timezone.now() - c.created_at).total_seconds() // 60)),
            'vocal': bool(c.symptomes),
        }

    threads = Thread.objects.filter(medecin=u).select_related('agent')
    active = threads.first()
    patient_scope = Q(consultations__medecin=u)
    active_call = CallSession.objects.filter(
        medecin=u, ended_at__isnull=True
    ).select_related('consultation__patient', 'consultation__patient__csb', 'agent__csb').order_by('-started_at').first()

    urls = {
        'take': '/consultations/<ID>/prendre/',
        'ia_validate': '/consultations/<ID>/valider-ia/',
        'ordonnance': '/consultations/<ID>/ordonnance/',
        'retour': '/consultations/<ID>/retour/',
        'orienter': '/consultations/<ID>/orienter/',
        'redirect': '/consultations/<ID>/rediriger/',
        'message': '/messaging/<THREAD>/send/',
        'message_list': '/messaging/<THREAD>/messages/',
        'msg_delete':   '/messaging/message/<ID>/delete/',
        'fils': '/messaging/fils/',
        'fil_create': '/messaging/fils/creer/',
        'fils_annuaire': '/messaging/fils/annuaire/',
        'fil_messages': '/messaging/fils/<FIL>/messages/',
        'fil_send': '/messaging/fils/<FIL>/send/',
        'fil_delete': '/messaging/fils/message/<ID>/delete/',
        'call_end': '/telemedicine/<CALL>/terminer/',
        'tm_doctors': '/telemedicine/doctors/',
        'tm_start':   '/telemedicine/start/',
        'formation_publish': '/publications/publish/',
        'forum_list':   '/formation/forum/',
        'forum_create': '/formation/forum/creer/',
        'forum_reply':  '/formation/forum/<ID>/repondre/',
    }

    ctx = {
        'form': ProfilePhotoForm(instance=request.user),
        'profile_dashboard': True,
        'cases_json': [ser_case(c) for c in cases],
        'consults_json': [{
            'id': str(c.id), 'patient': str(c.patient), 'motif': c.motif,
            'code': getattr(c.patient, 'code_patient', '') or '',
            'medecin_id': str(c.medecin_id or ''),
            'statut': c.statut, 'severite': c.severite, 'dest': c.orientee_vers,
            'agent': str(c.premiere_ligne) if c.premiere_ligne else '—',
            'csb': '—', 'age': c.patient.age, 'sexe': c.patient.sexe,
            'date': _fmt_date(c.created_at),
        } for c in Consultation.objects.filter(medecin=u)[:15]],
        'patients_json': [{
            'code': p.code_patient, 'nom': f'{p.prenom} {p.nom}', 'age': p.age,
            'sexe': p.sexe, 'agent': str(p.agent_referent) if p.agent_referent else '—',
            'csb': p.agent_referent.csb.nom if p.agent_referent and p.agent_referent.csb else '—',
            'v': {},
            'statut': 'STABLE',
        } for p in Patient.objects.filter(patient_scope).select_related(
            'agent_referent__csb', 'csb').distinct()[:15]],
        'threads_json': [{
            'id': t.id, 'nom': f'{t.agent.prenom} {t.agent.nom}',
            'role': t.agent.csb.nom if t.agent.csb else 'Terrain',
            'initiales': (t.agent.prenom[:1] + t.agent.nom[:1]).upper(),
            'online': True,
            'dernier_message': '', 'dernier_temps': '', 'non_lus': 0,
        } for t in threads],
        'fils_json': [_ser_fil(f, u) for f in Fil.objects.filter(
            participants=u).prefetch_related('participants', 'messages__auteur')],
        'active_thread_id': str(active.id) if active else '',
        'thread_nom': f'{active.agent.prenom} {active.agent.nom}' if active else '—',
        'thread_initiales': (active.agent.prenom[:1] + active.agent.nom[:1]).upper() if active else '—',
        'thread_role': active.agent.csb.nom if active and active.agent.csb else 'Terrain',
        'thread_online': bool(active),
        'peer_nom': (f'{active_call.agent.prenom} {active_call.agent.nom}' if active_call else
                     f'{active.agent.prenom} {active.agent.nom}' if active else '—'),
        'peer_initiales': (active_call.agent.initiales if active_call else
                           (active.agent.initiales if active else 'AG')),
        'peer_role': ('AGENT · ' + (active_call.agent.csb.nom if active_call.agent.csb else 'PREMIÈRE LIGNE')
                      if active_call else 'AGENT DE PREMIÈRE LIGNE'),
        'call_id': str(active_call.id) if active_call else '',
        'call_eco': active_call.mode_eco if active_call else False,
        'call_patient': str(active_call.consultation.patient) if active_call and active_call.consultation else '',
        'call_csb': active_call.consultation.patient.csb.nom if active_call and active_call.consultation and active_call.consultation.patient.csb else '',
        'call_motif': active_call.consultation.motif if active_call and active_call.consultation else '',
        'call_symptomes': active_call.consultation.symptomes if active_call and active_call.consultation else '',
        'formation_json': [_ser_pub(p, u) for p in Publication.objects.all()[:30]],
        'forum_json': [_ser_forum(f, request.user) for f in ForumPost.objects.all()[:30]],
        'urls_json': urls,
        'me_json': {'prenom': u.prenom},
    }

    template = 'dashboards/medecin.html'
    if not (Path(settings.BASE_DIR) / 'templates' / template).exists():
        return JsonResponse({
            'message': 'Template medecin.html pas encore créé — mais la vue fonctionne !',
            'role': request.user.role,
            'contexte_ok': True,
            'file_triage': len(ctx['cases_json']),
        })
    return render(request, template, ctx)


# ---------- AGENT (PREMIÈRE LIGNE) ----------

@role_required('PREMIERE_LIGNE')


def agent(request):

    u = request.user
    if not u.prise_en_main_terminee and request.GET.get('view') != 'onboarding':
        return redirect('/premiere-ligne/?view=onboarding')

    threads = Thread.objects.filter(
        agent=u
    ).select_related('medecin')

    doctors = local_doctors_for(u)

    active = threads.first()
    active_call = CallSession.objects.filter(
        agent=u, ended_at__isnull=True
    ).order_by('-started_at').first()

    devices = (
        Device.objects.filter(assigne_a=u, is_simulated=False) |
        Device.objects.filter(csb=u.csb, is_simulated=False)
    ).distinct()

    # ============================================================
    # PUBLICATIONS + NOTIFICATIONS
    # ============================================================

    lues = PublicationLu.objects.filter(
        agent=u
    ).values_list(
        'publication_id',
        flat=True
    )

    nouvelles_pubs = Publication.objects.exclude(
        id__in=lues
    ).count()

    from django.db.models import Q
    notifs = Notif.objects.filter(Q(destinataire=u) | Q(destinataire__isnull=True, role_cible__in=['agent', 'tous'])).order_by('-created_at')[:15]

    # ============================================================
    # URLS
    # ============================================================

    urls = {
        'consult_save': '/consultations/save/',
        'measure_post': '/iot/measures/',
        'simulation_post': '/iot/simulation/',
        'sync': '/iot/sync/',
        'report': '/reports/create/',
        'report_delete': '/reports/<ID>/delete/',
        'ordonnance_recue': '/consultations/<ID>/remise/',
        'message': '/messaging/<THREAD>/send/',   # route réelle : messaging.urls
        'fils': '/messaging/fils/',
        'fil_create': '/messaging/fils/creer/',
        'fils_annuaire': '/messaging/fils/annuaire/',
        'fil_messages': '/messaging/fils/<FIL>/messages/',
        'fil_send': '/messaging/fils/<FIL>/send/',
        'fil_delete': '/messaging/fils/message/<ID>/delete/',
        'boite': '/messaging/boite/',
        'tm_doctors': '/telemedicine/doctors/',
        'tm_start':   '/telemedicine/start/',
        'tm_end':     '/telemedicine/<CALL>/terminer/',
        'qr_lookup': '/patients/qr/',
        'patient_create': '/patients/create/',
        'pub_lu': '/publications/<ID>/lu/',
        'notifs_lu': '/patients/notifs-lu/',
        'agent_feed': '/agent-feed/',
        'ai_transcribe': '/ai/transcribe/',
        'ai_classify':   '/ai/classify/',
        'ai_predict_disease': '/ai/predict-disease/',
        'ai_speak':      '/ai/speak/',
        'message_list': '/messaging/<THREAD>/messages/',
        'msg_delete':   '/messaging/message/<ID>/delete/',
        'ia_send':      '/assistant/send/',
        'ia_history':   '/assistant/history/',
        'ia_reset':     '/assistant/reset/',
    }

    # ============================================================
    # CONTEXTE
    # ============================================================

    ctx = {
        'form': ProfilePhotoForm(instance=request.user),
        'profile_dashboard': True,
        'ai_symptoms_json': AI_SYMPTOM_CATALOG,
        'iot_simulation_enabled': settings.IOT_SIMULATION_ENABLED,

        # --------------------------------------------------------
        # STATISTIQUES
        # --------------------------------------------------------

        'stats': {
            'patients': Patient.objects.filter(
                agent_referent=u
            ).count(),

            'consults': Consultation.objects.filter(
                premiere_ligne=u,
                created_at__date=timezone.now().date()
            ).count(),

            'reports': Signalement.objects.filter(
                agent=u
            ).exclude(statut='ANNULE').count(),

            'devices': devices.count(),

            'devices_online': devices.filter(
                statut='CONNECTÉ'
            ).count(),
        },

        # --------------------------------------------------------
        # PATIENTS
        # --------------------------------------------------------

        'patients_json': [{
            'code': p.code_patient,
            'nom': f'{p.prenom} {p.nom}',
            'age': p.age,
            'sexe': p.sexe,
            'village': p.village,
            'statut': 'SUIVI',
        } for p in Patient.objects.filter(
            agent_referent=u
        )],

        'doctors_json': [{
            'id': str(d.id), 'nom': f'Dr {d.prenom} {d.nom}',
            'structure': d.csb.nom if d.csb_id else d.etablissement,
        } for d in doctors.order_by('nom', 'prenom')],

        # --------------------------------------------------------
        # CONSULTATIONS
        # --------------------------------------------------------

        'consults_json': [{
            'id': str(c.id),
            'patient': str(c.patient),
            'code': getattr(c.patient, 'code_patient', '') or '',
            'medecin_id': str(c.medecin_id or ''),
            'motif': c.motif,
            'symptomes': c.symptomes,
            'statut': c.statut,
            'severite': c.severite,
            'medecin': str(c.medecin) if c.medecin else '',
            'date': _fmt_date(c.created_at),
        } for c in Consultation.objects.filter(
            premiere_ligne=u
        )[:15]],

        # --------------------------------------------------------
        # SIGNALEMENTS
        # --------------------------------------------------------

        'reports_json': [{
            'id': r.id,
            'type': r.type,
            'village': r.village,
            'n': r.nb_cas,
            'note': r.note,
            'statut': r.statut,
            'date': _fmt_date(r.created_at),
        } for r in Signalement.objects.filter(agent=u).exclude(statut='ANNULE')],

        # --------------------------------------------------------
        # DEVICES
        # --------------------------------------------------------

        'devices_json': [{
            'id': d.code,
            'nom': d.nom,
            'statut': d.statut,
            'bat': d.batterie,
            'sig': d.signal,
            'fw': d.firmware,
            'csb': d.csb.nom if d.csb else '—',
        } for d in devices],

        # --------------------------------------------------------
        # MESURES IOT
        # --------------------------------------------------------

        'measures_json': [{
            't': m.created_at.strftime('%H:%M'),
            'pat': str(m.patient or '—'),
            'spo2': m.spo2,
            'temp': str(m.temperature) if m.temperature is not None else None,
            'bpm': m.bpm,
            'dev': m.device.code,
            'sync': m.synchronise,
            'source': m.source,
        } for m in Measure.objects.filter(
            device__assigne_a=u
        )[:15]],

        # --------------------------------------------------------
        # MESSAGERIE
        # --------------------------------------------------------

        'threads_json': [{
            'id': t.id,
            'nom': f'Dr {t.medecin.nom}',
            'online': True,
            'role': t.medecin.etablissement or 'Télé-expertise',
            'initiales': (
                t.medecin.prenom[:1] +
                t.medecin.nom[:1]
            ).upper(),
        } for t in threads],
        'fils_json': [_ser_fil(f, u) for f in Fil.objects.filter(
            participants=u).prefetch_related('participants', 'messages__auteur')],

        'active_thread_id': str(
            active.id
        ) if active else '',

        'thread_nom': (
            f'Dr {active.medecin.nom}'
            if active
            else '—'
        ),

        'thread_initiales': (
            (
                active.medecin.prenom[:1] +
                active.medecin.nom[:1]
            ).upper()
            if active
            else '—'
        ),

        'thread_role': (
            active.medecin.etablissement
            if active
            else '—'
        ),

        'thread_online': bool(active),

        'peer_nom': (
            f'Dr {active.medecin.nom}'
            if active
            else '—'
        ),

        'peer_initiales': 'DR',

        'peer_role': 'TÉLÉ-EXPERTISE',
        'call_id': str(active_call.id) if active_call else '',
        'call_eco': active_call.mode_eco if active_call else False,

        # --------------------------------------------------------
        # URLS
        # --------------------------------------------------------

        'message_list': '/messaging/<THREAD>/messages/',
        'msg_delete':   '/messaging/message/<ID>/delete/',
        'formation_publish': '/publications/publish/',
        'forum_list':   '/formation/forum/',
        'forum_create': '/formation/forum/creer/',
        'forum_reply':  '/formation/forum/<ID>/repondre/',
        'urls_json': urls,

        # --------------------------------------------------------
        # INFORMATIONS SUR L'AGENT CONNECTÉ
        # --------------------------------------------------------

        'me_json': {
            'prenom': u.prenom,

            'csb_id': (
                u.csb.id
                if u.csb
                else None
            ),

            'csb_nom': (
                u.csb.nom
                if u.csb
                else ''
            ),

            'district': (
                u.district
                or (
                    u.csb.district
                    if u.csb
                    else ''
                )
            ),

            'region': (
                u.region
                or (
                    u.csb.region
                    if u.csb
                    else ''
                )
            ),
        },

        # --------------------------------------------------------
        # NOTIFICATIONS
        # --------------------------------------------------------

        'notifs_json': [{
            'id': n.id,
            'icone': n.icone,
            'titre': n.titre,
            'texte': n.texte,
            'goto': n.goto_view,
            'lu': n.lu,
            'date': _fmt_date(n.created_at),
        } for n in notifs],

        # --------------------------------------------------------
        # NOUVELLES PUBLICATIONS
        # --------------------------------------------------------

        'new_pubs': nouvelles_pubs,
        'pubs_json': [_ser_pub(p, u) for p in Publication.objects.all()[:40]],
        'forum_json': [_ser_forum(f, request.user) for f in ForumPost.objects.all()[:40]],
    }

    # ============================================================
    # TEMPLATE
    # ============================================================

    template = 'dashboards/premiere_ligne.html'

    if not (
        Path(settings.BASE_DIR) /
        'templates' /
        template
    ).exists():

        return JsonResponse({
            'message': (
                'Template premiere_ligne.html '
                'pas encore créé — mais la vue fonctionne !'
            ),

            'role': request.user.role,

            'contexte_ok': True,

            'patients': ctx['stats']['patients'],
        })

    return render(
        request,
        template,
        ctx
    )
def _ser_pub(p, user):
    """Sérialise une Publication pour les feeds Formations / Publications."""
    lu = bool(user and user.is_authenticated and PublicationLu.objects.filter(
        publication=p, agent=user).exists())
    return {
        'id': p.id, 'type': p.type, 'titre': p.titre, 'resume': p.resume,
        'epingle': p.epingle, 'vues': p.lectures.count(),
        'auteur': (p.auteur.nom if p.auteur else '—'),
        'auteur_prenom': (p.auteur.prenom if p.auteur else ''),
        'auteur_role': (p.auteur.get_role_display() if p.auteur else '—'),
        'created': _fmt_date(p.created_at), 'lu': lu,
        'fichier_url': p.fichier_url, 'fichier_nom': p.fichier_nom,
    }


def _ser_forum(f, user=None):
    """Sérialise un sujet de forum (formation) pour les tableaux de bord."""
    return {
        'id': f.id, 'question': f.question,
        'auteur': str(f.auteur),
        'auteur_role': (f.auteur.get_role_display() if f.auteur else '—'),
        'auteur_role_code': (f.auteur.role if f.auteur else ''),
        'auteur_photo': (f.auteur.photo.url if f.auteur and f.auteur.photo else ''),
        'tags': f.tags, 'date': _fmt_date(f.created_at),
        'reponses': f.reponses.count(),
        'reponses_list': ([{'id': r.id, 'reponse': r.reponse, 'auteur': str(r.auteur),
                           'auteur_role': (r.auteur.get_role_display() if r.auteur else '—'),
                           'auteur_role_code': (r.auteur.role if r.auteur else ''),
                           'auteur_photo': (r.auteur.photo.url if r.auteur and r.auteur.photo else ''),
                           'date': _fmt_date(r.created_at)}
                          for r in f.reponses.select_related('auteur')[:50]]),
    }


@require_POST
def zone_analyse(request):
    """Stub intelligent — agrège les VRAIES données de la zone visible.
    L'IA réelle (phase épidémiologique) se branchera sur ce même endpoint."""
    try:
        data = _json.loads(request.body or '{}')
    except Exception:
        data = {}
    codes = [str(c) for c in (data.get('csbs') or [])][:200]
    csbs = CSB.objects.filter(code__in=codes)
    n = csbs.count()
    if n == 0:
        return JsonResponse({'ok': True, 'urgence': 'NORMALE',
                             'synthese': 'Aucune CSB dans cette zone.'})

    regions  = sorted(set(csbs.values_list('region', flat=True)))
    agents   = Compte.objects.filter(role='PREMIERE_LIGNE', statut='ACTIF', csb__in=csbs).count()
    patients = Patient.objects.filter(agent_referent__csb__in=csbs).count()
    en_attente = Consultation.objects.filter(
        statut='EN_ATTENTE', patient__agent_referent__csb__in=csbs).count()
    critiques = Consultation.objects.filter(
        statut='EN_ATTENTE', severite='CRITIQUE',
        patient__agent_referent__csb__in=csbs).count()

    urgence = 'CRITIQUE' if critiques else ('SURVEILLANCE' if en_attente else 'NORMALE')
    parts = [
        f'{n} CSB analysées sur {len(regions)} région{"s" if len(regions) > 1 else ""} '
        f'({", ".join(regions[:3])}{"…" if len(regions) > 3 else ""}) — '
        f'{agents} agents actifs, {patients} patients suivis.'
    ]
    if critiques:
        parts.append(f'Vigilance : {critiques} cas critique{"s" if critiques > 1 else ""} '
                     f'en attente d\u2019expertise médicale.')
    if en_attente:
        parts.append(f'{en_attente} consultation{"s" if en_attente > 1 else ""} attendent une décision.')
    if urgence == 'NORMALE':
        parts.append('Situation stable — poursuite de la surveillance de routine.')

    return JsonResponse({
        'ok': True, 'urgence': urgence, 'synthese': ' '.join(parts),
        'stats': {'csb': n, 'agents': agents, 'patients': patients,
                  'en_attente': en_attente, 'critiques': critiques},
    })
@role_required('PREMIERE_LIGNE')
def agent_feed(request):
    u = request.user
    from notifications.models import Notif
    from django.db.models import Q
    role_cible = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}[u.role]
    notifs = Notif.objects.filter(Q(destinataire=u) | Q(destinataire__isnull=True, role_cible__in=[role_cible, 'tous'])).order_by('-created_at')[:15]
    return JsonResponse({'ok': True,
        'consults': [{'id': str(c.id), 'patient': str(c.patient), 'motif': c.motif,
        'code': getattr(c.patient, 'code_patient', '') or '',
                      'medecin_id': str(c.medecin_id or ''),
                      'statut': c.statut, 'severite': c.severite,
                      'medecin': str(c.medecin) if c.medecin else '',
                      'date': _fmt_date(c.created_at)} for c in
                     Consultation.objects.filter(premiere_ligne=u)[:15]],
        'notifs': [{'id': n.id, 'icone': n.icone, 'titre': n.titre, 'texte': n.texte,
                    'goto': n.goto_view, 'lu': n.lu, 'date': _fmt_date(n.created_at)} for n in notifs],
    })
@role_required('PILOTAGE')
def surveillance_data(request):
    """Foyers épidémiques = consultations épidémiques + signalements actifs,
    géolocalisés via DISTRICT_COORDS."""
    foyers = []

    # Source 1 : consultations marquées épidémiques. Plusieurs consultations
    # du même foyer doivent former un seul compteur épidémique.
    consultation_groups = {}
    for c in Consultation.objects.filter(epidemic_suspect=True).select_related(
            'patient__agent_referent__csb', 'patient__agent_referent'):
        reg = c.patient.agent_referent.csb.region if c.patient.agent_referent and c.patient.agent_referent.csb else '—'
        district = (c.patient.agent_referent.district if c.patient.agent_referent else '') or reg
        base = DISTRICT_COORDS.get(district) or REGION_COORDS.get(reg) or REGION_COORDS.get(reg.replace("'", '’'))
        type_epidemie = (c.epidemic_type or 'Épidémie suspectée').strip()
        village = c.patient.village or '—'
        # Un foyer est suivi à l'échelle du district : plusieurs villages du
        # même district doivent contribuer au même seuil épidémique.
        key = (type_epidemie.casefold(), district.casefold(), reg.casefold())
        group = consultation_groups.get(key)
        if group is None:
            group = {
            'source': 'CONSULTATION',
            'ref': str(c.id),
            'type': type_epidemie,
            'niveau_declare': c.severite or 'PRÉOCCUPANT',
            'village': village,
            'district': district, 'region': reg,
            'nb_cas': 0,
            'lat': base[0] if base else None, 'lng': base[1] if base else None,
            'patient': str(c.patient),
            'agent': str(c.premiere_ligne) if c.premiere_ligne else '—',
            'date': _fmt_date(c.created_at),
            'note': c.symptomes[:120],
            '_villages': {village},
            '_max_declared': 0,
            }
            consultation_groups[key] = group
        group['nb_cas'] += 1
        group['_villages'].add(village)
        group['village'] = ' · '.join(sorted(group['_villages']))
        declared_rank = {'MODÉRÉ': 1, 'PRÉOCCUPANT': 2, 'URGENT': 3, 'CRITIQUE': 4}
        if declared_rank.get(c.severite or 'PRÉOCCUPANT', 2) > group['_max_declared']:
            group['_max_declared'] = declared_rank.get(c.severite or 'PRÉOCCUPANT', 2)
            group['niveau_declare'] = c.severite or 'PRÉOCCUPANT'
            group['patient'] = str(c.patient)
            group['agent'] = str(c.premiere_ligne) if c.premiere_ligne else '—'
            group['date'] = _fmt_date(c.created_at)
            group['note'] = c.symptomes[:120]

    for group in consultation_groups.values():
        if group['nb_cas'] >= 5 or group['_max_declared'] >= 4:
            group['niveau'] = 'CRITIQUE'
        elif group['nb_cas'] >= 3 or group['_max_declared'] >= 3:
            group['niveau'] = 'URGENT'
        else:
            group['niveau'] = group['niveau_declare']
        del group['_villages']
        del group['_max_declared']
        foyers.append(group)

    # Source 2 : signalements transmis
    for r in Signalement.objects.filter(statut__in=['TRANSMIS', 'PRIS_EN_CHARGE']).select_related('agent__csb'):
        district = r.agent.district or (r.agent.csb.district if r.agent.csb else '')
        reg = r.agent.region or (r.agent.csb.region if r.agent.csb else '')
        base = DISTRICT_COORDS.get(district) or REGION_COORDS.get(reg) or REGION_COORDS.get(reg.replace("'", '’'))
        # Calcul par cas, mais une suspicion critique déclarée reste critique
        if r.nb_cas >= 5:
            niveau = 'CRITIQUE'
        elif r.nb_cas >= 3:
            niveau = 'URGENT'
        else:
            niveau = 'PRÉOCCUPANT'
        foyers.append({
            'source': 'SIGNALEMENT',
            'ref': str(r.id),
            'type': r.type,
            'niveau': niveau,
            'niveau_calcule': True,       # distinguishable côté front
            'village': r.village, 'district': district, 'region': reg,
            'nb_cas': r.nb_cas,
            'lat': base[0] if base else None, 'lng': base[1] if base else None,
            'patient': '—', 'agent': str(r.agent),
            'date': _fmt_date(r.created_at),
            'note': r.note[:120],
        })

    return JsonResponse({'ok': True, 'foyers': foyers})
