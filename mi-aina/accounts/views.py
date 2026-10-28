import json

from django.contrib.auth import login, logout
from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.decorators import role_required
from .forms import LoginForm, RegisterForm, ProfilePhotoForm
from .models import Compte

# ============================================================
# LOGIN — le design 2 colonnes + registre des rôles
# ============================================================
LOGIN_FIELD = {
    'PREMIERE_LIGNE': 'matricule',
    'MEDECIN': 'numero_ordre',
    'PILOTAGE': 'email',
}

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    form = LoginForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        role = form.cleaned_data['role']
        ident = form.cleaned_data['identifiant']
        mdp = form.cleaned_data['password']

        # ✅ FAUTE 1 CORRIGÉE : accolades SIMPLES ({{ }} était invalide en Python)
        c = Compte.objects.filter(
            role=role,
            **{LOGIN_FIELD[role]: ident}
        ).first()

        if not c:
            form.add_error(None, 'Aucun compte trouvé pour cet identifiant.')
        elif c.est_verrouille:
            rest = (c.verrouille_jusqu_a - timezone.now()).seconds // 60
            form.add_error(None, f'Compte temporairement verrouillé ({rest} min restantes).')
        elif c.statut != 'ACTIF':
            # Messages clairs par statut — testés dans la spec (section tests)
            form.add_error(None, {
                'EN_ATTENTE': 'Votre compte attend la validation du Pilotage.',
                'REFUSE': 'Cette inscription a été refusée.',
                'SUSPENDU': 'Ce compte est suspendu. Contactez le Pilotage.',
            }[c.statut])
        elif not c.check_password(mdp):
            c.enregistrer_echec()
            form.add_error(None, 'Mot de passe incorrect.')
        else:
            c.enregistrer_succes()
            login(request, c, backend='accounts.backends.RoleBackend')

            # "Rester connecté 30 jours" — session Django sécurisée
            if form.cleaned_data.get('remember'):
                request.session.set_expiry(60 * 60 * 24 * 30)

            # Premier login → changement de mot de passe obligatoire
            if c.doit_changer_mdp:
                return redirect('change_password')

            return redirect('dashboard')

    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('login')


@require_POST
@role_required('PREMIERE_LIGNE')
def complete_onboarding(request):
    request.user.prise_en_main_terminee = True
    request.user.save(update_fields=['prise_en_main_terminee'])
    return JsonResponse({'ok': True})


# ============================================================
# REGISTER — rôle d'abord, champs dynamiques ensuite
# ============================================================
def register_view(request):
    # PILOTAGE ne s'inscrit pas librement : ce rôle est absent du formulaire.
    form = RegisterForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        c = form.save()
        return render(request, 'accounts/pending.html', {'compte': c})
    return render(request, 'accounts/register.html', {'form': form})


def change_password_view(request):
    if not request.user.is_authenticated:
        return redirect('login')

    if request.method == 'POST':
        mdp1 = request.POST.get('mdp1', '')
        mdp2 = request.POST.get('mdp2', '')

        if len(mdp1) < 8:
            messages.error(request, '8 caractères minimum.')
        elif mdp1 != mdp2:
            messages.error(request, 'Les mots de passe ne correspondent pas.')
        else:
            request.user.set_password(mdp1)
            request.user.doit_changer_mdp = False
            request.user.save()
            # ✅ FAUTE 3 CORRIGÉE : set_password invalide la session Django
            # (le hash change) → sans cette ligne, l'utilisateur est déconnecté
            # juste après avoir défini son mot de passe.
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, request.user)
            messages.success(request, 'Mot de passe défini — bienvenue !')
            return redirect('dashboard')

    return render(request, 'accounts/change_password.html')


@role_required(['PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE'])
def profile_view(request):
    dashboard_name = {
        'PREMIERE_LIGNE': 'agent',
        'MEDECIN': 'medecin',
        'PILOTAGE': 'pilotage',
    }[request.user.role]
    profile_url = f'{reverse(dashboard_name)}?view=profil'

    # Le profil est un panneau intégré au tableau de bord (sidebar conservée),
    # pas une page accounts/profile.html autonome.
    if request.method != 'POST':
        return redirect(profile_url)

    form = ProfilePhotoForm(request.POST or None, request.FILES or None, instance=request.user)
    if form.is_valid():
        form.save()
        messages.success(request, 'Photo de profil mise à jour.')
    else:
        for error in form.errors.get('photo', []):
            messages.error(request, error)
        if not form.errors.get('photo'):
            messages.error(request, 'La photo de profil n’a pas pu être mise à jour.')
    return redirect(profile_url)


# ============================================================
# ACTIONS PILOTAGE — Valider / Refuser / Suspendre / Réactiver
# (appellées en fetch JSON par dashboard/pilotage.js)
# ============================================================
@require_POST
@role_required('PILOTAGE')
def decide_compte(request, pk):
    """Valider (ACTIF) ou refuser (REFUSE) une inscription EN_ATTENTE."""
    if request.content_type == 'application/json':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JsonResponse({'ok': False, 'erreur': 'Décision invalide.'}, status=400)
        decision = payload.get('statut') if isinstance(payload, dict) else None
    else:
        decision = request.POST.get('statut')

    if decision not in {'ACTIF', 'REFUSE'}:
        return JsonResponse({'ok': False, 'erreur': 'Choisissez valider ou refuser.'}, status=400)

    c = Compte.objects.filter(pk=pk, statut='EN_ATTENTE').first()
    if not c:
        return JsonResponse({'ok': False, 'erreur': 'Demande introuvable.'}, status=404)
    statut = decision
    c.statut = statut
    c.valide_par = request.user
    c.valide_le = timezone.now()
    c.save(update_fields=['statut', 'valide_par', 'valide_le', 'maj_le'])
    return JsonResponse({'ok': True, 'statut': statut})


@require_POST
@role_required('PILOTAGE')
def set_statut(request, pk):
    """Suspendre / réactiver un compte déjà traité."""
    c = Compte.objects.filter(pk=pk).exclude(statut='EN_ATTENTE').first()
    if not c:
        return JsonResponse({'ok': False, 'erreur': 'Compte introuvable.'}, status=404)
    c.statut = 'ACTIF' if c.statut == 'SUSPENDU' else 'SUSPENDU'
    c.save(update_fields=['statut', 'maj_le'])
    return JsonResponse({'ok': True, 'statut': c.statut})
