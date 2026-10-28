from django.conf import settings
from django.db import models


class TranscriptionLog(models.Model):
    """Journal de chaque passage vocal — audit + amélioration des modèles."""
    MOTEUR = [('whisper', 'faster-whisper'), ('webspeech', 'Web Speech'), ('manuel', 'Manuel')]

    agent    = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
                                 related_name='transcriptions')
    moteur   = models.CharField(max_length=12, choices=MOTEUR)
    langue   = models.CharField(max_length=8, blank=True)      # mg-MG, fr-FR
    duree_s  = models.PositiveSmallIntegerField(default=0)
    texte    = models.TextField(blank=True)
    duree_traitement_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']