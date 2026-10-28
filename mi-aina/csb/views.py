# -*- coding: utf-8 -*-
"""MI-AINA — CSB : liste, fiche détaillée, création et modification.

Deux entrées possibles pour la création :
  * la page Django  /csb/nouveau/   (formulaire officiel, sans JavaScript)
  * l'API JSON      /csb/create/    (conservée pour compatibilité)
"""
import json as _json

from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounts.models import Compte
from core.decorators import role_required
from iot.models import Device
from patients.models import Patient
from .forms import CSBForm
from .models import CSB

LECTURE = ['PILOTAGE', 'MEDECIN']
REDACTION = 'PILOTAGE'


def _body(request):
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


def _coords_district(district):
    """Coordonnées réelles du district (source unique : dashboard.views)."""
    from dashboard.views import DISTRICT_COORDS
    return DISTRICT_COORDS.get(district)


def _fiche(c):
    """Assemble les VRAIES données rattachées au CSB (aucune donnée inventée)."""
    personnel = list(Compte.objects.filter(csb=c).order_by('role', 'nom'))
    lat, lng = c.latitude, c.longitude
    source = 'saisies'
    if lat is None or lng is None:
        base = _coords_district(c.district)
        if base:
            lat, lng = base[0], base[1]
            source = 'district'
    return {
        'csb': c,
        'agents_pl': [p for p in personnel if p.role == 'PREMIERE_LIGNE'],
        'medecins': [p for p in personnel if p.role == 'MEDECIN'],
        'pilotage': [p for p in personnel if p.role == 'PILOTAGE'],
        'personnel_total': len(personnel),
        'patients': Patient.objects.filter(agent_referent__csb=c).count(),
        'devices': Device.objects.filter(csb=c).count(),
        'lat': lat, 'lng': lng, 'coords_source': source,
    }


@role_required(LECTURE)
def csb_detail(request, code):
    """Fiche détaillée d'un CSB — tout vient de la base de données."""
    c = get_object_or_404(CSB, code=code.upper())
    return render(request, 'csb/detail.html', _fiche(c))


@role_required(REDACTION)
def csb_nouveau(request):
    """Création d'un CSB par formulaire Django classique (POST + redirection)."""
    form = CSBForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        c = form.save()
        messages.success(request, 'CSB créé : %s (%s).' % (c.nom, c.code), 'success')
        return redirect('csb_detail', code=c.code)
    return render(request, 'csb/form.html', {'form': form, 'titre': 'Nouveau centre de santé (CSB)'})


@role_required(REDACTION)
def csb_edit(request, code):
    """Modification d'un CSB par le Pilotage."""
    c = get_object_or_404(CSB, code=code.upper())
    form = CSBForm(request.POST or None, instance=c)
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'CSB mis à jour : %s (%s).' % (c.nom, c.code), 'success')
        return redirect('csb_detail', code=c.code)
    return render(request, 'csb/form.html',
                  {'form': form, 'titre': 'Modifier %s' % c.nom, 'csb': c})


@require_POST
@role_required(REDACTION)
def csb_create(request):
    """API JSON (compatibilité) — accepte un corps JSON ou un POST classique."""
    data = _body(request)
    form = CSBForm(data)
    if not form.is_valid():
        erreurs = ' '.join('%s : %s' % (k, ' '.join(v)) for k, v in form.errors.items())
        return JsonResponse({'ok': False, 'erreur': erreurs or 'Formulaire invalide.'}, status=400)
    c = form.save()
    return JsonResponse({'ok': True, 'csb': {
        'code': c.code, 'nom': c.nom, 'district': c.district, 'region': c.region,
        'agents': Compte.objects.filter(csb=c).count(),
        'patients': Patient.objects.filter(agent_referent__csb=c).count(),
        'detail': '/csb/%s/' % c.code,
    }})
