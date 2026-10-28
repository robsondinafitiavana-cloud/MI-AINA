from django.conf import settings
from django.db import models


class Alerte(models.Model):
    NIVEAU = [('crit', 'Critique'), ('warn', 'Avertissement'), ('info', 'Info')]
    TAGS = [('SÉCURITÉ', 'Sécurité'), ('TRANSMISSION', 'Transmission'), ('COMPTES', 'Comptes'),
            ('SYNCHRO', 'Synchro'), ('RAPPORT', 'Rapport'), ('SYSTÈME', 'Système')]

    niveau = models.CharField(max_length=5, choices=NIVEAU)
    tag = models.CharField(max_length=14, choices=TAGS)
    titre = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    signalement = models.ForeignKey(
        'reports.Signalement', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='alertes_pilotage',
    )
    traitee = models.BooleanField(default=False)
    traitee_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='alertes_traitees')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'[{self.tag}] {self.titre}'
