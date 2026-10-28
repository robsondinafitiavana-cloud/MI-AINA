# 🇲🇬 MI-AINA — Plateforme de santé numérique pour les zones rurales de Madagascar

**MI-AINA** est une plateforme web de santé numérique conçue pour améliorer l'accès aux soins dans les zones rurales de Madagascar. Elle facilite la collaboration entre les agents de première ligne, les médecins et les responsables sanitaires afin d'assurer un meilleur suivi des patients et de renforcer la surveillance sanitaire.

## 🎯 Objectifs du projet

- Faciliter l'accès aux soins dans les zones rurales et éloignées.
- Améliorer la communication entre les agents de première ligne et les médecins.
- Centraliser les dossiers médicaux et les informations de consultation.
- Faciliter la télémédecine et le suivi des patients.
- Renforcer la surveillance épidémiologique et la détection des anomalies sanitaires.
- Proposer des ressources de formation aux agents de santé.

## ✨ Fonctionnalités principales

### 👨‍⚕️ Gestion des utilisateurs
- Inscription des médecins et des agents de première ligne.
- Validation des comptes par l'administrateur.
- Gestion des rôles et des autorisations.
- Affectation des professionnels aux zones sanitaires.

### 🏥 Gestion des patients
- Création et consultation des dossiers médicaux.
- Enregistrement des symptômes et des informations médicales.
- Suivi des consultations et des constantes vitales.
- Génération de rapports médicaux au format PDF.

### 💬 Télémédecine
- Mise en relation des agents de première ligne avec les médecins.
- Échanges de messages pour le suivi des consultations.
- Partage d'informations et de documents utiles à la prise en charge.

### 📚 Formation et communauté
- Accès à des ressources pédagogiques et à des vidéos de formation.
- Publication de contenus professionnels.
- Échanges entre les membres de la communauté sanitaire.

### 🗺️ Surveillance sanitaire
- Visualisation géographique des informations sanitaires.
- Cartographie des zones de santé et des structures sanitaires.
- Signalement d'anomalies pouvant nécessiter une investigation.

### 🤖 Intelligence artificielle — en développement
- Étude de modèles d'aide à l'analyse des symptômes.
- Exploration de méthodes de détection des anomalies sanitaires.
- Objectif : fournir une aide complémentaire aux professionnels de santé, sans remplacer leur jugement médical.

## 🛠️ Technologies utilisées

| Technologie | Utilisation |
|---|---|
| Python | Langage principal |
| Django | Framework web et logique métier |
| PostgreSQL | Base de données relationnelle |
| HTML5 / CSS3 | Structure et interface utilisateur |
| JavaScript | Interactions dynamiques |
| Leaflet | Cartographie interactive |
| OpenStreetMap | Données cartographiques |
| ReportLab | Génération de rapports PDF |
| Git / GitHub | Gestion du code source |

## 👥 Types d'utilisateurs

- **ADMIN** : administration de la plateforme, validation des comptes et supervision.
- **MÉDECIN** : suivi des consultations, échanges avec les agents et accompagnement médical.
- **PREMIÈRE LIGNE** : enregistrement des patients, collecte des symptômes et suivi local.

## 🚀 Installation et exécution

### Prérequis

- Python 3.11 ou version compatible avec le projet.
- PostgreSQL.
- Git.
- Un navigateur web moderne.

### 1. Cloner le dépôt

```bash
git clone https://github.com/VOTRE-PSEUDO/MI-AINA.git
cd MI-AINA
```

Remplacez `VOTRE-PSEUDO` par votre nom d'utilisateur GitHub et adaptez le nom du dépôt si nécessaire.

### 2. Créer un environnement virtuel

Sous Windows :

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Si PowerShell bloque l'activation, vous pouvez utiliser :

```powershell
.\venv\Scripts\activate.bat
```

### 3. Installer les dépendances

Si le projet contient un fichier `requirements.txt` :

```bash
pip install -r requirements.txt
```

### 4. Configurer la base de données

Créez une base PostgreSQL, puis configurez les paramètres de connexion dans les variables d'environnement ou dans le fichier de configuration prévu par le projet.

**Important :** ne publiez jamais vos mots de passe ni vos clés secrètes sur GitHub.

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

Ouvrez ensuite cette adresse dans votre navigateur :

http://127.0.0.1:8000/

> Les commandes et paramètres exacts peuvent varier selon la configuration actuelle du projet.

## 🔐 Sécurité et confidentialité

MI-AINA est conçu pour traiter des informations de santé. Toute utilisation réelle doit prévoir des mesures adaptées, notamment :

- La protection des données personnelles et médicales.
- Le contrôle d'accès selon les rôles.
- La sécurisation des communications et des identifiants.
- La gestion des autorisations géographiques.
- La sauvegarde et la restauration de la base de données.

N'utilisez pas de données médicales réelles dans un dépôt public.

## 🗺️ Vision du projet

MI-AINA ambitionne de contribuer à un système de santé plus accessible, connecté et réactif, en rapprochant les communautés rurales des professionnels de santé grâce aux outils numériques.

**Notre vision : rendre les soins de santé plus accessibles, même dans les zones les plus éloignées de Madagascar.**

## 📌 État du projet

Projet en cours de développement. Certaines fonctionnalités, notamment les outils d'intelligence artificielle et la surveillance prédictive, sont encore en phase de développement ou d'expérimentation.

## 👨‍💻 Auteur

Développé dans le cadre d'un projet de santé numérique visant à améliorer l'accès aux soins à Madagascar.

---

*MI-AINA — La technologie au service de la santé et des communautés rurales.*
