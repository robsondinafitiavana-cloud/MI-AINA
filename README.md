# MI-AINA — Une solution numérique pour améliorer l'accès aux soins à Madagascar

## Présentation du projet

MI-AINA est un projet de santé numérique conçu pour faciliter l'accès aux soins dans les zones rurales de Madagascar, où les structures médicales et les professionnels de santé ne sont pas toujours facilement accessibles.

L'idée est de créer un lien entre les agents de santé de première ligne, les médecins et les structures sanitaires. Grâce à une plateforme web, les agents peuvent enregistrer les informations des patients, suivre leur état de santé et transmettre les cas nécessitant une attention particulière aux professionnels de santé.

MI-AINA cherche ainsi à faciliter la prise en charge des patients, à améliorer la communication entre les acteurs de santé et à contribuer à une meilleure surveillance sanitaire.

## Pourquoi MI-AINA ?

Dans certaines régions de Madagascar, les patients doivent parcourir de longues distances pour consulter un professionnel de santé. Le manque de moyens, les difficultés de communication et l'insuffisance du suivi médical peuvent retarder leur prise en charge.

MI-AINA propose une approche qui s'appuie sur les agents de santé présents au niveau local et sur les outils numériques pour faciliter la transmission des informations et la collaboration avec les médecins.

L'objectif n'est pas de remplacer les professionnels de santé, mais de leur fournir un outil complémentaire pour mieux accompagner les patients.

## Fonctionnalités principales

### Gestion des utilisateurs

La plateforme prévoit plusieurs profils adaptés aux responsabilités de chaque utilisateur :

- Administrateurs chargés de la gestion et du suivi de la plateforme.
- Médecins qui consultent les dossiers et accompagnent les agents de santé.
- Agents de première ligne qui assurent le suivi local des patients.

La gestion des comptes comprend notamment l'inscription, la validation des utilisateurs et l'organisation des affectations géographiques.

### Gestion des patients

MI-AINA permet de centraliser les informations utiles au suivi médical des patients, notamment :

- Les informations personnelles et le dossier médical.
- Les symptômes déclarés et les observations recueillies.
- Les constantes vitales, comme la température, la fréquence cardiaque, la tension artérielle et la saturation en oxygène.
- L'historique des consultations et les rapports médicaux.

### Communication entre agents et médecins

La plateforme facilite les échanges entre les agents de santé et les médecins. Elle prévoit la transmission de messages, de photos et d'informations médicales, ainsi que des possibilités de téléconsultation.

Ces outils doivent permettre aux agents de solliciter plus facilement un avis médical lorsqu'une situation le nécessite.

### Intelligence artificielle et aide à l'analyse

Le projet explore l'utilisation de l'intelligence artificielle pour assister les professionnels de santé dans l'analyse des symptômes et l'identification de situations nécessitant une attention particulière.

Des travaux portent également sur l'analyse des données sanitaires afin de détecter des anomalies pouvant justifier une investigation complémentaire.

Ces fonctionnalités sont conçues comme une aide à la décision et ne remplacent ni le diagnostic ni le jugement d'un professionnel de santé.

### Formation et partage de connaissances

MI-AINA prévoit un espace de formation destiné aux agents de première ligne, avec des ressources pédagogiques et des contenus permettant de renforcer leurs connaissances.

La plateforme comprend également des fonctionnalités communautaires pour favoriser les échanges et le partage d'expériences entre les utilisateurs autorisés.

### Surveillance sanitaire et cartographie

Une interface cartographique permet de visualiser les zones géographiques, les structures sanitaires et les éventuels signaux d'alerte issus des données disponibles.

L'objectif est de faciliter le suivi territorial et d'aider les responsables à mieux comprendre les besoins sanitaires des différentes zones.

## Technologies utilisées

Le projet s'appuie principalement sur les technologies suivantes :

