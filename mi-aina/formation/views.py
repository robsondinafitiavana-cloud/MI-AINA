"""Mi-AINA — formation : ressources, forum médical (lecture/écriture)."""
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from core.decorators import role_required
from core.utils import body as _body
from notifications.models import Notif
from .models import ForumPost, ForumReply, Ressource

MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
           'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
LECTURE = ['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE']
ECRITURE = LECTURE


def _fmt(dt):
    return f'{dt.day} {MOIS_FR[dt.month - 1]}' if dt else '—'


def _tags(raw):
    return [t.strip() for t in (raw or '').split(',') if t.strip()]


def _ser_post(p, user=None):
    return {
        'id': p.id,
        'question': p.question,
        'auteur': str(p.auteur),
        'auteur_role': p.auteur.get_role_display() if p.auteur else '—',
        'auteur_role_code': p.auteur.role if p.auteur else '',
        'auteur_photo': p.auteur.photo.url if p.auteur and p.auteur.photo else '',
        'tags': p.tags,
        'date': _fmt(p.created_at),
        'reponses': p.reponses.count(),
        'reponses_list': [{
            'id': r.id, 'reponse': r.reponse, 'auteur': str(r.auteur),
            'auteur_role': r.auteur.get_role_display() if r.auteur else '—',
            'auteur_role_code': r.auteur.role if r.auteur else '',
            'auteur_photo': r.auteur.photo.url if r.auteur and r.auteur.photo else '',
            'date': _fmt(r.created_at),
        } for r in p.reponses.select_related('auteur')[:50]],
    }


@role_required(LECTURE)
def forum_list(request):
    """GET — sujets du forum, du plus récent au plus ancien."""
    q = (request.GET.get('q') or '').strip().lower()
    posts = ForumPost.objects.select_related('auteur').prefetch_related('reponses__auteur')
    items = []
    for p in posts[:100]:
        if q and q not in (f'{p.question} {p.tags} {p.auteur}'.lower()):
            continue
        items.append(_ser_post(p, request.user))
    return JsonResponse({'ok': True, 'items': items[:40]})


@require_POST
@role_required(ECRITURE)
def forum_create(request):
    """POST {question, tags?} — ouvre un sujet (médecin ou pilotage)."""
    data = _body(request)
    question = (data.get('question') or '').strip()
    if len(question) < 8:
        return JsonResponse({'ok': False,
                             'erreur': 'Formulez la question en 8 caractères minimum.'}, status=400)
    if len(question) > 8000:
        return JsonResponse({'ok': False, 'erreur': 'Le sujet est trop long (8 000 caractères maximum).'}, status=400)
    p = ForumPost.objects.create(question=question,
                                 auteur=request.user,
                                 tags=(data.get('tags') or '')[:120])
    from accounts.models import Compte
    for destinataire in Compte.objects.filter(statut='ACTIF', role__in=LECTURE).exclude(pk=request.user.pk):
        Notif.objects.create(destinataire=destinataire, icone='messages-square',
                             titre='Nouveau sujet au Forum médical',
                             texte=question[:100], goto_view='forum')
    return JsonResponse({'ok': True, 'post': _ser_post(p, request.user)})


@require_POST
@role_required(LECTURE)
def forum_reply(request, pk):
    """POST {reponse} — réponse à un sujet existant."""
    p = ForumPost.objects.filter(pk=pk).first()
    if not p:
        return JsonResponse({'ok': False, 'erreur': 'Sujet introuvable.'}, status=404)
    reponse = (_body(request).get('reponse') or '').strip()
    if not reponse:
        return JsonResponse({'ok': False, 'erreur': 'Réponse vide.'}, status=400)
    if len(reponse) > 8000:
        return JsonResponse({'ok': False, 'erreur': 'La réponse est trop longue (8 000 caractères maximum).'}, status=400)
    r = ForumReply.objects.create(post=p, auteur=request.user, reponse=reponse)
    from accounts.models import Compte
    recipients = {p.auteur_id}
    recipients.update(p.reponses.exclude(pk=r.pk).values_list('auteur_id', flat=True).distinct())
    for participant in Compte.objects.filter(pk__in=recipients).exclude(pk=request.user.pk):
        Notif.objects.create(destinataire=participant, icone='messages-square',
                             titre='Nouvelle réponse au Forum médical',
                             texte=p.question[:100], goto_view='forum')
    return JsonResponse({'ok': True, 'post': _ser_post(p, request.user),
                         'reply': {'id': r.id, 'auteur': str(r.auteur), 'date': _fmt(r.created_at)}})


@role_required(LECTURE)
def ressources_list(request):
    """GET — supports de formation (vidéos, guides PDF)."""
    return JsonResponse({'ok': True, 'items': [{
        'id': r.id, 'titre': r.titre, 'type': r.type, 'duree': r.duree,
        'resume': r.resume, 'vues': r.vues, 'date': _fmt(r.created_at),
        'fichier': r.fichier.url if r.fichier else '',
    } for r in Ressource.objects.all()[:50]]})
