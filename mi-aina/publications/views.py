"""Mi-AINA — publications : le médecin ET le pilotage publient, tout le monde lit."""
from django.http import JsonResponse
from pathlib import Path
from django.views.decorators.http import require_POST

from core.decorators import role_required
from core.utils import body as _body
from notifications.models import Notif
from .models import Publication, PublicationLu

LECTURE = ['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE']
REDACTION = ['MEDECIN', 'PILOTAGE']


def _fmt_date(dt):
    """Date et heure lisibles dans le fil, portable Windows/Linux."""
    if not dt:
        return '—'
    return dt.strftime('%d/%m/%Y · %H:%M')


def _ser(p, user):
    lu = bool(user.is_authenticated and
              PublicationLu.objects.filter(publication=p, agent=user).exists())
    return {
        'id': p.id, 'titre': p.titre, 'type': p.type, 'resume': p.resume,
        'vues': p.lectures.count(), 'epingle': p.epingle,
        'auteur': f'{p.auteur.prenom} {p.auteur.nom}' if p.auteur else '—',
        'auteur_role': p.auteur.get_role_display() if p.auteur else '—',
        'auteur_role_code': p.auteur.role if p.auteur else '',
        'auteur_prenom': p.auteur.prenom if p.auteur else '',
        'auteur_photo': p.auteur.photo.url if p.auteur and p.auteur.photo else '',
        'created': _fmt_date(p.created_at),
        'fichier_url': p.fichier_url,
        'fichier_nom': p.fichier_nom,
        'lu': lu,
    }


@role_required(LECTURE)
def feed(request):
    """Feed commun — agents, médecins et pilotage lisent les mêmes publications."""
    return JsonResponse({'ok': True,
                         'items': [_ser(p, request.user) for p in Publication.objects.all()[:40]]})


@require_POST
@role_required(REDACTION)
def publish(request):
    """Publication d'une formation — notifie les agents (et les médecins si pilotage)."""
    data = _body(request)
    titre = (data.get('titre') or '').strip()
    resume = (data.get('resume') or '').strip()
    type_ = data.get('type') or 'texte'
    if not titre or not resume:
        return JsonResponse({'ok': False, 'erreur': 'Le titre et le contenu sont obligatoires.'}, status=400)
    if type_ not in dict(Publication.TYPE):
        return JsonResponse({'ok': False, 'erreur': 'Type de publication invalide.'}, status=400)

    fichier = request.FILES.get('fichier')
    extension = Path(fichier.name).suffix.lower() if fichier else ''
    extensions = {
        'image': {'.png', '.jpg', '.jpeg', '.gif', '.webp'},
        'video': {'.mp4', '.webm', '.ogv', '.mov'},
        'pdf': {'.pdf'},
        'protocole': {'.pdf'},
    }
    if type_ in ('image', 'video', 'pdf') and not fichier:
        return JsonResponse({'ok': False, 'erreur': 'Joignez le fichier correspondant au type choisi.'}, status=400)
    if fichier and extension not in extensions.get(type_, set()):
        return JsonResponse({'ok': False, 'erreur': 'Le format du fichier ne correspond pas au type de publication.'}, status=400)
    p = Publication.objects.create(titre=titre[:150], type=type_, resume=resume,
                                   fichier=fichier, auteur=request.user)
    PublicationLu.objects.get_or_create(publication=p, agent=request.user)
    auteur = f'Dr {request.user.nom}' if request.user.role == 'MEDECIN' else str(request.user)
    Notif.objects.create(
        role_cible='tous' if request.user.role == 'PILOTAGE' else 'agent',
        icone='graduation-cap',
        titre='Nouvelle formation disponible',
        texte='« ' + p.titre + ' » — ' + auteur,
        goto_view='formations',
    )
    return JsonResponse({'ok': True, 'publication': {
        'id': p.id, 'titre': p.titre, 'type': p.type, 'resume': p.resume,
        'vues': 0, 'epingle': p.epingle, 'auteur': f'{request.user.prenom} {request.user.nom}',
        'auteur_prenom': request.user.prenom,
        'auteur_photo': request.user.photo.url if request.user.photo else '',
        'auteur_role': request.user.get_role_display(),
        'auteur_role_code': request.user.role,
        'created': 'à l\u2019instant',
        'fichier_url': p.fichier_url,
        'fichier_nom': p.fichier_nom,
    }})


@require_POST
@role_required(LECTURE)
def marquer_lu(request, pk):
    """Accusé de lecture — peut arriver via la file hors-ligne."""
    p = Publication.objects.filter(pk=pk).first()
    if not p:
        return JsonResponse({'ok': False, 'erreur': 'Publication introuvable.'}, status=404)
    PublicationLu.objects.get_or_create(publication=p, agent=request.user)
    return JsonResponse({'ok': True, 'vues': p.lectures.count()})