- **Python** : langage principal du développement.
- **Django** : framework web pour la logique métier, la gestion des utilisateurs et les fonctionnalités de la plateforme.
- **PostgreSQL** : système de gestion de base de données relationnelle.
- **HTML, CSS et JavaScript** : création des interfaces utilisateur.
- **Leaflet et OpenStreetMap** : visualisation cartographique.
- **ReportLab** : génération de rapports PDF.
- **Machine Learning** : exploration de modèles d'analyse et de détection d'anomalies à partir des données disponibles.

Les technologies matérielles et les modèles d'intelligence artificielle complémentaires pourront évoluer au fil du développement.

## Architecture générale

MI-AINA est développé sous la forme d'une application web Django, avec une base de données PostgreSQL pour organiser les informations.

Les principales parties fonctionnelles du projet concernent la gestion des utilisateurs, la géographie, les patients, les consultations, les dispositifs médicaux, la télémédecine, la formation, la communauté et la surveillance sanitaire.

Cette organisation modulaire facilite la maintenance du code et l'ajout progressif de nouvelles fonctionnalités.

## Installation en local

### Prérequis

Avant de commencer, il faut disposer de :

- Python.
- Git.
- PostgreSQL, si l'on souhaite utiliser la base de données prévue pour le projet.

### 1. Cloner le dépôt

```bash
git clone URL_DU_DEPOT
cd NOM_DU_DOSSIER
```

Remplacez `URL_DU_DEPOT` et `NOM_DU_DOSSIER` par les informations correspondant à votre dépôt GitHub.

### 2. Créer un environnement virtuel

Sous Windows :

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Sous Linux ou macOS :

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Installer les dépendances

Si le dépôt contient un fichier `requirements.txt` :

```bash
pip install -r requirements.txt
```

### 4. Configurer la base de données

Configurez les paramètres de connexion à PostgreSQL selon les instructions du projet.

Ne publiez jamais de mots de passe ou de clés secrètes dans le dépôt. Les paramètres sensibles doivent être conservés dans des variables d'environnement ou dans un fichier `.env` exclu du contrôle de version.

### 5. Appliquer les migrations

```bash
python manage.py migrate
```

### 6. Créer un compte administrateur

```bash
python manage.py createsuperuser
```

### 7. Lancer le serveur

```bash
python manage.py runserver
```

L'application sera normalement accessible à l'adresse suivante :

http://127.0.0.1:8000/

Les étapes de configuration peuvent varier selon la version du projet et les dépendances installées.

## État du développement

MI-AINA est un projet en cours de développement. Plusieurs modules ont été mis en place et testés, notamment la gestion des utilisateurs, des patients et des consultations, les échanges entre professionnels de santé, la formation et la cartographie.

Les travaux se poursuivent sur l'amélioration des interfaces, l'intégration des dispositifs médicaux, les fonctionnalités avancées de télémédecine et les modèles d'intelligence artificielle.

Les fonctionnalités disponibles peuvent varier selon la version du code publiée.

## Perspectives

Les prochaines évolutions envisagées comprennent :

- L'amélioration du suivi des patients dans les zones rurales.
- L'intégration progressive de dispositifs de mesure des constantes vitales.
- Le développement et l'évaluation des modèles d'intelligence artificielle.
- L'amélioration de la cartographie et du suivi des alertes sanitaires.
- Le renforcement de la sécurité et de la confidentialité des données médicales.
- Des tests sur le terrain avec les acteurs de santé concernés.

## Impact recherché

À travers MI-AINA, l'ambition est de contribuer à un système de santé plus accessible et mieux connecté, en mettant les outils numériques au service des communautés rurales de Madagascar.

Le projet met l'accent sur la collaboration entre les acteurs de santé, l'utilisation responsable des données et le développement de solutions adaptées aux réalités locales.

## Auteur

Projet développé dans le cadre d'une initiative de santé numérique dédiée à Madagascar.

## Licence

La licence du projet reste à définir. Toute réutilisation du code doit respecter la licence qui sera choisie pour le dépôt.
