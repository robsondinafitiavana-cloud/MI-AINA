# -*- coding: utf-8 -*-
"""MI-AINA — formulaires Django de la messagerie simple (aucun JavaScript)."""
from django import forms
from django.contrib.auth import get_user_model

from .models import Fil

User = get_user_model()

ROLE_ORDRE = {'MEDECIN': 0, 'PILOTAGE': 1, 'PREMIERE_LIGNE': 2}


class NouveauFilForm(forms.Form):
    """Ouvre une conversation avec un correspondant et envoie le premier message."""

    destinataire = forms.ModelChoiceField(queryset=User.objects.none(),
                                          label='Destinataire',
                                          empty_label='— Choisir un correspondant —')
    titre = forms.CharField(max_length=150, required=False, label='Objet (facultatif)')
    message = forms.CharField(widget=forms.Textarea(attrs={'rows': 3}),
                              label='Message', max_length=4000)

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        qs = User.objects.filter(statut='ACTIF').exclude(pk=getattr(user, 'pk', None))
        qs = sorted(qs, key=lambda u: (ROLE_ORDRE.get(u.role, 9), (u.nom or '').lower()))
        self.fields['destinataire'].queryset = User.objects.filter(
            pk__in=[u.pk for u in qs])

    def clean_message(self):
        v = (self.cleaned_data.get('message') or '').strip()
        if not v:
            raise forms.ValidationError('Le message ne peut pas être vide.')
        return v


class MessageFilForm(forms.Form):
    """Un message textuel ou une pièce jointe (ou les deux)."""

    texte = forms.CharField(widget=forms.Textarea(attrs={'rows': 2}),
                            label='Message', max_length=4000, required=False)
    piece = forms.FileField(required=False, label='Pièce jointe')

    def clean_texte(self):
        v = (self.cleaned_data.get('texte') or '').strip()
        return v

    def clean(self):
        data = super().clean()
        if not data.get('texte') and not data.get('piece'):
            raise forms.ValidationError('Ajoutez un texte ou une pièce jointe.')
        return data
