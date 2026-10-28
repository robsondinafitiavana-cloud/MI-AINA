from django.conf import settings
from django.db import models


class Ressource(models.Model):
    TYPE = [('video', 'Vidéo'), ('pdf', 'Guide PDF')]
    titre = models.CharField(max_length=150)
    type = models.CharField(max_length=6, choices=TYPE)
    fichier = models.FileField(upload_to='formation/', blank=True)
    duree = models.CharField(max_length=10, blank=True)     # '12:34' ou 'PDF · 6 p.'
    resume = models.TextField(blank=True)
    publie_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='ressources',
                                   limit_choices_to={'role': 'MEDECIN'})
    vues = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class ForumPost(models.Model):
    question = models.TextField()
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='forum_posts')
    tags = models.CharField(max_length=120, blank=True)      # 'PÉDIATRIE,POSOLOGIE'
    created_at = models.DateTimeField(auto_now_add=True)


class ForumReply(models.Model):
    post = models.ForeignKey(ForumPost, on_delete=models.CASCADE, related_name='reponses')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='forum_replies')
    reponse = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)