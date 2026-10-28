from django.contrib.auth.backends import BaseBackend
from .models import Compte

LOGIN_FIELD = {
    'PREMIERE_LIGNE': 'matricule',
    'MEDECIN': 'numero_ordre',
    'PILOTAGE': 'email',
}


class RoleBackend(BaseBackend):
    """Authentification : (role + identifiant du rôle) → pk en session."""

    def authenticate(self, request, role=None, identifiant=None, password=None, **kwargs):
        if not role or role not in LOGIN_FIELD:
            return None
        try:
            c = Compte.objects.get(role=role, **{LOGIN_FIELD[role]: identifiant})
        except (Compte.DoesNotExist, Compte.MultipleObjectsReturned):
            return None
        if c.check_password(password):
            return c
        return None

    def get_user(self, user_id):
        try:
            return Compte.objects.get(pk=user_id)
        except Compte.DoesNotExist:
            return None