import uuid
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

class CompteManager(BaseUserManager):
    def create_user(self, role, identifiant, password, **extra):
        if not identifiant or not password:
            raise ValueError('Identifiant et mot de passe requis.')
        c = self.model(role=role, **extra)
        c.set_password(password)
        # Un seul identifiant rempli selon le rôle
        if role == 'PREMIERE_LIGNE':
            c.matricule = identifiant
        elif role == 'MEDECIN':
            c.numero_ordre = identifiant
        elif role == 'PILOTAGE':
            c.email = identifiant
        else:
            raise ValueError(f'Rôle inconnu : {role}')
        c.save(using=self._db)
        return c

    def create_superuser(self, email, password, **extra):
        # ✅ FIX : role n'est JAMAIS mis dans extra —
        # il est passé une seule fois, en 1er argument positionnel.
        extra.setdefault('statut', 'ACTIF')
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('direction', 'Administration nationale')
        return self.create_user('PILOTAGE', email, password, **extra)
class Compte(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [('PREMIERE_LIGNE','Première ligne'), ('MEDECIN','Médecin'), ('PILOTAGE','Pilotage')]
    STATUT_CHOICES = [('EN_ATTENTE','En attente'),('ACTIF','Actif'),('SUSPENDU','Suspendu'),('REFUSE','Refusé')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20, blank=True)
    photo = models.ImageField(upload_to='profiles/', blank=True)
    region   = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)

    # UN SEUL identifiant selon le rôle (les autres restent NULL — vérifié par validation)
    matricule    = models.CharField('Matricule (MG-T-XXXX)', max_length=20, unique=True, null=True, blank=True)
    numero_ordre = models.CharField('N° d\u2019ordre (MG-M-XXXX)', max_length=20, unique=True, null=True, blank=True)
    email        = models.EmailField('E-mail institutionnel', unique=True, null=True, blank=True)

    doit_changer_mdp    = models.BooleanField(default=True)
    prise_en_main_terminee = models.BooleanField(
        'Prise en main MI-AINA terminée', default=False,
        help_text='Indique si le centre d’aide de première connexion a été parcouru ou passé.',
    )
    tentatives_echouees = models.SmallIntegerField(default=0)
    verrouille_jusqu_a  = models.DateTimeField(null=True, blank=True)

    statut     = models.CharField(max_length=12, choices=STATUT_CHOICES, default='EN_ATTENTE')
    valide_par = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='comptes_valides')
    valide_le  = models.DateTimeField(null=True, blank=True)

    # rattachement territorial (un seul rempli selon le rôle)
    csb           = models.ForeignKey('csb.CSB', null=True, blank=True, on_delete=models.SET_NULL, related_name='agents')
    etablissement = models.CharField(max_length=150, blank=True)
    direction     = models.CharField(max_length=150, blank=True)

    remember_token  = models.CharField(max_length=64, blank=True)
    remember_expire = models.DateTimeField(null=True, blank=True)

    derniere_connexion = models.DateTimeField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    maj_le  = models.DateTimeField(auto_now=True)

    is_active = models.BooleanField(default=True)   # = statut ACTIF géré côté logique
    is_staff  = models.BooleanField(default=False)

    objects = CompteManager()
    USERNAME_FIELD = 'email'
    # auth via backend custom (rôle + identifiant)
    REQUIRED_FIELDS = ['nom', 'prenom']

    class Meta:
        constraints = [models.CheckConstraint(check=(
            models.Q(role='PREMIERE_LIGNE', matricule__isnull=False, numero_ordre__isnull=True, email__isnull=True) |
            models.Q(role='MEDECIN', numero_ordre__isnull=False, matricule__isnull=True, email__isnull=True) |
            models.Q(role='PILOTAGE', email__isnull=False, matricule__isnull=True, numero_ordre__isnull=True)
        ), name='un_identifiant_par_role')]

    @property
    def initiales(self):
        i = (self.prenom[:1] if self.prenom else '') + (self.nom[:1] if self.nom else '')
        return (i or '??').upper()

    @property
    def nom_court(self):
        return f'{self.prenom[:1]}. {self.nom}' if self.prenom else self.nom

    @property
    def rattachement(self):
        base = self.csb.nom if self.csb else (self.etablissement or self.direction or 'National')
        if self.csb:
            base += ' · ' + self.csb.region
        return base

    @property
    def role_code(self):
        return {'PREMIERE_LIGNE': 'agent', 'MEDECIN': 'medecin',
                'PILOTAGE': 'pilotage'}.get(self.role, 'pilotage')

    @property
    def role_espace(self):
        return {'PREMIERE_LIGNE': 'PREMIÈRE LIGNE · TERRAIN',
                'MEDECIN': 'ESPACE MÉDECIN',
                'PILOTAGE': 'ESPACE PILOTAGE'}.get(self.role, 'MI-AINA')

    @property
    def identifiant(self):
        return self.matricule or self.numero_ordre or self.email

    @property
    def identifiant_court(self):
        return self.identifiant or '—'

    @property
    def est_verrouille(self):
        return bool(self.verrouille_jusqu_a and self.verrouille_jusqu_a > timezone.now())

    def enregistrer_echec(self, max_tentatives=5, minutes=15):
        self.tentatives_echouees += 1
        if self.tentatives_echouees >= max_tentatives:
            self.verrouille_jusqu_a = timezone.now() + timezone.timedelta(minutes=minutes)
        self.save(update_fields=['tentatives_echouees', 'verrouille_jusqu_a'])

    def enregistrer_succes(self):
        self.tentatives_echouees = 0
        self.verrouille_jusqu_a = None
        self.derniere_connexion = timezone.now()
        self.save(update_fields=['tentatives_echouees','verrouille_jusqu_a','derniere_connexion'])

    def __str__(self):
        return f'{self.prenom} {self.nom} ({self.role})'
