import json as _json
import uuid
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from core.decorators import role_required
from .models import Patient, PatientAccessLog
from publications.models import PublicationLu, Publication
from django.shortcuts import render
from consultations.models import Consultation, Ordonnance
from django.http import HttpResponseNotFound


def _patient_for_user(request, code):
    """Retourne uniquement un dossier rattaché au professionnel connecté."""
    patient = Patient.objects.filter(code_patient=code).select_related('csb', 'agent_referent').first()
    if not patient:
        return None
    role = getattr(request.user, 'role', '')
    if role == 'PREMIERE_LIGNE':
        return patient if patient.agent_referent_id == request.user.id else None
    if role == 'MEDECIN':
        return patient if Consultation.objects.filter(
            patient=patient, medecin=request.user).exists() else None
    return None


def _consultations_for_user(patient, user):
    consultations = Consultation.objects.filter(patient=patient)
    if user.role == 'PREMIERE_LIGNE':
        return consultations.filter(premiere_ligne=user)
    if user.role == 'MEDECIN':
        return consultations.filter(medecin=user)
    return consultations.none()


def _log_access(patient, user, action):
    PatientAccessLog.objects.create(patient=patient, utilisateur=user, action=action)


def _date_text(value):
    return value.strftime('%d/%m/%Y %H:%M') if value else ''


@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def patient_detail_data(request, code):
    """Données JSON du dossier pour le panneau central des tableaux de bord."""
    patient = _patient_for_user(request, code)
    if not patient:
        return JsonResponse({'ok': False, 'error': 'Dossier introuvable ou non autorisé.'}, status=404)
    _log_access(patient, request.user, 'DOSSIER')

    consultations = []
    for c in _consultations_for_user(patient, request.user).select_related('medecin').order_by('-created_at')[:50]:
        try:
            ordonnance = c.ordonnance
        except Exception:
            ordonnance = None
        consultations.append({
            'date': _date_text(getattr(c, 'created_at', None) or getattr(c, 'date', None)),
            'motif': str(getattr(c, 'motif', '') or ''),
            'statut': str(getattr(c, 'get_statut_display', lambda: getattr(c, 'statut', ''))()),
            'severite': str(getattr(c, 'severite', '') or ''),
            'medecin': str(getattr(c, 'medecin', '') or ''),
            'observation': str(getattr(c, 'observation', '') or ''),
            'ordonnance': str(getattr(ordonnance, 'contenu', '') or '') if ordonnance else '',
            'suivi': str(getattr(ordonnance, 'suivi', '') or '') if ordonnance else '',
            'orientation': str(getattr(c, 'orientee_vers', '') or ''),
        })

    measures = []
    try:
        from iot.models import Measure
        measure_qs = Measure.objects.filter(patient=patient, temperature__isnull=False)
        if request.user.role == 'MEDECIN':
            measure_qs = measure_qs.filter(consultation__medecin=request.user)
        else:
            measure_qs = measure_qs.filter(consultation__premiere_ligne=request.user)
        measures = [{
            'date': _date_text(m.created_at),
            'temperature': str(m.temperature) if m.temperature is not None else None,
            'device': str(m.device),
        } for m in measure_qs.select_related('device').order_by('-created_at')[:30]]
    except Exception:
        pass

    return JsonResponse({'ok': True, 'patient': {
        'code': patient.code_patient, 'nom': patient.nom, 'prenom': patient.prenom,
        'age': patient.age, 'date_naissance': str(patient.date_naissance or ''), 'sexe': patient.sexe,
        'telephone': patient.telephone, 'adresse': patient.adresse, 'village': patient.village,
        'commune': patient.commune, 'district': patient.district, 'region': patient.region,
        'csb': str(patient.csb or ''), 'agent': str(patient.agent_referent or ''),
        'created_at': _date_text(patient.created_at),
    }, 'consultations': consultations, 'mesures': measures})


def _code():
    return f'PAT-{uuid.uuid4().hex[:6].upper()}'


def _body(request):
    """Lit le corps JSON du POST (ou tombe sur request.POST pour FormData)."""
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


@require_POST
@role_required('PREMIERE_LIGNE')
def patient_create(request):
    """Création — CSB/district/région viennent TOUJOURS de l'agent connecté."""
    a = request.user
    data = _body(request)
    nom    = (data.get('nom') or '').strip()
    prenom = (data.get('prenom') or '').strip()
    try:
        age = int(data.get('age') or 0)
    except (TypeError, ValueError):
        age = 0
    sexe    = 'F' if data.get('sexe') == 'F' else 'M'
    village = (data.get('village') or '').strip()
    telephone = (data.get('telephone') or '').strip()

    if not nom or not age:
        return JsonResponse({'ok': False, 'erreur': 'Nom et âge sont obligatoires.'}, status=400)

    p = Patient.objects.create(
        code_patient=_code(), nom=nom, prenom=prenom, age=age, sexe=sexe,
        village=village, telephone=telephone,
        agent_referent=a,
        csb=a.csb, district=(a.district or (a.csb.district if a.csb else '')),
        region=(a.region or (a.csb.region if a.csb else '')),
    )
    return JsonResponse({'ok': True, 'patient': {
        'code': p.code_patient, 'nom': f'{p.prenom} {p.nom}'.strip(), 'age': p.age,
        'sexe': p.sexe, 'village': p.village, 'statut': 'NOUVEAU'}})


