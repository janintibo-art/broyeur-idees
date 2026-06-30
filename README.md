# 🤘 Le Broyeur à idées noires

Tu écris (ou tu **dis**) une pensée négative, tu appuies sur **BROYER**, et un
**punk 3D** la jette dans un broyeur : la feuille tombe dans les rouleaux, part
en confettis avec des étincelles, et le compteur de « pensées broyées » monte.

Petit défouloir cathartique : on met la pensée dehors, on la regarde partir en
miettes. C'est tout l'intérêt.

---

## 🗂️ Arborescence du projet

```
broyeur-idees/
├─ index.html                 # la page (canvas 3D + barre de saisie + micro)
├─ package.json               # dépendances (Vite, Capacitor, Three.js…)
├─ vite.config.js             # config du build web
├─ capacitor.config.json      # nom + identifiant de l'appli Android
├─ .gitignore
├─ LICENSE
├─ README.md                  # ce fichier
├─ public/
│  ├─ punk.glb                # le personnage punk 3D + ses 12 animations (Meshy)
│  └─ parchment.png           # le parchemin (fond transparent) sur lequel s'affiche le texte
├─ src/
│  ├─ main.js                 # logique : bouton BROYER, micro, compteur
│  ├─ scene.js                # la scène 3D : charge punk.glb, le broyeur, l'animation
│  ├─ voice.js                # reconnaissance vocale (APK + navigateur)
│  └─ style.css               # le style « zine / punk »
└─ .github/
   └─ workflows/
      └─ build-apk.yml        # GitHub fabrique l'APK tout seul
```

> Le dossier `android/` n'est **pas** dans le projet : il est généré
> automatiquement par GitHub à chaque build. Tu n'as rien à faire.

---

## 🚀 Mettre le projet sur GitHub depuis Termux

1. **Installer les outils dans Termux** (une seule fois) :
   ```bash
   pkg update && pkg install git -y
   ```

2. **Décompresser le zip** et entrer dans le dossier :
   ```bash
   unzip broyeur-idees.zip
   cd broyeur-idees
   ```

