import json as _json
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from core.decorators import role_required
from notifications.models import Notif
from .models import Thread, Message


def _body(request):
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


def _is_image(name):
    return (name or '').lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif'))


def _ser_msg(m, user):
    mine = (m.sender_id == user.id)
    return {
        'id': m.id, 'me': mine,
        'texte': ('Message supprimé' if m.supprime else m.texte),
        'supprime': m.supprime,
        'audio': bool(m.audio), 'duree': m.duree_audio or 0,
        'fichier': m.fichier.url if m.fichier else '',
        'nom_fichier': m.nom_fichier,
        'is_image': _is_image(m.nom_fichier),
        'reply': ({'texte': (m.reply_to.texte or '[pièce jointe]')[:80],
                   'me': m.reply_to.sender_id == user.id}
                  if m.reply_to_id and m.reply_to and not m.reply_to.supprime else None),
        'time': m.created_at.strftime('%H:%M'),
    }


def _notify_other(t, sender, apercu):
    other = t.medecin if sender.id == t.agent_id else t.agent
    if not other:
        return
    Notif.objects.create(destinataire=other, icone='message-circle',
        titre='Nouveau message — ' + str(sender),
        texte=apercu[:100],
        goto_view='triage' if other.role == 'MEDECIN' else 'messagerie')


ESPACE_PAR_ROLE = {
    'PREMIERE_LIGNE': '/premiere-ligne/',
    'MEDECIN': '/medecin/',
    'PILOTAGE': '/pilotage/',
}


def inbox(request):
    """Point d’entrée /messaging/ — ouvre la messagerie simple."""
    from django.shortcuts import redirect
    return redirect('msg_boite')


@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def thread_messages(request, pk):
    """GET — messages du thread (marque les reçus comme lus)."""
    t = Thread.objects.filter(pk=pk).first()
    if not t:
        return JsonResponse({'ok': False, 'erreur': 'Conversation introuvable.'}, status=404)
    if request.user.id not in (t.agent_id, t.medecin_id):
        return JsonResponse({'ok': False, 'erreur': 'Accès refusé.'}, status=403)
    Message.objects.filter(thread=t).exclude(sender=request.user).update(lu=True)
    return JsonResponse({'ok': True, 'items': [
        _ser_msg(m, request.user) for m in t.messages.all()]})


@require_POST
@role_required('PREMIERE_LIGNE')
def thread_create(request):
    """POST {medecin_id} — ouvre un fil terrain sans démarrer une visio."""
    data = _body(request)
    medecin = (get_user_model().objects.filter(
        pk=data.get('medecin_id'), role='MEDECIN', statut='ACTIF').first())
    if not medecin:
        return JsonResponse({'ok': False, 'erreur': 'Médecin introuvable ou indisponible.'}, status=404)
    thread, _ = Thread.objects.get_or_create(agent=request.user, medecin=medecin)
    return JsonResponse({'ok': True, 'thread': thread.pk})


@require_POST
@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def message_send(request, pk):
    """POST multipart : texte et/ou fichier (sans limite de taille) + réponse citée."""
    t = Thread.objects.filter(pk=pk).first()
    if not t:
        return JsonResponse({'ok': False, 'erreur': 'Conversation introuvable.'}, status=404)
    if request.user.id not in (t.agent_id, t.medecin_id):
        return JsonResponse({'ok': False, 'erreur': 'Accès refusé.'}, status=403)
    data = _body(request)
    texte = (request.POST.get('texte') or data.get('texte') or '').strip()
    piece = request.FILES.get('piece')
    reply_id = request.POST.get('reply_to') or data.get('reply_to')
    # Note vocale envoyée en JSON par le terminal terrain : {vocal:true, duree:N}
    if data.get('vocal') and not texte:
        d = int(data.get('duree') or 0)
        texte = 'Note vocale — 0′' + str(d % 60).zfill(2)
    if not texte and not piece:
        return JsonResponse({'ok': False, 'erreur': 'Message vide.'}, status=400)

    m = Message.objects.create(thread=t, sender=request.user, texte=texte)
    if data.get('vocal'):
        m.duree_audio = int(data.get('duree') or 0)
        m.save(update_fields=['duree_audio'])
    if piece:
        m.fichier.save(piece.name, piece, save=True)
        m.nom_fichier = piece.name
        m.save()
    if reply_id:
        m.reply_to = Message.objects.filter(pk=reply_id, thread=t).first()
        m.save(update_fields=['reply_to'])

    apercu = 'Note vocale' if m.audio else ('Pièce jointe : ' + m.nom_fichier if m.fichier else texte)
    _notify_other(t, request.user, apercu)

    return JsonResponse({'ok': True, 'msg': _ser_msg(m, request.user)})


@require_POST
@role_required(['PREMIERE_LIGNE', 'MEDECIN'])
def message_delete(request, pk):
    """Soft delete — SEUL l'auteur peut supprimer (traçabilité sanitaire)."""
    m = Message.objects.filter(pk=pk, sender=request.user).first()
    if not m:
        return JsonResponse({'ok': False,
            'erreur': 'Seul l\u2019auteur peut supprimer un message.'}, status=403)
    m.supprime = True
    m.texte = ''
    m.save(update_fields=['supprime', 'texte'])
    return JsonResponse({'ok': True})