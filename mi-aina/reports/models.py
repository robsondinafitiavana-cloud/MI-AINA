from django.conf import settings
from django.db import models


class Signalement(models.Model):
    type = models.CharField(max_length=60)          # Paludisme suspecté…
    village = models.CharField(max_length=100)
    nb_cas = models.PositiveSmallIntegerField(default=1)
    note = models.TextField(blank=True)
    statut = models.CharField(max_length=16, default='TRANSMIS',
                              choices=[('TRANSMIS', 'Transmis'), ('EN ATTENTE SYNC', 'En attente sync'),
                                       ('PRIS_EN_CHARGE', 'Pris en charge'), ('ANNULE', 'Annulé')])
    agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='signalements')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.type} · {self.village} ({self.nb_cas} cas)'
