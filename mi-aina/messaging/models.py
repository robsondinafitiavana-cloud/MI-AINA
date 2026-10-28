from django.conf import settings
from django.db import models


class Thread(models.Model):
    """Fil terrain : agent de première ligne <-> médecin (rôles imposés)."""
    agent  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='threads_agent', limit_choices_to={'role':'PREMIERE_LIGNE'})
    medecin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='threads_medecin', limit_choices_to={'role':'MEDECIN'})
    maj_le = models.DateTimeField(auto_now=True)

    def __str__(self): return f'{self.agent} ↔ {self.medecin}'


class Message(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    texte  = models.TextField(blank=True)
    audio  = models.FileField(upload_to='vocaux/%Y/%m/', blank=True)
    duree_audio   = models.PositiveSmallIntegerField(null=True, blank=True)
    transcription = models.TextField(blank=True)
    fichier   = models.FileField(upload_to='msg_fichiers/%Y/%m/', blank=True)   # images, PDF… SANS limite de taille
    nom_fichier = models.CharField(max_length=200, blank=True)
    reply_to  = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reponses')
    supprime  = models.BooleanField(default=False)     # soft delete — bulle « Message supprimé »
    lu        = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class Fil(models.Model):
    """Fil inter-rôles (participants libres) — ouvre la messagerie au Pilotage."""
    titre    = models.CharField(max_length=150, blank=True)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='fils')
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name='fils_crees')
    maj_le   = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-maj_le']

    def __str__(self):
        return self.titre or ' · '.join(str(u) for u in self.participants.all()[:3])


class MessageFil(models.Model):
    """Message d'un fil inter-rôles (texte et/ou pièce jointe)."""
    fil    = models.ForeignKey(Fil, on_delete=models.CASCADE, related_name='messages')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='messages_fils')
    texte  = models.TextField(blank=True)
    fichier     = models.FileField(upload_to='fils_fichiers/%Y/%m/', blank=True)
    nom_fichier = models.CharField(max_length=200, blank=True)
    supprime    = models.BooleanField(default=False)
    lu          = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return (self.texte or self.nom_fichier or 'message')[:60]