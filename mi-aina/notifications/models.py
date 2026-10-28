from django.db import models
from django.conf import settings


class Notif(models.Model):
    """Notification ciblée — vers un agent ou un médecin."""
    CIBLE = [('agent','Agent'),('medecin','Médecin'),('tous','Tous')]

    destinataire = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.CASCADE, related_name='notifs')
    role_cible   = models.CharField(max_length=8, choices=CIBLE, default='agent')  # fallback si destinataire NULL
    icone        = models.CharField(max_length=30, default='bell')   # nom lucide
    titre        = models.CharField(max_length=120)
    texte        = models.TextField(blank=True)
    goto_view    = models.CharField(max_length=30, blank=True)       # vue du dashboard à ouvrir
    lu           = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']