from django.core.management.base import BaseCommand
from accounts.models import Compte
from csb.models import CSB, District, Region
from patients.models import Patient
from consultations.models import Consultation, Ordonnance
from iot.models import Device, Measure
from alerts.models import Alerte
from reports.models import Signalement
from formation.models import ForumPost, ForumReply, Ressource
from publications.models import Publication
from notifications.models import Notif
from messaging.models import Thread, Message, Fil, MessageFil

# ── Les régions de Madagascar + position (x, y) sur la carte SVG (190×344) ──
REGIONS = [
    ('Diana',             149,  20), ('Sava',             133,  58),
    ('Boeny',              82,  92), ('Sofia',             88, 102),
    ('Betsiboka',          90, 122), ('Melaky',            45, 135),
    ('Alaotra-Mangoro',   112, 128), ('Analanjirofo',     135, 115),
    ('Atsinanana',        157, 150), ('Itasy',             85, 165),
    ('Analamanga',        111, 172), ('Bongolava',         78, 178),
    ('Vakinankaratra',     93, 186), ('Menabe',            42, 195),
    ('Amoron\u2019i Mania', 95, 215), ('Vatovavy',        126, 222),
    ('Haute Matsiatra',    99, 230), ('Fitovinany',       122, 242),
    ('Ihorombe',           85, 245), ('Atsimo-Atsinanana',118, 262),
    ('Atsimo-Andrefana',   38, 282), ('Anosy',             75, 300),
    ('Androy',            100, 305),
]

# ── Districts réels par région (chef-lieu + principaux) ──
DISTRICTS = {
    'Diana': ['Antsiranana I', 'Antsiranana II', 'Ambilobe', 'Ambanja', 'Nosy Be'],
    'Sava': ['Sambava', 'Andapa', 'Vohemar', 'Antalaha'],
    'Boeny': ['Mahajanga I', 'Mahajanga II', 'Marovoay', 'Ambato-Boeni'],
    'Sofia': ['Antsohihy', 'Bealanana', 'Mandritsara', 'Analalava'],
    'Betsiboka': ['Maevatanana', 'Tsaratanana'],
    'Melaky': ['Maintirano', 'Morafenobe'],
    'Alaotra-Mangoro': ['Ambatondrazaka', 'Moramanga', 'Andilamena'],
    'Analanjirofo': ['Fenoarivo-Atsinanana', 'Soanierana-Ivongo', 'Maroantsetra'],
    'Atsinanana': ['Toamasina I', 'Toamasina II', 'Vatomandry', 'Brickaville'],
    'Itasy': ['Miarinarivo', 'Arivonimamo', 'Soavinandriana'],
    'Analamanga': ['Antananarivo Renivohitra', 'Antananarivo Atsimondrano',
                   'Ambohidratrimo', 'Manjakandriana', 'Anjozorobe'],
    'Bongolava': ['Tsiroanomandidy', 'Fenoarivobe'],
    'Vakinankaratra': ['Antsirabe I', 'Antsirabe II', 'Betafo', 'Ambatolampy'],
    'Menabe': ['Morondava', 'Belo-sur-Tsiribihina', 'Mahabo'],
    'Amoron\u2019i Mania': ['Ambositra', 'Fandriana', 'Ambatofinandrahana'],
    'Vatovavy': ['Mananjary', 'Nosy Varika', 'Ikongo', 'Ifanadiana'],
    'Haute Matsiatra': ['Fianarantsoa I', 'Ambalavao', 'Ikalamavony'],
    'Fitovinany': ['Manakara', 'Vohipeno'],
    'Ihorombe': ['Ihosy', 'Iakora', 'Ivohibe'],
    'Atsimo-Atsinanana': ['Farafangana', 'Vangaindrano'],
    'Atsimo-Andrefana': ['Toliara I', 'Toliara II', 'Sakaraha', 'Morombe', 'Ampanihy'],
    'Anosy': ['Taolagnaro', 'Betroka', 'Amboasary-Sud'],
    'Androy': ['Ambovombe', 'Tsihombe', 'Bekily'],
}

