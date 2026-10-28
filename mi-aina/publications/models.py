from django.conf import settings
from django.db import models


class Publication(models.Model):
    """Post du médecin OU du Pilotage — lu par TOUS les rôles (feed Publications)."""
    TYPE = [('texte','Texte'),('image','Image'),('video','Vidéo'),('pdf','Guide PDF'),('protocole','Protocole')]

    type     = models.CharField(max_length=10, choices=TYPE, default='texte')
    titre    = models.CharField(max_length=150)
    resume   = models.TextField()
    fichier  = models.FileField(upload_to='publications/', blank=True)
    epingle  = models.BooleanField(default=False)          # protocole officiel épinglé
    auteur   = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
                                 related_name='publications')  # MEDECIN ou PILOTAGE
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-epingle', '-created_at']

    def __str__(self):
        return self.titre

    @property
    def fichier_url(self):
        return self.fichier.url if self.fichier else ''

    @property
    def fichier_nom(self):
        return self.fichier.name.rsplit('/', 1)[-1] if self.fichier else ''


class PublicationLu(models.Model):
    """Accusé de lecture (peut être créé hors-ligne puis synchronisé)."""
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='lectures')
    agent       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='publications_lues')
    lu_le       = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('publication', 'agent')