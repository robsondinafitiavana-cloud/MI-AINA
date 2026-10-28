"""Mi-AINA — messagerie inter-rôles (fils ouverts aux comptes PILOTAGE).

Complète `messaging.views` (fils agent <-> médecin) par un fil générique à
participants multiples : le Pilotage peut écrire aux médecins et aux agents,
et voir les conversations qui le concernent.
"""
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from core.decorators import role_required
from core.utils import body as _body
from notifications.models import Notif
from .models import Fil, MessageFil
from .services import importer_fils_historiques

User = get_user_model()

MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
           'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
ROLES_FIL = ['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE']


def _fmt(dt):
    return f'{dt.day} {MOIS_FR[dt.month - 1]}' if dt else '—'


def _is_image(name):
    return (name or '').lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif'))


def _ser(m, user):
    return {
        'id': m.id, 'me': m.auteur_id == user.id,
        'texte': 'Message supprimé' if m.supprime else (m.texte or ''),
        'supprime': m.supprime,
        'fichier': m.fichier.url if m.fichier else '',
        'nom_fichier': m.nom_fichier,
        'is_image': _is_image(m.nom_fichier),
        'auteur': f'{m.auteur.prenom} {m.auteur.nom}' if m.auteur else '—',
        'time': m.created_at.strftime('%H:%M'),
    }


def _autres(f, user):
    return [u for u in f.participants.all() if u.id != user.id]


def _ser_fil(f, user):
    autres = _autres(f, user)
    messages = list(f.messages.all())
    last = messages[-1] if messages else None
    apercu = ''
    if last:
        apercu = ('Message supprimé' if last.supprime
                  else (last.texte or ('Pièce jointe : ' + last.nom_fichier)))
    return {
        'id': f.id,
        'titre': f.titre or ', '.join(str(u) for u in autres) or 'Discussion',
        'participants': [{
            'id': str(u.id), 'nom': f'{u.prenom} {u.nom}', 'role': u.role,
            'role_label': u.get_role_display(),
            'initiales': (u.prenom[:1] + u.nom[:1]).upper(),
            'photo': u.photo.url if u.photo else '',
            'structure': (u.csb.nom if u.csb else (u.etablissement or u.direction or 'National')),
        } for u in autres],
        'initiales': (autres[0].prenom[:1] + autres[0].nom[:1]).upper() if autres else 'MI',
        'photo': autres[0].photo.url if autres and autres[0].photo else '',
        'nom': ', '.join(f'{u.prenom} {u.nom}' for u in autres) or 'Mi-AINA',
        'dernier_message': apercu[:70],
        'dernier_temps': last.created_at.strftime('%H:%M') if last else '',
        'non_lus': sum(1 for message in messages
                       if message.auteur_id != user.id and not message.lu),
        'date': _fmt(f.maj_le),
    }


def _fil_du_membre(request, pk):
    """Renvoie le fil si — et seulement si — l'utilisateur en est participant."""
    f = get_object_or_404(Fil, pk=pk)
    if not f.participants.filter(pk=request.user.pk).exists():
        return None
    return f


def _notifier(f, auteur, apercu):
    for u in _autres(f, auteur):
        Notif.objects.create(
            destinataire=u, icone='message-circle',
            titre='Nouveau message — ' + str(auteur),
            texte=(apercu or '')[:100], goto_view='messagerie')


@role_required(ROLES_FIL)
def fils_list(request):
    """GET — les fils de l'utilisateur, les plus récents d'abord."""
    importer_fils_historiques(request.user)
    fils = (Fil.objects.filter(participants=request.user)
            .prefetch_related('participants', 'messages__auteur'))
    return JsonResponse({'ok': True, 'items': [_ser_fil(f, request.user) for f in fils]})


@role_required(ROLES_FIL)
def annuaire(request):
    """GET — annuaire filtrable par nom, rôle et rattachement territorial."""
    q = (request.GET.get('q') or '').strip()
    region = (request.GET.get('region') or '').strip()
    district = (request.GET.get('district') or '').strip()
    csb = (request.GET.get('csb') or '').strip()
    hopital = (request.GET.get('hopital') or '').strip()
    roles = [role for role in (request.GET.get('roles') or '').split(',')
             if role in ROLES_FIL]
    users = (User.objects.filter(statut='ACTIF')
             .exclude(pk=request.user.pk).select_related('csb'))
    if roles:
        users = users.filter(role__in=roles)
    # Dans l’espace Médecin, les agents proposés sont ceux du même CSB ou
    # établissement. Les médecins collègues restent recherchables par territoire.
    if request.user.role == 'MEDECIN' and 'PREMIERE_LIGNE' in roles:
        agent_scope = Q(pk__in=[])
        if request.user.csb_id:
            agent_scope |= Q(csb_id=request.user.csb_id)
        site = (request.user.etablissement or '').strip()
        if site:
            agent_scope |= Q(etablissement__iexact=site)
        other_roles = [role for role in roles if role != 'PREMIERE_LIGNE']
        users = users.filter(Q(role__in=other_roles) | (Q(role='PREMIERE_LIGNE') & agent_scope))
    for term in q.split():
        users = users.filter(Q(nom__icontains=term) | Q(prenom__icontains=term) |
                             Q(csb__nom__icontains=term) | Q(csb__district__icontains=term) |
                             Q(csb__region__icontains=term) | Q(region__icontains=term) |
                             Q(district__icontains=term) | Q(etablissement__icontains=term) |
                             Q(direction__icontains=term) | Q(role__icontains=term))
    if region:
        users = users.filter(Q(region__icontains=region) | Q(csb__region__icontains=region))
    if district:
        users = users.filter(Q(district__icontains=district) | Q(csb__district__icontains=district))
    if csb:
        users = users.filter(csb__nom__icontains=csb)
    if hopital:
        users = users.filter(etablissement__icontains=hopital)
    items = []
    for u in users.order_by('role', 'nom', 'prenom')[:100]:
        struct = u.csb.nom if u.csb else (u.etablissement or u.direction or 'National')
        district_label = u.district or (u.csb.district if u.csb else '')
        items.append({
            'id': str(u.id), 'nom': f'{u.prenom} {u.nom}',
            'role': u.role, 'role_label': u.get_role_display(),
            'initiales': (u.prenom[:1] + u.nom[:1]).upper(),
            'photo': u.photo.url if u.photo else '',
            'structure': struct, 'region': u.region or (u.csb.region if u.csb else 'National'),
            'district': district_label or 'National',
            'etablissement': u.etablissement or '',
        })
    return JsonResponse({'ok': True, 'items': items[:100]})


