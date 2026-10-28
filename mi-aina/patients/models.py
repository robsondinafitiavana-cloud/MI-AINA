import uuid

from django.conf import settings
from django.db import models


def generer_code_patient():
    return f"PAT-{uuid.uuid4().hex[:6].upper()}"


class Patient(models.Model):
    code_patient = models.CharField(
        max_length=12,
        unique=True,
        default=generer_code_patient
    )

    nom = models.CharField(max_length=100)

    prenom = models.CharField(
        max_length=100,
        blank=True
    )

    date_naissance = models.DateField(
        null=True,
        blank=True
    )

    age = models.PositiveSmallIntegerField(
        default=0
    )

    sexe = models.CharField(
        max_length=1,
        choices=[
            ("M", "M"),
            ("F", "F"),
        ]
    )

    telephone = models.CharField(
        max_length=20,
        blank=True
    )

    adresse = models.CharField(
        max_length=200,
        blank=True
    )

    village = models.CharField(
        max_length=100,
        blank=True
    )

    commune = models.CharField(
        max_length=100,
        blank=True
    )

    district = models.CharField(
        max_length=100,
        blank=True
    )

    region = models.CharField(
        max_length=100,
        blank=True
    )
        # Dénormalisé depuis le CSB de l'agent référent à la création (stats rapides)
    csb      = models.ForeignKey('csb.CSB', null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name='patients_csb')
    district = models.CharField(max_length=100, blank=True)
    region   = models.CharField(max_length=100, blank=True)
    agent_referent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patients",
        limit_choices_to={
            "role": "PREMIERE_LIGNE"
        }
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.code_patient})"


class PatientAccessLog(models.Model):
    ACTION_CHOICES = [('DOSSIER', 'Consultation du dossier'), ('PDF', 'Export PDF')]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='access_logs')
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name='patient_access_logs')
    action = models.CharField(max_length=12, choices=ACTION_CHOICES)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-cree_le']
        indexes = [models.Index(fields=['patient', '-cree_le'], name='p_access_patient_date_idx')]
