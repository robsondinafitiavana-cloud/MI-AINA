from django.db.models import Q
from .models import Notif


def notification_summary(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated or not hasattr(user, 'role'):
        return {'global_notifs': [], 'global_unread_count': 0}
    role = {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin', 'PILOTAGE': 'pilotage'}.get(user.role)
    qs = Notif.objects.filter(Q(destinataire=user) | Q(destinataire__isnull=True, role_cible__in=[role, 'tous']))
    return {'global_notifs': qs[:10], 'global_unread_count': qs.filter(lu=False).count()}
