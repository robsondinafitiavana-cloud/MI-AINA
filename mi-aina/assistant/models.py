from django.conf import settings
from django.db import models


class ChatIA(models.Model):
    """Conversation avec l'assistant AINA (par agent/médecin)."""
    user  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chats_ia')
    titre = models.CharField(max_length=120, default='Nouvelle discussion')
    created_at = models.DateTimeField(auto_now_add=True)

class MsgIA(models.Model):
    """Un tour de conversation. Rôle: 'user' ou 'aina'."""
    chat   = models.ForeignKey(ChatIA, on_delete=models.CASCADE, related_name='messages')
    role   = models.CharField(max_length=6)                     # user | aina
    texte  = models.TextField(blank=True)
    piece  = models.FileField(upload_to='ia_pieces/%Y/%m/', blank=True)   # document joint à AINA
    nom_piece = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
