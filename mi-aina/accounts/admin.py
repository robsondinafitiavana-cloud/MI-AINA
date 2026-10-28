import secrets
from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone

from .models import Compte


# ============================================================
# FORMULAIRE de création : le champ selon le rôle
# ============================================================
class CompteCreationForm(forms.ModelForm):
    """Création dans /admin/ : le champ identifiant s'adapte au rôle."""
    role = forms.ChoiceField(choices=Compte.ROLE_CHOICES, label='Rôle')
    identifiant = forms.CharField(
        label='Identifiant de connexion',
        help_text='Selon le rôle : matricule MG-T-XXXX · n° d\u2019ordre MG-M-XXXX · e-mail institutionnel')
    password1 = forms.CharField(widget=forms.PasswordInput, label='Mot de passe')
    password2 = forms.CharField(widget=forms.PasswordInput, label='Confirmation')

    class Meta:
        model = Compte
        fields = ('role', 'identifiant', 'nom', 'prenom', 'telephone',
                  'region', 'district', 'csb', 'etablissement', 'direction',
                  'statut', 'password1', 'password2')

    def clean(self):
        data = super().clean()
        if data.get('password1') != data.get('password2'):
            self.add_error('password2', 'Les mots de passe ne correspondent pas.')
        return data

    def save(self, commit=True):
        c = Compte(**{
            k: v for k, v in self.cleaned_data.items()
            if k not in ('identifiant', 'password1', 'password2')
        })
        c.set_password(self.cleaned_data['password1'])
        ident = self.cleaned_data['identifiant'].strip().upper()
        role = self.cleaned_data['role']
        if role == 'PREMIERE_LIGNE':
            c.matricule = ident
        elif role == 'MEDECIN':
            c.numero_ordre = ident
        else:
            c.email = ident.lower()
        if commit:
            c.save()
        return c


# ============================================================
# FORMULAIRE de modification
# ============================================================
class CompteChangeForm(forms.ModelForm):
    class Meta:
        model = Compte
        fields = ('role', 'nom', 'prenom', 'telephone',
                  'matricule', 'numero_ordre', 'email',
                  'statut', 'doit_changer_mdp',
                  'csb', 'etablissement', 'direction',
                  'region', 'district', 'is_staff', 'is_superuser', 'groups')


@admin.register(Compte)
class CompteAdmin(BaseUserAdmin):
    ordering = ('-cree_le',)
    list_display = ('prenom', 'nom', 'role_badge', 'identifiant_court',
                    'statut_colore', 'csb_col', 'derniere_connexion_court')
    list_filter = ('role', 'statut', 'csb__region')
    search_fields = ('nom', 'prenom', 'matricule', 'numero_ordre', 'email')
    filter_horizontal = ('groups', 'user_permissions')
    readonly_fields = ('derniere_connexion', 'cree_le', 'maj_le', 'tentatives_echouees')

    fieldsets = (
        ('Identité', {'fields': ('nom', 'prenom', 'telephone')}),
        ('Rôle & identifiant de connexion', {
            'fields': ('role', 'matricule', 'numero_ordre', 'email'),
            'description': 'Un seul identifiant selon le rôle : matricule (Première ligne), '
                           'n° d\u2019ordre (Médecin), e-mail (Pilotage). Laissez les autres vides.'}),
        ('Rattachement', {'fields': ('csb', 'etablissement', 'direction', 'region', 'district')}),
        ('Statut & sécurité', {'fields': ('statut', 'doit_changer_mdp',
                                          'tentatives_echouees', 'verrouille_jusqu_a')}),
        ('Dates', {'fields': ('derniere_connexion', 'cree_le', 'maj_le'), 'classes': ('collapse',)}),
        ('Permissions (technique)', {'fields': ('is_active', 'is_staff', 'is_superuser',
                                                'groups', 'user_permissions'),
                                     'classes': ('collapse',)}),
    )
    add_fieldsets = (
        ('Nouveau compte', {'classes': ('wide',),
            'fields': ('role', 'identifiant', 'nom', 'prenom', 'telephone',
                       'region', 'district', 'csb', 'etablissement', 'direction',
                       'statut', 'password1', 'password2')}),
    )

    def get_fieldsets(self, request, obj=None):
        if not obj:
            return self.add_fieldsets
        return super().get_fieldsets(request, obj)

    def get_form(self, request, obj=None, **kwargs):
        if not obj:
            kwargs['form'] = CompteCreationForm
            kwargs['fields'] = None
        else:
            kwargs['form'] = CompteChangeForm
            kwargs['fields'] = None
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        if not change:
            # Création : le password est géré par CompteCreationForm.save()
            obj = form.save()
            self.message_user(request, f'Compte {obj} créé — identifiant : {obj.identifiant_court}')
            return
        # Modification : si le champ password a été renseigné via "change password" séparé
        super().save_model(request, obj, form, change)

    def response_add(self, request, obj, post_url_continue=None):
        """Après création : proposer d'ajouter un autre compte."""
        if '_addanother' in request.POST:
            return self.response_add(request, obj)
        return super().response_add(request, obj, post_url_continue)

    # --- Colonnes colorées ---
    @admin.display(description='Rôle')
    def role_badge(self, obj):
        from django.utils.html import format_html
        colors = {'PREMIERE_LIGNE': '#007E3A', 'MEDECIN': '#C1272D', 'PILOTAGE': '#1C4030'}
        return format_html('<b style="color:{}">{}</b>',
                           colors.get(obj.role, '#333'),
                           dict(Compte.ROLE_CHOICES).get(obj.role, obj.role))

    @admin.display(description='Statut')
    def statut_colore(self, obj):
        from django.utils.html import format_html
        colors = {'ACTIF': '#007E3A', 'EN_ATTENTE': '#9A6A1F',
                  'SUSPENDU': '#666', 'REFUSE': '#C1272D'}
        return format_html('<b style="color:{}">{}</b>',
                           colors.get(obj.statut, '#333'), obj.statut)

    @admin.display(description='CSB / Structure')
    def csb_col(self, obj):
        return obj.csb.nom if obj.csb else (obj.etablissement or obj.direction or '—')

    @admin.display(description='Dernière connexion')
    def derniere_connexion_court(self, obj):
        return obj.derniere_connexion.strftime('%d/%m/%Y %H:%M') if obj.derniere_connexion else '—'

    # --- Actions en masse : valider, refuser, suspendre ---
    actions = ('action_valider', 'action_refuser', 'action_suspendre', 'action_reactiver')

    @admin.action(description='✔ Valider les comptes sélectionnés (→ ACTIF)')
    def action_valider(self, request, queryset):
        n = 0
        for c in queryset.filter(statut='EN_ATTENTE'):
            c.statut, c.valide_par, c.valide_le = 'ACTIF', request.user, timezone.now()
            c.save()
            n += 1
        self.message_user(request, f'{n} compte(s) validé(s).')

    @admin.action(description='✖ Refuser les comptes sélectionnés')
    def action_refuser(self, request, queryset):
        n = queryset.filter(statut='EN_ATTENTE').update(
            statut='REFUSE', valide_par=request.user, valide_le=timezone.now())
        self.message_user(request, f'{n} compte(s) refusé(s).')

    @admin.action(description='⏸ Suspendre les comptes sélectionnés')
    def action_suspendre(self, request, queryset):
        n = queryset.exclude(statut='EN_ATTENTE').update(statut='SUSPENDU')
        self.message_user(request, f'{n} compte(s) suspendu(s).')

    @admin.action(description='▶ Réactiver les comptes sélectionnés')
    def action_reactiver(self, request, queryset):
        n = queryset.filter(statut='SUSPENDU').update(statut='ACTIF')
        self.message_user(request, f'{n} compte(s) réactivé(s).')

    # --- Reset de mot de passe depuis la fiche ---
    @admin.action(description='🔑 Forcer le changement de mot de passe au prochain login')
    def action_force_mdp(self, request, queryset):
        n = queryset.update(doit_changer_mdp=True)
        self.message_user(request, f'{n} compte(s) devront changer leur mot de passe.')
    actions += ('action_force_mdp',)


