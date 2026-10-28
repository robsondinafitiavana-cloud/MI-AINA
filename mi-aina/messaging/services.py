"""Helpers that keep historical messaging records available in Fil."""
from django.db import transaction

from .models import Fil, MessageFil, Thread


def importer_fils_historiques(user):
    """Copy old agent/doctor threads into the shared Fil inbox once per pair.

    Original Thread and Message rows are deliberately retained. This lets the
    three-role inbox show existing history without changing the database schema.
    """
    with transaction.atomic():
        legacy_threads = (Thread.objects.select_for_update()
                          .filter(agent=user) if user.role == 'PREMIERE_LIGNE'
                          else Thread.objects.select_for_update().filter(medecin=user)
                          if user.role == 'MEDECIN' else Thread.objects.none())
        for thread in legacy_threads.prefetch_related('messages'):
            pair = {thread.agent_id, thread.medecin_id}
            existing = None
            for candidate in (Fil.objects.filter(participants=user)
                              .prefetch_related('participants')):
                if {p.pk for p in candidate.participants.all()} == pair:
                    existing = candidate
                    break
            if existing:
                continue

            fil = Fil.objects.create(cree_par=thread.agent)
            fil.participants.add(thread.agent, thread.medecin)
            copies = []
            for old in thread.messages.all():
                file_name = old.fichier.name if old.fichier else old.audio.name if old.audio else ''
                visible_name = (old.nom_fichier or file_name.rsplit('/', 1)[-1]) if file_name else ''
                copies.append(MessageFil(
                    fil=fil,
                    auteur=old.sender,
                    texte=old.texte,
                    fichier=file_name,
                    nom_fichier=visible_name,
                    supprime=old.supprime,
                    lu=old.lu,
                    created_at=old.created_at,
                ))
            if copies:
                MessageFil.objects.bulk_create(copies)
                # bulk_create applies auto_now_add; restore the original times.
                MessageFil.objects.bulk_update(copies, ['created_at'])
            Fil.objects.filter(pk=fil.pk).update(maj_le=thread.maj_le)