@require_POST
@role_required('PREMIERE_LIGNE')
def sync_lecture(request):
    """Accusés de lecture des publications créés hors-ligne (batch)."""
   
    codes = request.POST.getlist('ids[]') or request.POST.getlist('ids')
    n = 0
    for pid in codes:
        pub = Publication.objects.filter(id=pid).first()
        if pub:
            _, created = PublicationLu.objects.get_or_create(publication=pub, agent=request.user)
            if created: n += 1
    return JsonResponse({'ok': True, 'nouveaux': n})


@require_POST
@role_required('PREMIERE_LIGNE')
def notifs_lu(request):
    """Marquer toutes les notifications de l'agent comme lues."""
    from notifications.models import Notif
    Notif.objects.filter(destinataire=request.user, lu=False).update(lu=True)
    return JsonResponse({'ok': True})

# ================= Dossier patient (partage 1re ligne / medecin) =================
def _pshow(label, val):
    if val in (None, '', [], 'None'):
        return None
    return {'label': label, 'value': val}


def _pfmt(dt):
    if not dt:
        return ''
    try:
        return dt.strftime('%d/%m/%Y %H:%M')
    except Exception:
        return str(dt)


@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def patient_detail(request, code):
    """Dossier patient en lecture : identite, consultations, ordonnances, mesures, notifications."""
    p = _patient_for_user(request, code)
    if not p:
        return HttpResponseNotFound('<h1>Dossier introuvable ou non autorisé</h1>')
    _log_access(p, request.user, 'DOSSIER')

    def g(obj, *names):
        for n in names:
            if hasattr(obj, n):
                v = getattr(obj, n)
                if v not in (None, '', []):
                    return v
        return None

    # Champ de rendez-vous de l'ordonnance, detecte dans le modele (rdv_date, rendez_vous...).
    RDV_FIELD = None
    try:
        for f in Ordonnance._meta.get_fields():
            nm = getattr(f, 'name', '')
            if nm.startswith('rdv') or nm.startswith('rendez'):
                RDV_FIELD = nm
                break
    except Exception:
        RDV_FIELD = None

    age = g(p, 'age')
    ident = [x for x in [
        _pshow('Code dossier', g(p, 'code_patient', 'code')),
        _pshow('Nom', g(p, 'nom')),
        _pshow('Prenom', g(p, 'prenom')),
        _pshow('Age', (str(age) + ' ans') if age else None),
        _pshow('Date de naissance', g(p, 'date_naissance')),
        _pshow('Sexe', g(p, 'sexe')),
        _pshow('Telephone', g(p, 'telephone', 'contact', 'tel')),
        _pshow('Village / Fokontany', g(p, 'village', 'fokontany')),
        _pshow('Commune', g(p, 'commune')),
        _pshow('District', g(p, 'district')),
        _pshow('Region', g(p, 'region')),
        _pshow('CSB de rattachement', getattr(p, 'csb', None)),
        _pshow('Agent referent', getattr(p, 'agent', None)),
        _pshow('Dossier cree le', _pfmt(g(p, 'created_at', 'cree_le'))),
    ] if x]

    consults = []
    try:
        qs = list(_consultations_for_user(p, request.user).order_by('-created_at')[:25])
    except Exception:
        qs = []
    for c in qs:
        o = None
        for rel in ('ordonnance', 'ordonance'):
            if hasattr(c, rel):
                o = getattr(c, rel, None)
                break
        consults.append({
            'date': _pfmt(g(c, 'created_at', 'date')),
            'motif': g(c, 'motif'),
            'statut': g(c, 'statut'),
            'severite': g(c, 'severite'),
            'medecin': getattr(c, 'medecin', None),
            'observation': g(c, 'observation'),
            'ordonnance': getattr(o, 'contenu', None) if o else None,
            'suivi': getattr(o, 'suivi', None) if o else None,
            'rdv': _pfmt(getattr(o, RDV_FIELD, None)) if (o and RDV_FIELD) else None,
            'remise': bool(getattr(o, 'remise', False)) if o else False,
            'oriente': g(c, 'orientee_vers'),
        })

    mesures = []
    try:
        from iot import models as iotm
        for n in dir(iotm):
            cls = getattr(iotm, n)
            if isinstance(cls, type) and hasattr(cls, '_meta'):
                fk = None
                for f in cls._meta.get_fields():
                    if getattr(f, 'related_model', None) is Patient:
                        fk = f
                        break
                if fk:
                    records = cls.objects.filter(**{fk.name: p})
                    if any(getattr(field, 'name', '') == 'temperature' for field in cls._meta.get_fields()):
                        records = records.filter(temperature__isnull=False)
                    if request.user.role == 'MEDECIN':
                        if not any(getattr(f, 'name', '') == 'consultation' for f in cls._meta.get_fields()):
                            continue
                        records = records.filter(consultation__medecin=request.user)
                    else:
                        records = records.filter(consultation__premiere_ligne=request.user)
                    for r in records.order_by('-pk')[:10]:
                        mesures.append({
                            'quand': _pfmt(getattr(r, 'created_at', None) or getattr(r, 'date', None)),
                            'temp': getattr(r, 'temperature', None) if getattr(r, 'temperature', None) is not None else getattr(r, 'temp', None),
                            'boitier': getattr(r, 'device', None) or getattr(r, 'boitier', None),
                        })
                    break
    except Exception:
        pass

    notifs = []
    try:
        notifs = list(Notif.objects.filter(destinataire=request.user).order_by('-id')[:6])
    except Exception:
        pass

    role = getattr(request.user, 'role', '')
    retour = {'PREMIERE_LIGNE': '/premiere-ligne/', 'MEDECIN': '/medecin/'}.get(role, '/')
    return render(request, 'patients/detail.html', {
        'patient': p, 'code': code, 'ident': ident, 'consults': consults,
        'mesures': mesures, 'notifs': notifs, 'retour': retour,
    })


