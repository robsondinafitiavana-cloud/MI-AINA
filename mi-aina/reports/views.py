from django.http import JsonResponse
from django.db import transaction
from django.views.decorators.http import require_POST

from core.decorators import role_required
from .models import Signalement
from notifications.models import Notif
from accounts.models import Compte
from alerts.models import Alerte


def _body(request):
    if request.body:
        try:
            import json as _json
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST


@require_POST
@role_required('PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE')
@transaction.atomic
def report_create(request):
    """Tout rôle clinique ou de pilotage peut déclarer un événement sanitaire."""

    data = _body(request)

    type_ = (data.get('type') or '').strip()
    village = (data.get('village') or '').strip()
    note = (data.get('note') or '').strip()

    try:
        n = max(1, int(data.get('nb_cas') or 1))
    except (TypeError, ValueError):
        n = 1

    if not type_ or not village:
        return JsonResponse(
            {
                'ok': False,
                'erreur': 'Type et village sont obligatoires.'
            },
            status=400
        )

    r = Signalement.objects.create(
        type=type_,
        village=village,
        nb_cas=n,
        note=note,
        statut='TRANSMIS',
        agent=request.user
    )

    district = request.user.district or (request.user.csb.district if request.user.csb else '')
    region = request.user.region or (request.user.csb.region if request.user.csb else '')
    declarant = f'{request.user.prenom} {request.user.nom} ({request.user.get_role_display()})'
    localisation = ' · '.join(part for part in [district, region] if part) or 'Localisation non renseignée'
    niveau = 'crit' if n >= 5 else 'warn' if n >= 3 else 'info'
    Alerte.objects.create(
        niveau=niveau,
        tag='TRANSMISSION',
        titre=f'Signalement — {type_}',
        description=(
            f'{village} · {n} cas · {declarant} · '
            f'{request.user.csb.nom if request.user.csb else (request.user.etablissement or "Structure non renseignée")} · {localisation}'
            + (f' · {note}' if note else '')
        ),
        signalement=r,
    )

    destinataires = [
        'Pilotage national (MadaAlert)'
    ]

    # Notifications pour tous les comptes Pilotage actifs
    for p in Compte.objects.filter(
        role='PILOTAGE',
        statut='ACTIF'
    ):
        Notif.objects.create(
            destinataire=p,
            icone='megaphone',
            titre='Signalement — ' + type_,
            texte=(
                village
                + ' · '
                + str(n)
                + ' cas · déclaré par '
                + str(request.user)
                + ' · CSB '
                + (
                    request.user.csb.nom
                    if request.user.csb
                    else '—'
                )
            ),
            goto_view='alerts'
        )

    # Médecin du CSB du déclarant
    med = None
    if request.user.csb_id:
        med = Compte.objects.filter(
            role='MEDECIN',
            statut='ACTIF',
            csb=request.user.csb
        ).exclude(pk=request.user.pk).first()

    # Sinon, médecin de la même région
    if not med:
        reg = (
            request.user.region
            or (
                request.user.csb.region
                if request.user.csb
                else ''
            )
        )

        med = (
            Compte.objects.filter(
                role='MEDECIN',
                statut='ACTIF',
                region=reg
            ).exclude(pk=request.user.pk).first()
            if reg
            else None
        )

    if med:
        etab = (
            med.etablissement
            or (
                med.csb.nom
                if med.csb
                else 'Télé-expertise'
            )
        )

        destinataires.append(
            'Dr '
            + med.prenom
            + ' '
            + med.nom
            + ' ('
            + etab
            + ')'
        )

        Notif.objects.create(
            destinataire=med,
            icone='megaphone',
            titre='Signalement terrain — ' + type_,
            texte=(
                village
                + ' · '
                + str(n)
                + ' cas · déclaré par '
                + str(request.user)
            ),
            goto_view='triage'
        )

    return JsonResponse({
        'ok': True,

        'signalement': {
            'id': r.id,
            'type': r.type,
            'village': r.village,
            'n': r.nb_cas,
            'note': r.note,
            'statut': r.statut,
            'date': 'à l’instant'
        },

        'destinataires': destinataires
    })


@require_POST
@role_required('PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE')
@transaction.atomic
def report_delete(request, pk):
    """Annulation par l'auteur uniquement si le signalement est encore transmis."""

    r = Signalement.objects.filter(
        pk=pk,
        agent=request.user
    ).first()

    if not r:
        return JsonResponse(
            {
                'ok': False,
                'erreur': 'Signalement introuvable.'
            },
            status=404
        )

    if r.statut != 'TRANSMIS':
        return JsonResponse(
            {
                'ok': False,
                'erreur': (
                    'Ce signalement est déjà pris en charge par le '
                    'Pilotage — suppression impossible '
                    '(traçabilité sanitaire).'
                )
            },
            status=403
        )

    r.statut = 'ANNULE'
    r.save(update_fields=['statut'])
    Alerte.objects.filter(signalement=r, traitee=False).update(traitee=True)
    for p in Compte.objects.filter(role='PILOTAGE', statut='ACTIF'):
        Notif.objects.create(destinataire=p, icone='circle-x',
            titre='Signalement annulé — ' + r.type,
            texte=r.village + ' · annulé par ' + str(request.user), goto_view='alerts')

    return JsonResponse({
        'ok': True
    })
