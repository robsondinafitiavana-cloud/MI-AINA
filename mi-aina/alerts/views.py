from django.http import JsonResponse
from django.db import transaction
from django.views.decorators.http import require_POST

from core.decorators import role_required
from .models import Alerte
from reports.models import Signalement


@require_POST
@role_required('PILOTAGE')
@transaction.atomic
def traiter(request, pk):
    a = Alerte.objects.filter(pk=pk, traitee=False).first()
    if not a:
        return JsonResponse({'ok': False, 'erreur': 'Alerte introuvable.'}, status=404)
    a.traitee = True
    a.traitee_par = request.user
    a.save(update_fields=['traitee', 'traitee_par'])
    if a.signalement_id and a.signalement.statut == 'TRANSMIS':
        Signalement.objects.filter(pk=a.signalement_id, statut='TRANSMIS').update(statut='PRIS_EN_CHARGE')
    return JsonResponse({'ok': True})