# ============================================================
# Autres modèles — visibilité complète dans /admin/
# ============================================================
from consultations.models import Consultation, Ordonnance
from patients.models import Patient
from iot.models import Device, Measure
from reports.models import Signalement
from alerts.models import Alerte
from messaging.models import Thread, Message
from notifications.models import Notif


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('nom', 'prenom', 'age', 'sexe', 'village', 'agent_referent', 'csb_col')
    list_filter = ('sexe', 'region')
    search_fields = ('nom', 'prenom', 'code_patient', 'village')

    @admin.display(description='CSB')
    def csb_col(self, obj):
        return obj.csb.nom if obj.csb else '—'


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ('patient', 'motif_court', 'severite', 'statut',
                    'epidemic_flag', 'premiere_ligne', 'medecin', 'date_court')
    list_filter = ('statut', 'severite', 'epidemic_suspect')
    search_fields = ('patient__nom', 'patient__prenom', 'motif')

    @admin.display(description='Motif')
    def motif_court(self, obj): return obj.motif[:40]
    @admin.display(description='Épidémie')
    def epidemic_flag(self, obj):
        from django.utils.html import format_html
        return format_html('<b style="color:#C1272D">⚠ {}</b>', obj.epidemic_type) \
               if obj.epidemic_suspect else '—'
    @admin.display(description='Date')
    def date_court(self, obj):
        return obj.created_at.strftime('%d/%m %H:%M')


@admin.register(Ordonnance)
class OrdonnanceAdmin(admin.ModelAdmin):
    list_display = ('consultation', 'signee_par', 'remise', 'created_at')


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ('code', 'nom', 'statut', 'actif', 'batterie', 'signal', 'csb', 'assigne_a', 'derniere_communication')
    list_filter = ('statut', 'actif')
    search_fields = ('code', 'nom')
    readonly_fields = ('token_hash', 'derniere_communication', 'created_at')


@admin.register(Measure)
class MeasureAdmin(admin.ModelAdmin):
    list_display = ('device', 'patient', 'consultation', 'temperature', 'ecg_brut', 'electrodes_connectees', 'synchronise', 'captured_at', 'created_at')
    list_filter = ('synchronise',)
    readonly_fields = ('created_at',)


@admin.register(Signalement)
class SignalementAdmin(admin.ModelAdmin):
    list_display = ('type', 'village', 'nb_cas', 'statut', 'agent', 'created_at')
    list_filter = ('statut', 'type')


@admin.register(Alerte)
class AlerteAdmin(admin.ModelAdmin):
    list_display = ('niveau', 'tag', 'titre', 'traitee', 'traitee_par', 'created_at')
    list_filter = ('niveau', 'traitee')


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('agent', 'medecin', 'maj_le')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('thread', 'sender', 'apercu', 'lu', 'supprime', 'created_at')
    list_filter = ('lu', 'supprime')
    search_fields = ('texte',)

    @admin.display(description='Aperçu')
    def apercu(self, obj):
        return (obj.texte or '[vocal]')[:50]


@admin.register(Notif)
class NotifAdmin(admin.ModelAdmin):
    list_display = ('titre', 'destinataire', 'role_cible', 'lu', 'created_at')
    list_filter = ('lu', 'role_cible')
