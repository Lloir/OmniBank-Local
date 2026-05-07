# 📦 OmniBank — Guide de Build MSI (Windows Desktop)

> Ce document décrit le processus complet de packaging d'OmniBank en application Windows Desktop
> via **Tauri 2.0** + **PyInstaller**. À utiliser comme référence pour les futures versions.

---

## Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Structure des fichiers](#structure-des-fichiers)
4. [Étape 1 — Build du Sidecar (PyInstaller)](#étape-1--build-du-sidecar-pyinstaller)
5. [Étape 2 — Build du MSI (Tauri)](#étape-2--build-du-msi-tauri)
6. [Mise à jour (nouvelle version)](#mise-à-jour-nouvelle-version)
7. [Fonctionnement interne](#fonctionnement-interne)
8. [Problèmes connus et solutions](#problèmes-connus-et-solutions)

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  OmniBank.exe (Tauri / Rust)                         │
│  ├── Spawne omnibank-api.exe au démarrage            │
│  ├── Affiche WebView → http://127.0.0.1:8434         │
│  └── Tue omnibank-api.exe à la fermeture             │
├──────────────────────────────────────────────────────┤
│  omnibank-api.exe (PyInstaller / Python)             │
│  ├── Serveur FastAPI sur le port 8434                │
│  ├── Sert les fichiers statiques (bundled)           │
│  └── Lit/écrit dans %APPDATA%/OmniBank/              │
├──────────────────────────────────────────────────────┤
│  %APPDATA%/OmniBank/                                 │
│  ├── omnibank.db          (SQLite)                   │
│  └── uploads/             (fichiers utilisateur)     │
└──────────────────────────────────────────────────────┘
```

**Point clé** : les données utilisateur sont dans `%APPDATA%/OmniBank/`,
**jamais** dans le répertoire d'installation (`C:\Program Files\OmniBank\`).
Cela garantit la persistance lors des mises à jour/réinstallations.

---

## Prérequis

| Outil | Version testée | Installation |
|-------|---------------|-------------|
| **Python** | 3.14 | `python.org` |
| **Rust** | 1.95+ | `rustup.rs` |
| **Node.js** | 20+ | `nodejs.org` |
| **PyInstaller** | 6.20+ | `pip install pyinstaller` |
| **Tauri CLI** | 2.x | Via `package.json` (`npx tauri`) |

### ⚠️ IMPORTANT — Dépendances Python

PyInstaller utilise le **Python global** (pas le venv). Toutes les dépendances
doivent être installées globalement :

```powershell
pip install -r requirements.txt
pip install pyinstaller
```

Si PyInstaller produit un exe de ~9 MB au lieu de ~50 MB, c'est que les
dépendances ne sont pas dans le Python global → **le sidecar crashera**.

---

## Structure des fichiers

```
OmniBank-Local/
├── app/                          # Backend FastAPI
│   ├── main.py                   # App FastAPI (PyInstaller-aware)
│   ├── database.py               # Paths dynamiques (%APPDATA% ou ./data/)
│   └── routers/                  # Routes API
├── static/                       # Frontend (HTML/CSS/JS)
├── run_server.py                 # Point d'entrée PyInstaller
├── package.json                  # Deps npm (Tauri CLI + plugins)
├── latest.json                   # Manifeste updater (GitHub)
├── scripts/
│   └── build_sidecar.ps1         # Script de build PyInstaller
└── src-tauri/
    ├── tauri.conf.json           # Configuration Tauri
    ├── Cargo.toml                # Dépendances Rust
    ├── build.rs                  # Build hook
    ├── src/
    │   └── main.rs               # Launcher Rust (spawn + kill sidecar)
    ├── capabilities/
    │   └── default.json          # Permissions (shell, updater)
    ├── icons/                    # Icônes (32px, 128px, 256px, ICO)
    ├── bin/                      # ⚡ Sidecar compilé (gitignored)
    │   └── omnibank-api-x86_64-pc-windows-msvc.exe
    ├── .tauri-private-key        # Clé privée updater (gitignored, NE PAS PERDRE)
    └── .tauri-public-key         # Clé publique updater
```

---

## Étape 1 — Build du Sidecar (PyInstaller)

Le script `scripts/build_sidecar.ps1` automatise tout le processus :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_sidecar.ps1
```

### Ce que fait le script :

1. Appelle PyInstaller avec `--onefile` sur `run_server.py`
2. Inclut les fichiers statiques (`--add-data "static;static"`)
3. Déclare tous les hidden imports nécessaires (uvicorn, fastapi, starlette, etc.)
4. Utilise `--collect-submodules` pour uvicorn, fastapi et starlette
5. Copie le résultat dans `src-tauri/bin/` avec le nom attendu par Tauri

### Nommage du sidecar (CRUCIAL)

Tauri exige que le binaire sidecar soit nommé avec le **target triple** :

```
omnibank-api-x86_64-pc-windows-msvc.exe
```

Ce nom correspond à `"externalBin": ["bin/omnibank-api"]` dans `tauri.conf.json`.
Tauri ajoute automatiquement `-{target_triple}.exe` au nom.

### Vérification rapide du sidecar

```powershell
# Lancer le sidecar manuellement
.\src-tauri\bin\omnibank-api-x86_64-pc-windows-msvc.exe

# Dans un autre terminal, tester
Invoke-WebRequest http://127.0.0.1:8434/api/health
# Attendu : {"status":"ok"}
```

---

## Étape 2 — Build du MSI (Tauri)

```powershell
npx tauri build
```

### Ce que fait la commande :

1. Compile le code Rust (`src-tauri/src/main.rs`) en mode release
2. Empaquette le sidecar + les fichiers statiques + les icônes
3. Génère le MSI via **WiX Toolset** (téléchargé automatiquement)
4. Produit : `src-tauri/target/release/bundle/msi/OmniBank_X.Y.Z_x64_fr-FR.msi`

### Résultat attendu

| Fichier | Taille typique |
|---------|---------------|
| `omnibank-api-*.exe` (sidecar) | ~50 MB |
| `omnibank.exe` (Tauri wrapper) | ~15 MB |
| `OmniBank_*.msi` (installateur) | ~55 MB |

---

## Mise à jour (nouvelle version)

### 1. Incrémenter la version

Modifier **les deux fichiers** :

- `src-tauri/tauri.conf.json` → champ `"version"`
- `package.json` → champ `"version"`

### 2. Rebuild complet

```powershell
# Rebuild sidecar
powershell -ExecutionPolicy Bypass -File .\scripts\build_sidecar.ps1

# Rebuild MSI
npx tauri build
```

### 3. Publier sur GitHub

1. Créer une **Release** sur `github.com/Aschefr/OmniBank-Local`
2. Uploader le fichier `.msi` en tant qu'asset
3. Mettre à jour `latest.json` à la racine du repo (branche `main`) :

```json
{
  "version": "X.Y.Z",
  "notes": "Description de la mise à jour",
  "pub_date": "2026-XX-XXTXX:XX:XXZ",
  "platforms": {
    "windows-x86_64": {
      "signature": "CONTENU_DU_FICHIER_.sig",
      "url": "https://github.com/Aschefr/OmniBank-Local/releases/download/vX.Y.Z/OmniBank_X.Y.Z_x64_fr-FR.msi"
    }
  }
}
```

### 4. Signature pour l'updater

Le fichier `.sig` est généré automatiquement par `tauri build` dans :
`src-tauri/target/release/bundle/msi/OmniBank_X.Y.Z_x64_fr-FR.msi.sig`

Copiez son contenu dans le champ `"signature"` de `latest.json`.

### Clés de signature

- **Clé privée** : `src-tauri/.tauri-private-key` (gitignored — **NE PAS PERDRE**)
- **Clé publique** : `src-tauri/.tauri-public-key` (référencée dans `tauri.conf.json`)

Pour la build, Tauri a besoin de la clé privée via variable d'environnement :
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "src-tauri/.tauri-private-key" -Raw
npx tauri build
```

---

## Fonctionnement interne

### Cycle de vie de l'application

```
1. Utilisateur lance OmniBank.exe
2. main.rs → spawn("omnibank-api") → lance omnibank-api.exe
3. main.rs → boucle health check sur http://127.0.0.1:8434/api/health
   └── 30 tentatives × 500ms = 15s max
4. Dès que le sidecar répond → window.show()
5. L'utilisateur interagit avec l'app via la WebView
6. Fermeture → RunEvent::Exit → kill_sidecar()
   ├── child.kill() (API Tauri)
   ├── taskkill /T /F /PID (arbre de processus)
   └── taskkill /F /IM omnibank-api.exe (filet de sécurité)
```

### Résolution des chemins (PyInstaller)

`run_server.py` et `app/main.py` utilisent cette logique :

```python
# Fichiers statiques (bundled dans l'exe) :
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS        # Dossier temporaire d'extraction PyInstaller
else:
    base_path = os.path.abspath('.') # Dossier de travail (dev)

# Données utilisateur (persistées) :
if getattr(sys, 'frozen', False):
    data_dir = os.path.join(os.environ['APPDATA'], 'OmniBank')
else:
    data_dir = './data/'
```

### Configuration Tauri clé

| Paramètre | Valeur | Rôle |
|-----------|--------|------|
| `app.windows[0].visible` | `false` | Fenêtre cachée au démarrage (affichée après health check) |
| `app.windows[0].url` | `http://127.0.0.1:8434` | Pointe vers le sidecar FastAPI |
| `bundle.externalBin` | `["bin/omnibank-api"]` | Déclare le sidecar à inclure |
| `bundle.targets` | `["msi"]` | Format d'installateur Windows |
| `bundle.windows.wix.language` | `"fr-FR"` | Installateur en français |
| `plugins.updater.endpoints` | `[...latest.json]` | URL du manifeste de mise à jour |
| `plugins.updater.pubkey` | `RWT...` | Clé publique pour vérifier les signatures |

---

## Problèmes connus et solutions

### 1. "No module named 'uvicorn'" au lancement du sidecar

**Cause** : PyInstaller a utilisé un Python qui n'a pas les dépendances installées.

**Solution** :
```powershell
pip install -r requirements.txt   # Installer dans le Python GLOBAL
# Puis rebuild le sidecar
```

**Diagnostic** : Si le sidecar fait ~9 MB, les dépendances manquent.
Un build correct produit ~50 MB.

### 2. Processus omnibank-api.exe reste après fermeture

**Cause** : PyInstaller crée un arbre de processus. Un simple `kill()` ne suffit pas.

**Solution** : Le `main.rs` actuel utilise un triple mécanisme de cleanup :
- `child.kill()` via l'API Tauri
- `taskkill /T /F /PID` pour tuer l'arbre complet
- `taskkill /F /IM omnibank-api.exe` en filet de sécurité

### 3. La fenêtre ne s'affiche pas

**Cause** : Le sidecar ne démarre pas → le health check timeout → la fenêtre
reste cachée (`visible: false`).

**Diagnostic** :
```powershell
# Lancer l'app depuis un terminal pour voir les erreurs
& "C:\Program Files\OmniBank\omnibank.exe"

# Ou tester le sidecar directement
& "C:\Program Files\OmniBank\omnibank-api.exe"
```

### 4. Conflit de port 8434

**Cause** : Un processus omnibank-api orphelin occupe déjà le port.

**Solution** :
```powershell
Get-Process | Where-Object { $_.ProcessName -like "*omnibank*" } | Stop-Process -Force
```

### 5. Modification des fichiers i18n (fr.json)

**Rappel** : `fr.json` est encodé en UTF-8 avec BOM. Toujours utiliser Python
avec `encoding='utf-8-sig'` pour le modifier. Ne jamais utiliser PowerShell
pour lire/écrire ce fichier.

---

## Commandes rapides

```powershell
# === BUILD COMPLET ===
powershell -ExecutionPolicy Bypass -File .\scripts\build_sidecar.ps1
npx tauri build

# === DEV MODE ===
# Terminal 1 : Backend
uvicorn app.main:app --host 127.0.0.1 --port 8434 --reload
# Terminal 2 : Frontend Tauri
npx tauri dev

# === NETTOYAGE ===
Get-Process | Where-Object { $_.ProcessName -like "*omnibank*" } | Stop-Process -Force

# === TEST SIDECAR STANDALONE ===
.\src-tauri\bin\omnibank-api-x86_64-pc-windows-msvc.exe
# Puis : Invoke-WebRequest http://127.0.0.1:8434/api/health
```
