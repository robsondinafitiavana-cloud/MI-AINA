from django.conf import settings
from django.db import models

class CallSession(models.Model):
    agent   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appels_agent')
    medecin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appels_medecin')
    consultation = models.ForeignKey('consultations.Consultation', null=True, blank=True, on_delete=models.SET_NULL)
    mode_eco    = models.BooleanField(default=True)      # « ÉCO · 240p · 3G »
    started_at  = models.DateTimeField(auto_now_add=True)
    ended_at    = models.DateTimeField(null=True, blank=True)
    resume      = models.TextField(blank=True)           # joint au dossier à la fin