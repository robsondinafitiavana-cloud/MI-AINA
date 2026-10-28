from django.conf import settings
from django.db import models

class Consultation(models.Model):
    STATUT_CHOICES = [('EN_ATTENTE','En attente'),('EN_COURS','En cours'),('VALIDEE','Validée'),
                      ('ORIENTEE','Orientée'),('TERMINEE','Terminée')]
    SEV_CHOICES = [('','—'),('MODERÉ','Modéré'),('PRÉOCCUPANT','Préoccupant'),('URGENT','Urgent'),('CRITIQUE','Critique')]

    patient = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, related_name='consultations')
    premiere_ligne = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
                                       related_name='consultations_terrain')
    medecin = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='consultations_medical')     # NULL tant que non prise en charge
    medecin_prefere = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='consultations_preferees')
    date = models.DateTimeField(auto_now_add=True)
    motif = models.CharField(max_length=200)
    symptomes = models.TextField(blank=True)                 # texte dicté malagasy structuré
    observation = models.TextField(blank=True)
    duree = models.CharField(max_length=60, blank=True)
    exams_suggeres = models.CharField(max_length=200, blank=True)
    severite = models.CharField(max_length=12, choices=SEV_CHOICES, blank=True)

    # suggestion IA ( Whisper + LLM) — bloc « Valider l'IA » du design Médecin
    ia_diagnostic = models.CharField(max_length=200, blank=True)
    ia_confiance  = models.PositiveSmallIntegerField(null=True, blank=True)
    ia_validee    = models.BooleanField(default=False)
    statut = models.CharField(max_length=12, choices=STATUT_CHOICES, default='EN_ATTENTE')
    # Chaîne vocale IA
    ia_transcription = models.TextField(blank=True)          # texte brut STT
    ia_engine        = models.CharField(max_length=12, blank=True)  # whisper|webspeech|manuel
    agent_modified   = models.BooleanField(default=False)     # l'agent a corrigé la prédiction

    # Épidémie (case à cocher agent -> alerte Pilotage)
    epidemic_suspect = models.BooleanField(default=False)
    epidemic_type    = models.CharField(max_length=40, blank=True)

    # Routage automatique
    routed_reason    = models.CharField(max_length=60, blank=True)  # 'Médecin du CSB' | 'Même région' | 'Garde nationale'
    # orientation (décision Médecin)
    orientee_vers   = models.CharField(max_length=10, blank=True, choices=[('CSB','CSB'),('HÔPITAL','Hôpital')])
    orientee_struct = models.CharField(max_length=150, blank=True)
    orientee_note   = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class Ordonnance(models.Model):
    consultation = models.OneToOneField(Consultation, on_delete=models.CASCADE, related_name='ordonnance')
    contenu   = models.TextField()                       # une ligne par médicament + posologie
    suivi     = models.CharField(max_length=120, blank=True)
    rdv_date  = models.DateField(null=True, blank=True)
    signee_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    remise    = models.BooleanField(default=False)        # « Remise au patient » côté Agent
    created_at = models.DateTimeField(auto_now_add=True)
    maj_le     = models.DateTimeField(auto_now=True)