@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def patient_pdf(request, code):
    """Exporte un résumé médical lisible en PDF."""
    from django.http import HttpResponse
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    patient = _patient_for_user(request, code)
    if not patient:
        return HttpResponseNotFound('Dossier introuvable ou non autorisé')
    _log_access(patient, request.user, 'PDF')
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="dossier-{patient.code_patient}.pdf"'
    doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    story = [Paragraph('MI-AINA — Dossier médical', styles['Title']),
             Paragraph(escape(str(patient)), styles['Heading2']),
             Paragraph(f"Code : {escape(patient.code_patient)} · Âge : {patient.age} ans · Sexe : {escape(patient.sexe)}", styles['BodyText']),
             Paragraph(f"Village : {escape(patient.village or '—')} · Région : {escape(patient.region or '—')} · District : {escape(patient.district or '—')}", styles['BodyText']),
             Spacer(1, 8*mm), Paragraph('Consultations', styles['Heading2'])]
    rows = [['Date', 'Motif', 'Statut', 'Observation / prescription']]
    for c in _consultations_for_user(patient, request.user).select_related('medecin').prefetch_related('ordonnance').order_by('-created_at'):
        prescription = ''
        try:
            prescription = c.ordonnance.contenu
        except Exception:
            pass
        detail = ' · '.join(filter(None, [c.observation, prescription, c.orientee_vers, c.orientee_struct]))
        rows.append([c.created_at.strftime('%d/%m/%Y'), c.motif, c.get_statut_display(), detail or '—'])
    table = Table([[Paragraph(escape(str(cell)), styles['BodyText']) for cell in row] for row in rows],
                  colWidths=[24*mm, 38*mm, 28*mm, 84*mm], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#007E3A')),
        ('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#ccd5ce')),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f3f7f3')]),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5)]))
    story.append(table)
    from iot.models import Measure
    measure_qs = Measure.objects.filter(patient=patient, temperature__isnull=False)
    if request.user.role == 'MEDECIN':
        measure_qs = measure_qs.filter(consultation__medecin=request.user)
    else:
        measure_qs = measure_qs.filter(consultation__premiere_ligne=request.user)
    measures = measure_qs.select_related('device').order_by('-created_at')[:50]
    if measures:
        story.extend([Spacer(1, 8*mm), Paragraph('Mesures IoT', styles['Heading2'])])
        measure_rows = [['Date', 'Température infrarouge', 'Appareil']]
        measure_rows.extend([[m.created_at.strftime('%d/%m/%Y %H:%M'),
                              f'{m.temperature} °C' if m.temperature is not None else '—', str(m.device)]
                             for m in measures])
        measure_table = Table([[Paragraph(escape(str(cell)), styles['BodyText']) for cell in row]
                               for row in measure_rows], colWidths=[48*mm, 58*mm, 68*mm], repeatRows=1)
        measure_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#007E3A')),
            ('TEXTCOLOR',(0,0),(-1,0),colors.white),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#ccd5ce')),
            ('VALIGN',(0,0),(-1,-1),'TOP')]))
        story.append(measure_table)
    doc.build(story)
    return response