3. **Créer un dépôt vide sur GitHub** (depuis le site ou l'appli GitHub) :
   par exemple `broyeur-idees`. Ne coche **rien** (pas de README, pas de
   .gitignore) pour éviter les conflits.

4. **Envoyer le code** (remplace `TON-PSEUDO` par ton pseudo GitHub) :
   ```bash
   git init
   git add .
   git commit -m "Premier jet du broyeur"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/broyeur-idees.git
   git push -u origin main
   ```
   GitHub te demandera ton identifiant. Le mot de passe doit être un
   **token** (Settings → Developer settings → *Personal access tokens*), pas
   ton vrai mot de passe.

---

## 📦 Récupérer l'APK (fabriqué par GitHub, pas par ton téléphone)

Dès que tu pushes, GitHub lance le workflow tout seul.

1. Va sur ton dépôt → onglet **Actions**.
2. Clique sur le dernier run **« Build APK »**. Attends qu'il passe au vert
   (≈ 3–6 min la première fois).
3. En bas de la page, section **Artifacts**, télécharge
   **`broyeur-idees-apk`** (c'est un `.zip` contenant `app-debug.apk`).
4. Décompresse-le, tu obtiens **`app-debug.apk`**.

> Tu peux aussi lancer le build à la main : Actions → *Build APK* →
> **Run workflow**.

---

## 📲 Installer l'APK sur ton téléphone

1. Ouvre `app-debug.apk` depuis tes fichiers.
2. Android va prévenir : autorise **« installer des applis inconnues »** pour
   l'appli qui ouvre le fichier (Fichiers ou Chrome).
3. Installe, ouvre, broie. 🤘

C'est un APK **debug** (non signé pour le Play Store) : parfait pour un usage
perso, mais ne se publie pas tel quel sur le Store.

---

## 🧪 Tester sans rien installer (avant l'APK)

Sur ordinateur, ou dans Termux avec Node :
```bash
npm install
npm run dev
```
Ouvre l'adresse affichée (genre `http://localhost:5173`) dans **Chrome**.
Là, le micro fonctionne via le navigateur.

---

## 🎙️ À propos du micro (« on la dit au logiciel »)

- **Dans l'APK** : la dictée passe par le module natif Android
  (`@capacitor-community/speech-recognition`). La permission micro est ajoutée
  automatiquement par le workflow.
- **Dans un navigateur** : la dictée passe par la *Web Speech API* (marche
  surtout dans **Chrome**). Si elle n'est pas dispo, le bouton micro se grise
  et tu peux toujours **écrire**.

Le micro **remplit la barre de texte** en direct ; ensuite tu appuies sur
**BROYER**. (Si tu veux que ça broie tout seul à la fin de la phrase, dis-le,
c'est 2 lignes à changer dans `src/main.js`.)

---

## 🎨 Personnaliser

- **Le nom / le titre** : `index.html` (le bloc `.logo`) et `capacitor.config.json`.
- **Les couleurs** : variables en haut de `src/style.css` (`--acid`, `--magenta`…).
- **Le broyeur, les étincelles, les confettis** : dans `src/scene.js`
  (`buildGrinder()`, `shredPaper()`…).
- **La langue de la dictée** : `'fr-FR'` dans `src/voice.js`.
- **Le cadrage de la caméra** : objets `CAM` et `LOOK` en haut de `src/scene.js`.
- **La vitesse du broyage** : constante `DROP_DURATION` dans `src/scene.js`
  (plus grand = le parchemin descend plus lentement, plus le temps de lire).
- **Le parchemin** : remplace `public/parchment.png` (PNG à fond transparent).
  Le texte écrit s'adapte tout seul à la taille du parchemin.

### 🤘 Le personnage punk

Le punk est un vrai modèle 3D (**Meshy**) : `public/punk.glb`. Le fichier
contient le maillage **et 12 animations**. Tout est géré dans `loadPunk()` de
`src/scene.js`.

- **Changer de personnage** : remplace `public/punk.glb` par ton propre `.glb`
  (idéalement avec un squelette + animations). Le code remet automatiquement le
  perso à la bonne taille et le pose au sol.
- **Choisir les animations** : en haut de `src/scene.js` :
  ```js
  const IDLE_CLIP  = 'Talk_with_Right_Hand_Open'; // au repos
  const GRIND_CLIP = 'Punch_Combo_5';             // quand on broie
  ```
  Animations dispo dans ce modèle : `Formal_Bow`, `Knock_Down`,
  `Lie_Down_Hands_Spread`, `Motivational_Cheer`, `Punch_Combo_5`, `Running`,
  `Seated_Fist_Pump`, `Skip_Forward`, `Stand_and_Drink`,
  `Talk_with_Right_Hand_Open`, `Walking_Scan_with_Sudden_Look_Back`, `Walking`.
- **L'orienter / le déplacer** : dans `loadPunk()`, les lignes
  `model.position.x`, `model.position.z` et surtout
  `model.rotation.y = Math.PI * 0.30;` (augmente la valeur pour qu'il tourne).

> L'APK pèse ~20 Mo à cause du modèle 3D — c'est normal, et il fonctionne
> **hors-ligne** (le `.glb` est empaqueté dedans).

---

## 🛠️ Si le build GitHub échoue

C'est souvent un détail au premier essai. Regarde l'étape rouge dans **Actions** :

- **Licences SDK / Android** : relance simplement le workflow (Run workflow).
- **Version de Java** : ce projet vise **Java 17** (Capacitor 6). C'est déjà
  réglé dans le workflow.
- **Téléphone à jour** : pour la dictée, garde **Android System WebView** et
  **Chrome** à jour (Play Store).

L'appli fonctionne **hors-ligne** : Three.js est empaqueté dans l'APK. Seules
les polices Google se chargent en ligne (sinon une police système prend le
relais, sans souci).

---

Le broyeur est fait maison (boîtes, cônes, étincelles) et le punk est un vrai
modèle 3D animé. Bon broyage. 🤘
