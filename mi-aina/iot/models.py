from django.conf import settings
from django.db import models
from django.db.models import Q

class Device(models.Model):
    STATUT_CHOICES = [('CONNECTÉ','Connecté'),('EN PRÊT','En prêt'),('HORS LIGNE','Hors ligne')]
    code = models.CharField(max_length=64, unique=True)                # Identifiant matériel, ex. MI-AINA-ESP32-001
    nom  = models.CharField(max_length=60)                             # Boîtier ESP32 #14
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default='HORS LIGNE')
    actif = models.BooleanField(default=True)
    is_simulated = models.BooleanField(default=False, help_text='Boîtier virtuel réservé aux démonstrations.')
    token_hash = models.CharField(max_length=128, blank=True, default='')
    derniere_communication = models.DateTimeField(null=True, blank=True)
    batterie = models.PositiveSmallIntegerField(default=100)           # %
    signal   = models.PositiveSmallIntegerField(default=0)             # 0-3 barres
    firmware = models.CharField(max_length=12, default='v2.3.1')
    csb      = models.ForeignKey('csb.CSB', null=True, on_delete=models.SET_NULL)
    assigne_a = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name='devices')
    created_at = models.DateTimeField(auto_now_add=True)

class Measure(models.Model):
    SOURCE_CHOICES = [('REAL', 'Matériel réel'), ('SIMULATION', 'Simulation')]
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='mesures')
    patient = models.ForeignKey('patients.Patient', null=True, blank=True, on_delete=models.SET_NULL)
    consultation = models.ForeignKey('consultations.Consultation', null=True, blank=True, on_delete=models.SET_NULL)
    # Retained for existing records; the new ESP32 API currently records only
    # infrared temperature and raw AD8232 samples.
    spo2 = models.PositiveSmallIntegerField(null=True, blank=True)
    temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    ecg_brut = models.PositiveSmallIntegerField(null=True, blank=True)
    electrodes_connectees = models.BooleanField(null=True, blank=True)
    bpm = models.PositiveSmallIntegerField(null=True, blank=True)  # Never set from one raw ECG sample.
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default='REAL')
    ecg_signal = models.JSONField(null=True, blank=True, help_text='Fenêtre ECG synthétique (source SIMULATION uniquement).')
    synchronise = models.BooleanField(default=False)      # False = file locale (hors-ligne)
    event_id = models.UUIDField(null=True, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Mesures'
        constraints = [
            models.UniqueConstraint(
                fields=['device', 'event_id'],
                condition=Q(event_id__isnull=False),
                name='uniq_iot_measure_device_event',
            ),
        ]
