# OmniBank Local 🏦

**OmniBank Local** est une application web auto-hébergée de gestion de finances personnelles, intégrant un assistant IA local.

## 🌟 Promesse Clé
Confidentialité totale (zéro cloud), interface moderne mobile-first, aide à la décision intelligente via l'IA locale (Ollama).

## ✨ Fonctionnalités Principales
- **Zéro Cloud** : Base de données SQLite locale, aucune donnée financière ne quitte votre machine.
- **Assistant IA (Local)** : Requêtes en langage naturel, alertes intelligentes, aide à la catégorisation (nécessite [Ollama](https://ollama.com/)).
- **Gestion Complète** : Comptes courants, livrets, placements. Multi-devises.
- **Saisie & Imports** : Interface "façon Excel", import/export CSV robuste, rapprochement intelligent.
- **Budgets "Enveloppe"** : Suivez vos dépenses avec des jauges de progression.
- **Analytiques & Dashboards** : Tableaux croisés, Reste à vivre, Simulateur de découvert, Timeline des opérations.
- **Internationalisation** : Support multi-langues (Français / Anglais).

## 🛠 Stack Technique
- **Backend** : Python (FastAPI), SQLAlchemy, Pandas.
- **Frontend** : HTML/CSS/JS (Vanilla), Chart.js.
- **Base de données** : SQLite.
- **IA** : Ollama (modèles open-source locaux).

## 🚀 Installation via Docker
1. Installez **Docker** et **Docker Compose**.
2. Clonez ce dépôt :
   ```bash
   git clone <votre-url-repo>
   cd OmniBank-Local
   ```
3. Lancez les conteneurs :
   ```bash
   docker-compose up -d --build
   ```
4. Accédez à l'interface via : `http://localhost:8434`

## ⚙️ Développement (Sans Docker)
1. Créez un environnement virtuel Python : `python -m venv venv`
2. Installez les dépendances : `pip install -r requirements.txt`
3. Lancez le serveur : `uvicorn app.main:app --host 0.0.0.0 --port 8434 --reload`

## 📝 Licence
Projet personnel.