QUARTIERS = ['Centre', 'Est', 'Nord', 'Ouest', 'Sud', 'Annexe']


# One doctor and two first-line workers per CSB. These pairings deliberately
# make it possible to verify both same-CSB access and agent-to-agent isolation.
DEMO_SITES = [
    ('Diana', 'Antsiranana I'),
    ('Sava', 'Sambava'),
    ('Boeny', 'Mahajanga I'),
    ('Sofia', 'Antsohihy'),
    ('Alaotra-Mangoro', 'Ambatondrazaka'),
    ('Analanjirofo', 'Fenoarivo-Atsinanana'),
    ('Atsinanana', 'Toamasina I'),
    ('Analamanga', 'Antananarivo Renivohitra'),
    ('Vakinankaratra', 'Antsirabe I'),
    ('Vatovavy', 'Mananjary'),
]

DEMO_DOCTORS = [
    ('Rakotomalala', 'Mamy'), ('Randrianarisoa', 'Fara'),
    ('Andriamihaja', 'Toky'), ('Ravelomanantsoa', 'Nantenaina'),
    ('Rakotonirina', 'Voahirana'), ('Razanakolona', 'Tiana'),
    ('Randriamahaleo', 'Hery'), ('Razafindrakoto', 'Noro'),
    ('Andrianjafy', 'Lova'), ('Ramanantsoa', 'Miora'),
]

DEMO_AGENTS = [
    ('Rakotoarisoa', 'Feno'), ('Randrianasolo', 'Mialy'),
    ('Andriamalala', 'Tahina'), ('Rasoanirina', 'Soa'),
    ('Razanakoto', 'Haja'), ('Rakotondrabe', 'Fanja'),
    ('Raveloson', 'Tovo'), ('Rafalimanana', 'Voahangy'),
    ('Rasoavimbahoaka', 'Nantenaina'), ('Andriamanana', 'Fara'),
    ('Randrianarisoa', 'Mbola'), ('Rasoanandrasana', 'Hasina'),
    ('Rakotomalala', 'Tiana'), ('Razafindrabe', 'Miora'),
    ('Andriatsihorana', 'Lanto'), ('Ramanalina', 'Solo'),
    ('Rasolofonirina', 'Mamy'), ('Rakotondramanga', 'Fitiavana'),
    ('Andrianina', 'Toky'), ('Razanadrakoto', 'Fetra'),
]

DEMO_VILLAGES = [
    'Antsiranana centre', 'Ankofafa', 'Mahajanga centre', 'Ambalabe',
    'Ambohitsilaozana', 'Ampasina Maningory', 'Ankirihiry', 'Ambohipo',
    'Antsenakely', 'Ampasimanjeva',
]

DEMO_PASSWORD = 'MiAinaDemo2026!'


# Comptes en attente : utiles pour tester la validation/refus depuis Pilotage.
# Aucun CSB n'est attribué tant que le compte n'est pas validé.
DEMO_PENDING_ACCOUNTS = [
    {
        'role': 'PREMIERE_LIGNE',
        'nom': 'Rakotondramiadana', 'prenom': 'Fanja',
        'matricule': 'MG-T-3101',
        'region': 'Analamanga', 'district': 'Ambohidratrimo',
    },
    {
        'role': 'PREMIERE_LIGNE',
        'nom': 'Randriamampianina', 'prenom': 'Hery',
        'matricule': 'MG-T-3102',
        'region': 'Atsinanana', 'district': 'Toamasina I',
    },
    {
        'role': 'PREMIERE_LIGNE',
        'nom': 'Rakotomalala', 'prenom': 'Voahirana',
        'matricule': 'MG-T-3103',
        'region': 'Vakinankaratra', 'district': 'Antsirabe I',
    },
    {
        'role': 'MEDECIN',
        'nom': 'Randriamihaja', 'prenom': 'Mamy',
        'numero_ordre': 'MG-M-1801',
        'region': 'Analamanga', 'district': 'Antananarivo Renivohitra',
    },
    {
        'role': 'MEDECIN',
        'nom': 'Rakotobe', 'prenom': 'Noro',
        'numero_ordre': 'MG-M-1802',
        'region': 'Boeny', 'district': 'Mahajanga I',
    },
    {
        'role': 'MEDECIN',
        'nom': 'Andrianjafy', 'prenom': 'Tiana',
        'numero_ordre': 'MG-M-1803',
        'region': 'Haute Matsiatra', 'district': 'Fianarantsoa I',
    },
]


