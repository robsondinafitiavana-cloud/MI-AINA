from functools import wraps
from django.core.exceptions import PermissionDenied


def role_required(*roles):
    """@role_required('PILOTAGE') ou @role_required(['A','B']) — 403 sinon."""
    if len(roles) == 1 and isinstance(roles[0], (list, tuple)):
        roles = tuple(roles[0])

    def deco(view):
        @wraps(view)
        def _w(request, *args, **kwargs):
            u = request.user
            if not u.is_authenticated or u.role not in roles:
                raise PermissionDenied('Accès réservé à un autre rôle.')
            return view(request, *args, **kwargs)
        return _w
    return deco