# -*- coding: utf-8 -*-
"""MI-AINA — messagerie simple : vues Django classiques (render / redirect).

Aucun appel AJAX : on affiche un template, on poste un formulaire, on redirige.
Modèle utilisé : Fil / MessageFil (participants libres -> les 3 rôles).
"""
from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect, render

from core.decorators import role_required
from notifications.models import Notif
from .forms import MessageFilForm, NouveauFilForm
from .models import Fil, MessageFil
from .services import importer_fils_historiques

ROLES = ['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE']


def _lien_fil(f, moi):
    """Résumé d'une conversation pour la liste."""
    msgs = list(f.messages.all())
    autres = [p for p in f.participants.all() if p.pk != moi.pk]
    dernier = msgs[-1] if msgs else None
    return {
        'fil': f,
        'autres': autres,
        'titre': f.titre or ', '.join(p.nom_court for p in autres) or 'Conversation',
        'dernier': dernier,
        'n': len(msgs),
        'non_lus': sum(1 for m in msgs if not m.lu and m.auteur_id != moi.pk),
    }


def _membre(user, pk):
    """Le fil demandé, ou None si l'utilisateur n'y participe pas."""
    f = get_object_or_404(Fil, pk=pk)
    if not f.participants.filter(pk=user.pk).exists():
        return None
    return f


def _prevenir(f, auteur, apercu):
    """Notifie les AUTRES participants (jamais l'auteur)."""
    for p in f.participants.exclude(pk=auteur.pk):
        Notif.objects.create(destinataire=p, icone='message-circle',
                             titre='Nouveau message — ' + str(auteur),
                             texte=apercu[:100], goto_view='messagerie')


@role_required(ROLES)
def boite(request):
    """Liste des conversations de l'utilisateur connecté."""
    importer_fils_historiques(request.user)
    fils = [_lien_fil(f, request.user)
            for f in Fil.objects.filter(participants=request.user)
                                .prefetch_related('participants', 'messages__auteur')]
    return render(request, 'messaging/boite.html', {'fils': fils})


@role_required(ROLES)
def boite_nouveau(request):
    """Créer une conversation puis poster le premier message."""
    form = NouveauFilForm(request.POST or None, user=request.user)
    if request.method == 'POST' and form.is_valid():
        dest = form.cleaned_data['destinataire']
        wanted = {request.user.pk, dest.pk}
        f = next((candidate for candidate in
                  Fil.objects.filter(participants=request.user).prefetch_related('participants')
                  if {p.pk for p in candidate.participants.all()} == wanted), None)
        if f is None:
            f = Fil.objects.create(titre=form.cleaned_data.get('titre', '')[:150],
                                   cree_par=request.user)
        if not f.participants.filter(pk=request.user.pk).exists():
            f.participants.add(request.user)
        f.participants.add(dest)
        MessageFil.objects.create(fil=f, auteur=request.user,
                                  texte=form.cleaned_data['message'])
        f.save(update_fields=['maj_le'])
        _prevenir(f, request.user, form.cleaned_data['message'])
        messages.success(request, 'Message envoyé à %s.' % dest.nom_court, 'success')
        return redirect('msg_boite_fil', pk=f.pk)
    return render(request, 'messaging/nouveau.html', {'form': form})


@role_required(ROLES)
def boite_fil(request, pk):
    """Conversation : affichage (GET) et envoi d'un message (POST)."""
    f = _membre(request.user, pk)
    if f is None:
        return render(request, 'messaging/refus.html', status=403)
    form = MessageFilForm(request.POST or None, request.FILES or None)
    if request.method == 'POST' and form.is_valid():
        m = MessageFil.objects.create(fil=f, auteur=request.user,
                                      texte=form.cleaned_data['texte'])
        piece = form.cleaned_data.get('piece')
        if piece:
            m.fichier.save(piece.name, piece, save=True)
            m.nom_fichier = piece.name
            m.save(update_fields=['nom_fichier'])
        f.save(update_fields=['maj_le'])
        apercu = ('Pièce jointe : ' + m.nom_fichier) if m.fichier else m.texte
        _prevenir(f, request.user, apercu)
        return redirect('msg_boite_fil', pk=f.pk)

    f.messages.exclude(auteur=request.user).update(lu=True)
    msgs = f.messages.select_related('auteur')
    return render(request, 'messaging/fil.html', {
        'fil': f, 'messages': msgs, 'form': form,
        'autres': [p for p in f.participants.all() if p.pk != request.user.pk],
    })