class Command(BaseCommand):
    help = 'Crée le territoire et des données de démonstration Mi-AINA sans supprimer les données existantes.'

    def handle(self, *args, **opts):
        self.seed_territoire()
        assignments = self.seed_comptes()
        pending_count = self.seed_comptes_en_attente()
        patient_count = self.seed_clinique(assignments)
        self.seed_signalements(assignments)
        self.seed_formation_publications(assignments)
        self.seed_notifications(assignments)
        self.stdout.write(self.style.SUCCESS(
            f'Seed OK : 20 Première Ligne, 10 médecins, 1 Pilotage, '
            f'{patient_count} patients (10 par agent), signalements, consultations, '
            'forum, publications, ressources et notifications.'))
        self.stdout.write(f'Mot de passe commun : {DEMO_PASSWORD}')
        self.stdout.write('Pilotage : pilotage.demo@sante.gov.mg')
        self.stdout.write('Médecins : MG-M-0716 à MG-M-0725')
        self.stdout.write('Première Ligne active : MG-T-2041 à MG-T-2060')
        self.stdout.write('Comptes en attente : MG-T-3101 à MG-T-3103 et MG-M-1801 à MG-M-1803')
        self.stdout.write('Deux agents et un médecin partagent chaque CSB de test.')

    # ────────── Territoire : régions (texte) + CSB générées ──────────
    def seed_territoire(self):
        created = {}
        code_n = 0
        total = 0
        for region, _x, _y in REGIONS:
            region_obj, _ = Region.objects.get_or_create(nom=region)
            for d in DISTRICTS.get(region, []):
                District.objects.get_or_create(nom=d, region=region_obj)
                for i, q in enumerate(QUARTIERS[:2]):        # 2 CSB par district
                    code_n += 1
                    code = f'CSB{code_n:03d}'
                    csb, was_created = CSB.objects.get_or_create(
                        code=code,
                        defaults=dict(nom=f'CSB {d} {q}', district=d, region=region))
                    if was_created:
                        total += 1
                    created[f'csb_{code}'] = csb
        self.stdout.write(f'  CSB créées : {total} (total {CSB.objects.count()})')
        return created

    def _save_demo_account(self, lookup, fields, password, superuser=False):
        account = Compte.objects.filter(**lookup).first()
        if account is None and superuser:
            account = Compte.objects.create_superuser(
                lookup['email'], password, **fields)
        elif account is None:
            role = fields['role']
            extra = {name: value for name, value in fields.items() if name != 'role'}
            account = Compte.objects.create_user(
                role, next(iter(lookup.values())), password, **extra)
        else:
            for name, value in fields.items():
                setattr(account, name, value)
            account.set_password(password)
            if superuser:
                account.is_staff = True
                account.is_superuser = True
            account.save()
        return account

    def seed_comptes(self):
        self._save_demo_account(
            {'email': 'pilotage.demo@sante.gov.mg'},
            {'nom': 'Rasolofo', 'prenom': 'Nirina', 'statut': 'ACTIF',
             'doit_changer_mdp': False, 'direction': 'Administration nationale'},
            DEMO_PASSWORD, superuser=True)

        assignments = []
        for site_index, (region, district) in enumerate(DEMO_SITES):
            csb = CSB.objects.filter(region=region, district=district).order_by('code').first()
            if not csb:
                raise RuntimeError(f'CSB de démonstration manquant : {district}, {region}')

            doctor_nom, doctor_prenom = DEMO_DOCTORS[site_index]
            doctor = self._save_demo_account(
                {'numero_ordre': f'MG-M-{716 + site_index:04d}'},
                {'role': 'MEDECIN', 'nom': doctor_nom, 'prenom': doctor_prenom,
                 'statut': 'ACTIF', 'csb': csb, 'etablissement': csb.nom,
                 'region': region, 'district': district, 'doit_changer_mdp': False},
                DEMO_PASSWORD)

            for pair_index in range(2):
                agent_index = site_index * 2 + pair_index
                agent_nom, agent_prenom = DEMO_AGENTS[agent_index]
                agent = self._save_demo_account(
                    {'matricule': f'MG-T-{2041 + agent_index:04d}'},
                    {'role': 'PREMIERE_LIGNE', 'nom': agent_nom, 'prenom': agent_prenom,
                     'statut': 'ACTIF', 'csb': csb, 'region': region,
                     'district': district, 'doit_changer_mdp': False},
                    DEMO_PASSWORD)
                assignments.append((agent, doctor, csb, agent_index))
        return assignments


    def seed_comptes_en_attente(self):
        """Créer des comptes fictifs en attente de validation par Pilotage."""
        created_or_updated = 0

        for data in DEMO_PENDING_ACCOUNTS:
            role = data['role']
            lookup = (
                {'matricule': data['matricule']}
                if role == 'PREMIERE_LIGNE'
                else {'numero_ordre': data['numero_ordre']}
            )

            fields = {
                'role': role,
                'nom': data['nom'],
                'prenom': data['prenom'],
                'statut': 'EN_ATTENTE',
                'region': data['region'],
                'district': data['district'],
                'doit_changer_mdp': True,
            }

            account = self._save_demo_account(
                lookup,
                fields,
                DEMO_PASSWORD,
            )

            # Les comptes en attente ne doivent pas être considérés comme actifs.
            # On conserve volontairement csb vide jusqu'à leur validation.
            if hasattr(account, 'csb_id') and account.csb_id is not None:
                account.csb = None
                account.save(update_fields=['csb'])

            created_or_updated += 1

        self.stdout.write(
            f'  Comptes en attente créés/mis à jour : {created_or_updated}'
        )
        return created_or_updated

    # ────────── Patients et consultations pour vérifier les accès ──────────
    def seed_clinique(self, assignments):
        patients = []
        for agent, doctor, csb, index in assignments:
            site_index = index // 2
            for patient_number in range(1, 11):
                # The first patient reuses the original fixture identity so an
                # existing seed database does not gain a duplicate on upgrade.
                noms_malagasy = [
                    ('Rakoto', 'Fara'), ('Rasoa', 'Mialy'), ('Randria', 'Toky'),
                    ('Rasolofonirina', 'Hasina'), ('Rakotomalala', 'Mamy'),
                    ('Andriamihaja', 'Nantenaina'), ('Razanakoto', 'Hery'),
                    ('Raveloson', 'Voahirana'), ('Randrianarisoa', 'Lova'),
                    ('Andriamanana', 'Tahina'),
                ]
                nom, prenom = noms_malagasy[(patient_number - 1) % len(noms_malagasy)]
                nom = f'{nom}{index + 1:02d}'
                prenom = f'{prenom}{index + 1:02d}'
                patient, _ = Patient.objects.get_or_create(
                    nom=nom, prenom=prenom,
                    defaults={'age': 18 + (index * 3 + patient_number) % 63,
                              'sexe': 'F' if (index + patient_number) % 2 == 0 else 'M',
                              'village': DEMO_VILLAGES[site_index],
                              'commune': csb.district, 'district': csb.district,
                              'region': csb.region, 'csb': csb,
                              'agent_referent': agent})
                # Keep ownership and geography deterministic on every rerun.
                patient.age = 18 + (index * 3 + patient_number) % 63
                patient.sexe = 'F' if (index + patient_number) % 2 == 0 else 'M'
                patient.village = DEMO_VILLAGES[site_index]
                patient.commune = csb.district
                patient.agent_referent = agent
                patient.csb, patient.district, patient.region = csb, csb.district, csb.region
                patient.save(update_fields=['age', 'sexe', 'village', 'commune',
                                           'agent_referent', 'csb', 'district', 'region'])
                patients.append((agent, doctor, csb, patient, index, patient_number))

                motif = ('Consultation de démonstration' if patient_number == 1
                         else f'Consultation démo {patient_number:02d}')
                cycle = (patient_number - 1) % 5
                statut = ['EN_COURS', 'EN_ATTENTE', 'VALIDEE', 'ORIENTEE', 'TERMINEE'][cycle]
                consultation, _ = Consultation.objects.update_or_create(
                    patient=patient, motif=motif,
                    defaults={
                        'premiere_ligne': agent, 'medecin': doctor,
                        'symptomes': 'Données fictives — dossier créé pour démonstration.',
                        'observation': 'Ne correspond à aucune personne réelle.',
                        'severite': ['MODÉRÉ', 'PRÉOCCUPANT', 'URGENT', 'MODÉRÉ', ''][cycle],
                        'statut': statut,
                        'orientee_vers': 'HÔPITAL' if statut == 'ORIENTEE' else '',
                        'orientee_struct': 'Hôpital de référence de démonstration' if statut == 'ORIENTEE' else '',
                        'orientee_note': 'Orientation fictive pour tester le suivi.' if statut == 'ORIENTEE' else '',
                    })
                if statut in {'VALIDEE', 'ORIENTEE', 'TERMINEE'}:
                    Ordonnance.objects.update_or_create(
                        consultation=consultation,
                        defaults={'contenu': 'Paracétamol — exemple fictif, ne pas utiliser comme prescription réelle.',
                                  'suivi': 'Donnée de démonstration', 'signee_par': doctor,
                                  'remise': patient_number % 2 == 0})

        # A few measurements stay tied to the first agent's own demo patient.
        first_agent, _, first_csb, _ = assignments[0]
        device, _ = Device.objects.get_or_create(
            code='#14',
            defaults={'nom': 'Boîtier ESP32 de démonstration', 'statut': 'CONNECTÉ',
                      'batterie': 78, 'signal': 3, 'csb': first_csb,
                      'assigne_a': first_agent})
        if device.assigne_a_id != first_agent.id or device.csb_id != first_csb.id:
            device.assigne_a, device.csb = first_agent, first_csb
            device.save(update_fields=['assigne_a', 'csb'])
        demo_patient = patients[0][3]
        for spo2, temp, bpm in [(96, 38.2, 104), (89, 39.4, 132), (97, 36.8, 74)]:
            Measure.objects.get_or_create(
                device=device, patient=demo_patient, spo2=spo2,
                temperature=temp, bpm=bpm)

        Alerte.objects.get_or_create(
            titre='CSB Mananjary silencieux',
            defaults={'niveau': 'crit', 'tag': 'TRANSMISSION',
                      'description': 'Aucune donnée reçue depuis 9 jours. '
                                     'Une visite de vérification est recommandée.'})
        Alerte.objects.get_or_create(
            titre='34 comptes inactifs',
            defaults={'niveau': 'warn', 'tag': 'COMPTES',
                      'description': 'Aucune connexion depuis 90 jours. '
                      'À examiner pour suspension ou archivage.'})
        return len(patients)

    def seed_signalements(self, assignments):
        """Créer un signalement fictif par agent, réutilisé à chaque exécution."""
        for index, (agent, _doctor, _csb, _agent_index) in enumerate(assignments):
            Signalement.objects.get_or_create(
                agent=agent,
                type='Paludisme suspecté',
                village=DEMO_VILLAGES[index // 2],
                note='Signalement fictif généré par seed_demo.',
                defaults={'nb_cas': 2 + index % 4, 'statut': 'TRANSMIS'})

    def seed_formation_publications(self, assignments):
        """Remplir les flux de publications, ressources et forum avec du texte démo."""
        pilotage = Compte.objects.get(email='pilotage.demo@sante.gov.mg')
        doctors = [doctor for _agent, doctor, _csb, _index in assignments[::2]]

        publications = [
            (pilotage, 'Bienvenue dans le fil de démonstration',
             'Publication fictive : cet espace présente les annonces et contenus partagés.'),
            (doctors[0], 'Rappel de suivi clinique',
             'Exemple fictif de publication médecin. Vérifiez toujours le dossier et les protocoles officiels.'),
            (doctors[3], 'Protocole de démonstration',
             'Contenu de démonstration pour vérifier le fil de publications et son affichage.'),
        ]
        for auteur, titre, resume in publications:
            Publication.objects.get_or_create(
                auteur=auteur, titre=titre,
                defaults={'type': 'texte' if 'Bienvenue' in titre else 'protocole',
                          'resume': resume, 'epingle': 'Protocole' in titre})

        for title, kind, summary in [
            ('Formation de démonstration — triage', 'video',
             'Ressource fictive sans fichier : utilisez-la pour vérifier les listes et filtres.'),
            ('Guide de démonstration — référence', 'pdf',
             'Ressource fictive sans fichier joint, destinée au test de l’interface.'),
        ]:
            Ressource.objects.get_or_create(
                titre=title, defaults={'type': kind, 'resume': summary,
                                       'publie_par': doctors[0]})

        topics = [
            ('Comment organiser le suivi après une consultation ?', 'SUIVI,ORGANISATION'),
            ('Quels éléments transmettre lors d’une orientation ?', 'ORIENTATION,DOSSIER'),
            ('Partage d’expérience : consultation en zone éloignée', 'TÉLÉSANTÉ,TERRAIN'),
        ]
        for index, (question, tags) in enumerate(topics):
            auteur = doctors[index]
            post, _ = ForumPost.objects.get_or_create(
                auteur=auteur, question=question, defaults={'tags': tags})
            for reply_author, reply_text in [
                (assignments[index * 2][0],
                 'Réponse fictive Première Ligne pour tester les échanges du forum.'),
                (pilotage,
                 'Réponse fictive Pilotage pour vérifier la consultation des discussions.'),
            ]:
                ForumReply.objects.get_or_create(
                    post=post, auteur=reply_author, reponse=reply_text)

    def seed_notifications(self, assignments):
        """Créer des notifications de test sans en ajouter à chaque relance."""
        examples = [
            (assignments[0][0], 'Nouveau message',
             'Un message fictif du médecin vous attend.', 'messagerie'),
            (assignments[0][0], 'Nouvelle ordonnance',
             'Une ordonnance fictive a été ajoutée à une consultation.', 'patients'),
            (assignments[0][1], 'Nouvelle réponse au Forum médical',
             'Une réponse de démonstration a été ajoutée à votre sujet.', 'forum'),
            (Compte.objects.get(email='pilotage.demo@sante.gov.mg'), 'Nouveau signalement',
             'Un signalement fictif est disponible pour consultation.', 'signalements'),
        ]
        for recipient, title, text, target in examples:
            if not Notif.objects.filter(destinataire=recipient, titre=title,
                                       texte=text, goto_view=target).exists():
                Notif.objects.create(destinataire=recipient, titre=title, texte=text,
                                     goto_view=target, icone='bell', lu=False)
