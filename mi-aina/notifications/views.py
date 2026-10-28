from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404, redirect
from core.decorators import role_required
from .models import Notif

@role_required(['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE'])
def feed(request):
    from django.db.models import Q
    role = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}[request.user.role]
    qs = Notif.objects.filter(Q(destinataire=request.user) | Q(destinataire__isnull=True, role_cible__in=[role, 'tous']))
    return JsonResponse({'ok': True, 'notifs': [{'id': n.id, 'icone': n.icone, 'titre': n.titre,
        'texte': n.texte, 'goto': n.goto_view, 'lu': n.lu, 'date': n.created_at.strftime('%d/%m %H:%M')}
        for n in qs[:30]], 'non_lues': qs.filter(lu=False).count()})

@require_POST
@role_required(['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE'])
def mark_all_read(request):
    from django.db.models import Q
    role = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}[request.user.role]
    Notif.objects.filter(Q(destinataire=request.user) | Q(destinataire__isnull=True, role_cible__in=[role, 'tous']), lu=False).update(lu=True)
    return JsonResponse({'ok': True})

@role_required(['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE'])
def open_notification(request, pk):
    n = get_object_or_404(Notif, pk=pk)
    role = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}[request.user.role]
    if n.destinataire_id not in (None, request.user.pk) or (n.destinataire_id is None and n.role_cible not in (role, 'tous')):
        return redirect('dashboard')
    n.lu = True
    n.save(update_fields=['lu'])
    target = {'PREMIERE_LIGNE': '/premiere-ligne/', 'MEDECIN': '/medecin/', 'PILOTAGE': '/pilotage/'}[request.user.role]
    if n.goto_view:
        target += '?view=' + n.goto_view
    return redirect(target)