@require_POST
@role_required(ROLES_FIL)
def fil_create(request):
    """POST {dest|destinataires[], titre?} — ouvre un fil individuel ou groupé."""
    data = _body(request)
    importer_fils_historiques(request.user)
    if hasattr(data, 'getlist'):
        dests = data.getlist('destinataires') or data.getlist('dest')
    else:
        dests = data.get('destinataires') or data.get('dest')
        if not isinstance(dests, list):
            dests = [dests] if dests else []
    if not dests:
        dest = data.get('participant') or data.get('destinataire')
        dests = [dest] if dest else []
    dests = list(dict.fromkeys(str(dest) for dest in dests if dest))
    if not dests:
        return JsonResponse({'ok': False, 'erreur': 'Destinataire requis.'}, status=400)
    autres = list(User.objects.filter(pk__in=dests, statut='ACTIF'))
    if len(autres) != len(dests):
        return JsonResponse({'ok': False, 'erreur': 'Un destinataire est introuvable ou inactif.'}, status=400)
    if request.user.pk in {u.pk for u in autres}:
        return JsonResponse({'ok': False, 'erreur': 'Impossible de se parler à soi-même.'}, status=400)

    wanted = {request.user.pk, *(u.pk for u in autres)}
    f = next((candidate for candidate in
              Fil.objects.filter(participants=request.user).prefetch_related('participants')
              if {u.pk for u in candidate.participants.all()} == wanted), None)
    if not f:
        f = Fil.objects.create(titre=(data.get('titre') or '')[:150], cree_par=request.user)
        f.participants.add(request.user, *autres)
    return JsonResponse({'ok': True, 'fil': _ser_fil(f, request.user)})


@role_required(ROLES_FIL)
def fil_messages(request, pk):
    """GET — messages du fil (marque les reçus comme lus)."""
    f = _fil_du_membre(request, pk)
    if f is None:
        return JsonResponse({'ok': False, 'erreur': 'Fil inaccessible.'}, status=403)
    f.messages.exclude(auteur=request.user).update(lu=True)
    return JsonResponse({'ok': True, 'items': [
        _ser(m, request.user) for m in f.messages.select_related('auteur')]})


@require_POST
@role_required(ROLES_FIL)
def fil_send(request, pk):
    """POST (JSON ou multipart) — texte et/ou pièce jointe."""
    f = _fil_du_membre(request, pk)
    if f is None:
        return JsonResponse({'ok': False, 'erreur': 'Fil inaccessible.'}, status=403)
    # Accepte multipart/form-data (pièce jointe) ET application/json (texte).
    data = _body(request)
    texte = (data.get('texte') or request.POST.get('texte') or '').strip()
    piece = request.FILES.get('piece')
    if not texte and not piece:
        return JsonResponse({'ok': False, 'erreur': 'Message vide.'}, status=400)
    m = MessageFil.objects.create(fil=f, auteur=request.user, texte=texte)
    if piece:
        m.fichier.save(piece.name, piece, save=True)
        m.nom_fichier = piece.name
        m.save(update_fields=['nom_fichier'])
    f.save(update_fields=['maj_le'])
    _notifier(f, request.user, ('Pièce jointe : ' + m.nom_fichier) if m.fichier else texte)
    return JsonResponse({'ok': True, 'msg': _ser(m, request.user)})


@require_POST
@role_required(ROLES_FIL)
def fil_delete(request, mid):
    """POST — suppression logique, réservée à l'auteur (traçabilité sanitaire)."""
    m = MessageFil.objects.filter(pk=mid, auteur=request.user).first()
    if not m:
        return JsonResponse({'ok': False,
                             'erreur': 'Seul l\u2019auteur peut supprimer son message.'}, status=403)
    m.supprime = True
    m.texte = ''
    m.save(update_fields=['supprime', 'texte'])
    return JsonResponse({'ok': True})
