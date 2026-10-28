import unicodedata

from django import forms
from csb.models import CSB, District, Region
from .models import Compte

ROLE_INSCRIPTEURS = [
    ('PREMIERE_LIGNE', 'Première ligne'),
    ('MEDECIN', 'Médecin'),
    # PILOTAGE volontairement absent : création contrôlée uniquement
]


def _location_key(value):
    normalized = unicodedata.normalize('NFKD', ' '.join((value or '').split()))
    return ''.join(char for char in normalized if not unicodedata.combining(char)).casefold()


class LoginForm(forms.Form):
    """Conçu pour le design login : le JS remplit ces champs en hidden."""
    role = forms.ChoiceField(choices=Compte.ROLE_CHOICES)
    identifiant = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)
    remember = forms.BooleanField(required=False)


class RegisterForm(forms.Form):
    role = forms.ChoiceField(choices=ROLE_INSCRIPTEURS)
    nom = forms.CharField(max_length=100)
    prenom = forms.CharField(max_length=100)
    telephone = forms.CharField(max_length=20, required=False)
    identifiant = forms.CharField(
        max_length=20,
        label="Matricule (MG-T-XXXX) ou N° d'ordre (MG-M-XXXX)")
    password1 = forms.CharField(widget=forms.PasswordInput)
    password2 = forms.CharField(widget=forms.PasswordInput)
    region = forms.ChoiceField(choices=(), required=False)
    district = forms.ChoiceField(choices=(), required=False)
    csb = forms.ModelChoiceField(queryset=CSB.objects.all().order_by('nom'), required=False)
    etablissement = forms.CharField(max_length=150, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        regions = {_location_key(region.nom): region.nom
                   for region in Region.objects.order_by('nom')}
        district_pairs = {
            (_location_key(district.region.nom), _location_key(district.nom)):
                (district.region.nom, district.nom)
            for district in District.objects.select_related('region').order_by('region__nom', 'nom')
        }
        # Certains CSB historiques portent déjà la région et le district en texte,
        # alors que les tables de référence District ne sont pas toujours complètes.
        for raw_region, raw_district in CSB.objects.exclude(region='').exclude(district='').values_list(
                'region', 'district'):
            region_name = ' '.join(raw_region.split())
            district_name = ' '.join(raw_district.split())
            if not region_name or not district_name:
                continue
            regions.setdefault(_location_key(region_name), region_name)
            district_pairs.setdefault(
                (_location_key(region_name), _location_key(district_name)),
                (region_name, district_name),
            )

        self.fields['region'].choices = [('', '— Choisir une région —')] + [
            (name, name) for name in sorted(regions.values(), key=str.casefold)
        ]
        self.fields['district'].choices = [('', '— Choisir un district —')] + [
            (district_name, f'{district_name} · {region_name}')
            for region_name, district_name in sorted(
                district_pairs.values(), key=lambda pair: (pair[0].casefold(), pair[1].casefold())
            )
        ]
        for name, field in self.fields.items():
            field.widget.attrs.setdefault('class', 'form-control')

    def clean_role(self):
        role = self.cleaned_data['role']
        if role == 'PILOTAGE':
            raise forms.ValidationError(
                "La création d'un compte Pilotage est contrôlée par le "
                "Ministère (python manage.py createsuperuser).")
        return role

    def clean(self):
        data = super().clean()
        role = data.get('role')
        ident = data.get('identifiant', '').strip().upper()

        # Format + unicité selon le rôle
        if role == 'PREMIERE_LIGNE':
            if not ident.startswith('MG-T-'):
                self.add_error('identifiant',
                               "Le matricule doit commencer par MG-T- (ex : MG-T-2041).")
            elif Compte.objects.filter(matricule=ident).exists():
                self.add_error('identifiant', "Ce matricule est déjà utilisé.")
            if not data.get('csb'):
                self.add_error('csb',
                               "Sélectionnez votre CSB de rattachement.")
        elif role == 'MEDECIN':
            if not ident.startswith('MG-M-'):
                self.add_error('identifiant',
                               "Le numéro d'ordre doit commencer par MG-M- (ex : MG-M-0716).")
            elif Compte.objects.filter(numero_ordre=ident).exists():
                self.add_error('identifiant', "Ce numéro d'ordre est déjà utilisé.")
            if not data.get('csb') and not data.get('etablissement'):
                self.add_error('etablissement',
                               "Choisissez un CSB ou indiquez votre établissement hospitalier.")
            if data.get('csb') and data.get('etablissement'):
                self.add_error('etablissement',
                               "Choisissez un rattachement principal : CSB ou établissement.")

        region = data.get('region', '')
        district = data.get('district', '')
        known_pairs = {
            (_location_key(region_name), _location_key(district_name))
            for region_name, district_name in District.objects.select_related('region').values_list(
                'region__nom', 'nom')
        }
        known_pairs.update(
            (_location_key(region_name), _location_key(district_name))
            for region_name, district_name in CSB.objects.exclude(region='').exclude(district='').values_list(
                'region', 'district')
        )
        if district and region and (
                _location_key(region), _location_key(district)) not in known_pairs:
            self.add_error('district', "Ce district n'appartient pas à la région choisie.")
        elif district and not any(district_key == _location_key(district)
                                  for _, district_key in known_pairs):
            self.add_error('district', "Sélectionnez un district valide.")

        csb = data.get('csb')
        if role in {'PREMIERE_LIGNE', 'MEDECIN'} and (not region or not district):
            if not region:
                self.add_error('region', "Sélectionnez votre région de rattachement.")
            if not district:
                self.add_error('district', "Sélectionnez votre district.")
        if csb and ((region and _location_key(csb.region) != _location_key(region)) or
                    (district and _location_key(csb.district) != _location_key(district))):
            self.add_error('csb', "Ce CSB ne correspond pas à la région et au district choisis.")

        mdp1, mdp2 = data.get('password1'), data.get('password2')
        if mdp1 and len(mdp1) < 8:
            self.add_error('password1', "8 caractères minimum.")
        elif mdp1:
            from django.contrib.auth.password_validation import validate_password
            try:
                validate_password(mdp1)
            except forms.ValidationError as exc:
                self.add_error('password1', exc)
        if mdp1 != mdp2:
            self.add_error('password2', "Les mots de passe ne correspondent pas.")
        return data

    def save(self):
        role = self.cleaned_data['role']
        c = Compte.objects.create_user(
            role=role,
            identifiant=self.cleaned_data['identifiant'].strip().upper(),
            password=self.cleaned_data['password1'],
            nom=self.cleaned_data['nom'].strip(),
            prenom=self.cleaned_data['prenom'].strip(),
            telephone=self.cleaned_data.get('telephone', ''),
            statut='EN_ATTENTE',
            doit_changer_mdp=False,
        )
        c.region = self.cleaned_data.get('region', '')
        c.district = self.cleaned_data.get('district', '')
        if self.cleaned_data.get('csb'):
            c.csb = self.cleaned_data['csb']
        else:
            c.etablissement = (self.cleaned_data.get('etablissement') or '').strip()
        c.save()
        return c


class ProfilePhotoForm(forms.ModelForm):
    class Meta:
        model = Compte
        fields = ['photo']
