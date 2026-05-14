# Foot Grid — Principes de constitution des grilles et de la base

> Document de référence produit & technique.
> À lire avant toute génération de grille ou enrichissement de la BDD.

---

## 1. La base de données

### 1.1 État actuel

| Fichier | Contenu | Limitation |
|---|---|---|
| `database_5leagues_2025-26.json` | 500 meilleurs joueurs actifs 5 ligues 2025/26 (≥ 20M€) | Aucun joueur retraité ou parti il y a > 1 an |

Champs disponibles : `nom`, `nationalites`, `carriere` (clubs + dates), `valeur_marchande`, `rang_mondial`, `age`, `position`, `pied`, `taille`, `numero_maillot`, `trophees`, `nb_clubs_carriere`

### 1.2 Enrichissement nécessaire

**Problème actuel :** un joueur tape "Ribéry" pour la case "A joué à l'OM × Français" — Ribéry est valide mais absent de la base. Le jeu le rejette à tort.

**Objectif :** accepter toutes les réponses valides, y compris les joueurs retirés ou partis récemment, tout en garantissant qu'il y a toujours au moins une réponse "gateway" (joueur connu, dans le top 200).

**Pool cible :**

```
Pool JOUABLE (gateway) :
  → Top 200 joueurs actifs par valeur marchande (≥ 35M€)
  → Joueurs que tout fan de foot reconnaît → garantit qu'on peut toujours trouver

Pool VALIDE COMPLET (toutes réponses acceptées) :
  → Tous les joueurs ayant joué dans les 5 grands championnats
    entre 2010 et aujourd'hui
  → Inclut retraités, joueurs partis en Saudi, MLS, etc.
  → ~5 000 à 10 000 joueurs selon la profondeur historique choisie
  → Nécessite une extraction Transfermarkt étendue (saisons 2010 à 2025)
```

**Sources d'enrichissement prioritaires :**
1. Saisons L1/PL/Liga/Bundesliga/Serie A de 2015 à 2024 via API Transfermarkt
2. Pour chaque joueur : profil + transfers (même structure que BDD actuelle)
3. Pas besoin des achievements ni de la valeur marchande pour les joueurs historiques
4. Flag `actif_2025_26: true/false` pour distinguer les deux pools

### 1.3 Structure enrichie cible

```json
{
  "id": "342229",
  "nom": "Kylian Mbappé",
  "nationalites": ["France"],
  "carriere": [
    { "club": "Real Madrid", "annee_debut": 2024, "annee_fin": null },
    { "club": "PSG",         "annee_debut": 2017, "annee_fin": 2024 },
    { "club": "Monaco",      "annee_debut": 2015, "annee_fin": 2017 }
  ],
  "valeur_marchande": 200000000,
  "rang_mondial": 1,
  "age": 28,
  "position": "Attaquant",
  "pied": "right",
  "taille": 180,
  "numero_maillot": 10,
  "trophees": ["Champion du monde", "Golden Boy", "Soulier d'Or"],
  "actif_2025_26": true
}
```

---

## 2. Taxonomie des critères

Huit catégories. **Les trois premières sont prioritaires** — elles doivent apparaître le plus souvent dans les grilles car elles créent les moments de jeu les plus fun et les plus accessibles.

### Catégories PRIORITAIRES (doivent dominer les grilles)

| Cat. | Label | Exemples | Pourquoi c'est fun |
|---|---|---|---|
| **CLUB** | A joué à [Club] | PSG, Real Madrid, Juve, OM... | Ancrage concret, le joueur connaît les effectifs |
| **NATIONALITÉ** | [Pays] | Français, Brésilien, Algérien... | Identité, fonds culturel fort |
| **ANNÉE** | Actif en [saison] | "En L1 en 2014/15", "À l'OM en 2012" | Mémoire historique, nostalgie |

### Catégories SECONDAIRES (enrichissent, ne dominent pas)

| Cat. | Label | Exemples | Usage |
|---|---|---|---|
| **PALMARÈS** | [Trophée] | Champion du monde, Vainqueur C1 | 1-2 par grille max |
| **POSITION** | [Poste] | Attaquant, Gardien, Défenseur, Milieu | 1 max par grille |

### Catégories ANECDOTIQUES (piment, pas base)

| Cat. | Label | Exemples | Usage |
|---|---|---|---|
| **PHYSIQUE** | [Trait] | Gaucher, Plus d'1m90 | 1 max par grille, jamais seul |
| **NUMÉRO** | N°[X] | Porte le N°10, N°9, N°1 | 1 max par grille |
| **CARRIÈRE** | [Profil] | 1 seul club, 4+ clubs | 1 max par grille |
| **ÂGE** | [Tranche] | Moins de 23 ans, Plus de 30 ans | 1 max par grille |

---

## 3. Règles de constitution d'une grille

### Règle 1 — Fréquence des catégories (LA règle principale)

Sur les 6 critères d'une grille (3 lignes + 3 colonnes) :

```
CLUB       : 1 à 3 occurrences   ← le plus fréquent
NATIONALITÉ: 1 à 2 occurrences   ← deuxième plus fréquent
ANNÉE      : 0 à 2 occurrences   ← troisième plus fréquent
PALMARÈS   : 0 à 2 occurrences
POSITION   : 0 à 1 occurrence
Autres     : 0 à 1 occurrence chacun
```

**Exemples valides :**
```
✅ CLUB / CLUB / NATIONALITÉ  ×  ANNÉE / PALMARÈS / POSITION
   (3 clubs en lignes, mix en colonnes)

✅ CLUB / NATIONALITÉ / PALMARÈS  ×  CLUB / ANNÉE / PHYSIQUE
   (mix des deux côtés)

✅ CLUB / CLUB / CLUB  ×  NATIONALITÉ / NATIONALITÉ / PALMARÈS
   (3 clubs vs 2 nationalités + 1 palmarès — fun, centré culture football)
```

**Exemples invalides :**
```
❌ PALMARÈS / PALMARÈS / PALMARÈS  ×  PALMARÈS / PALMARÈS / PALMARÈS
   → Grille entièrement palmares = pas assez de variété

❌ PHYSIQUE / PHYSIQUE / ÂGE  ×  CARRIÈRE / NUMÉRO / ÂGE
   → Zéro club, zéro nationalité, zéro ancrage football
```

### Règle 2 — Pas de croisements "sans histoire"

Certaines paires de catégories sont **techniquement valides** mais **culturellement vides** :

```
❌ NATIONALITÉ × ANNÉE
   → "Joueur français actif en 2014" = pas un critère footballistique,
     c'est un filtre de BDD. Aucune résonance.

❌ PHYSIQUE × PHYSIQUE
   → "Gaucher ET Plus d'1m90" = arbitraire, aucune histoire de club

❌ NATIONALITÉ × NATIONALITÉ (face à face ligne/colonne)
   → Crée confusion sur les binationaux, peu lisible pour le joueur

❌ ÂGE × ÂGE
   → "Moins de 23 ans × Plus de 30 ans" = logiquement impossible

❌ POSITION × POSITION (sauf Gardien qui est unique)
   → Un joueur ne peut être qu'à un poste

❌ CLUB × CLUB (rival direct) quand 0 transfers historiques
   → Real Madrid × Barcelone, Liverpool × Man City : 0 réponses
```

**Paires qui fonctionnent bien (à favoriser) :**
```
✅ CLUB × NATIONALITÉ      → "Joueurs brésiliens au PSG"
✅ CLUB × PALMARÈS         → "Joueurs du Real ayant gagné la C1"
✅ CLUB × ANNÉE            → "À l'OM en 2012/13"
✅ CLUB × POSITION         → "Gardiens passés à Chelsea"
✅ NATIONALITÉ × PALMARÈS  → "Joueurs argentins vainqueurs de la C1"
✅ PALMARÈS × NUMÉRO       → "N°10 champion du monde"
✅ CARRIÈRE × PALMARÈS     → "1 seul club ET vainqueur C1"
✅ ANNÉE × PALMARÈS        → "Vainqueur de la C1 actif en 2010"
```

### Règle 3 — Diversité minimale des catégories

Une grille doit couvrir **au moins 3 catégories différentes** parmi les 8.

```
✅ CLUB + NATIONALITÉ + PALMARÈS     = 3 catégories
✅ CLUB + ANNÉE + POSITION + NUMÉRO  = 4 catégories (idéal)
❌ CLUB + CLUB + CLUB + CLUB         = 1 seule catégorie (même si 4 clubs différents)
```

### Règle 4 — Une seule contrainte par catégorie exclusive

Certaines catégories sont **à sens unique** — un joueur ne peut satisfaire qu'une valeur :

```
Max 1 POSITION par grille (attaquant OU milieu OU défenseur OU gardien)
Max 1 tranche d'ÂGE par grille (moins_23 OU plus_30)
Max 1 CARRIÈRE par grille (one_club OU multi_club)
Max 1 NUMÉRO par grille (N°10 OU N°9 OU N°1)
```

### Règle 5 — Gateway obligatoire dans chaque case

Chaque cellule d'une grille doit contenir **au moins un joueur gateway** : un joueur que tout fan de foot régulier connaît et peut trouver sans être expert.

```
Définition gateway :
  → Rang mondial ≤ 200 (dans le top 200 par valeur marchande)
  → OU joueur emblématique du grand public (ex-star récente : Ribéry, Modric actif)

Règle opérationnelle :
  → Pour le mode FACILE  : au moins 1 gateway parmi les réponses valides
  → Pour le mode NORMAL  : au moins 1 gateway, idéalement 2
  → Pour le mode EXPERT  : 0 gateway toléré SI au moins 1 réponse connue du passionné

Si 0 gateway → case INTERDITE, même si la case a 5+ réponses valides.
```

### Règle 6 — Fourchettes de réponses valides par case

| Mode | Min | Max recommandé | Trop facile si |
|---|---|---|---|
| FACILE | 8 | 20 | > 25 |
| NORMAL | 4 | 15 | > 20 |
| EXPERT | 2 | 8 | > 12 |

Ces fourchettes s'appliquent au **pool étendu** (BDD historique complète), pas seulement au top 500 actuel.

---

## 4. Définition du critère ANNÉE

Le critère ANNÉE est particulier — il peut prendre plusieurs formes selon le mode :

### Forme 1 — Saison précise (le plus courant)
> "A joué en [Championnat] lors de la saison [YYYY/YY+1]"

Exemples :
- "En Ligue 1 en 2014/15"
- "En Premier League en 2010/11"

→ Le joueur doit avoir au moins 1 entrée carrière avec `annee_debut <= YYYY < annee_fin` dans un club du championnat concerné.

### Forme 2 — Tranche d'années (mode expert, plus rare)
> "Actif entre [YYYY] et [YYYY+3]"

Exemples : "Actif entre 2008 et 2012"

→ Nécessite des données historiques suffisamment précises sur les dates de carrière.

### Forme 3 — Année dans un club spécifique
> "À [Club] en [YYYY/YY+1]"

Exemples : "À l'OM en 2012/13", "Au PSG en 2017/18"

→ Forme la plus mémorable, croise CLUB + ANNÉE en un seul critère.
→ **Ne pas croiser avec une NATIONALITÉ** (voir Règle 2).

---

## 5. Exemples de grilles types

### Template A — "Clubs & Identités" (Mode Normal)
```
Lignes  : [Club 1] / [Club 2] / [Nationalité]
Colonnes: [Club 3] / [Palmarès] / [Année]

Exemple :
  L : A joué au PSG / A joué à l'OM / Français
  C : A joué à la Juve / Vainqueur C1 / En L1 en 2015/16
```

### Template B — "Histoires & Profils" (Mode Normal/Expert)
```
Lignes  : [Palmarès] / [Numéro ou Carrière] / [Plus de 30 ans]
Colonnes: [Palmarès] / [Nationalité] / [Club]

Exemple :
  L : Champion du monde / 1 seul club / Plus de 30 ans
  C : Vainqueur C1 / Anglais / A joué à Liverpool
```

### Template C — "Postes & Destinations" (Mode Facile)
```
Lignes  : [Position] / [Position] / [Position]
Colonnes: [Club] / [Club ou Année] / [Palmarès ou Nationalité]

Exemple :
  L : Attaquant / Milieu / Défenseur
  C : A joué au PSG / A joué à la Juve / Vainqueur Europa League
```

### Template D — "Époque" (Mode Expert — nécessite BDD historique)
```
Lignes  : [Club en année X] / [Club en année Y] / [Nationalité]
Colonnes: [Club actuel] / [Palmarès] / [Position]

Exemple :
  L : À l'OM en 2010/11 / Au Barça en 2014/15 / Algérien
  C : A joué au Real / Champion du monde / Milieu
```
*Nécessite BDD étendue aux joueurs historiques.*

---

## 6. Roadmap BDD — ce qu'il faut faire

### Priorité 1 — Court terme (jouable maintenant)
- [x] Top 500 joueurs actifs 2025/26 avec carrière, trophées, valeur marchande
- [ ] Valider que chaque grille générée a ≥1 gateway (top 200) par case

### Priorité 2 — Moyen terme (enrichissement historique)
- [ ] Extraire saisons 2015→2024 pour les 5 ligues via API Transfermarkt
- [ ] Ajouter flag `actif_2025_26` sur chaque joueur
- [ ] Normaliser les noms de clubs (mapping unifié entre saisons)
- [ ] Calculer `annee_fin` proprement dans tous les scripts d'extraction
- [ ] Déduplication des joueurs (même joueur extrait sur plusieurs saisons)

### Priorité 3 — Long terme (complétude)
- [ ] Remplacer nationalité-proxy par sélection nationale réelle (autre source)
- [ ] Étendre à 2010→2024 pour couvrir les références des millennials
- [ ] Ajouter les statistiques de saison (buts, passes décisives) comme critère futur
- [ ] Mise à jour incrémentale après chaque mercato

---

## 7. Checklist de validation d'une grille

Avant de publier une grille :

```
□ 6 critères couvrant au moins 3 catégories différentes
□ Au moins 1 critère CLUB dans la grille
□ Aucune paire NATIONALITÉ × ANNÉE
□ Aucune paire PHYSIQUE × PHYSIQUE
□ Aucune paire POSITION × POSITION (sauf si 1 seule position par axe)
□ Chaque case : min 2 réponses valides (pool étendu)
□ Chaque case : au moins 1 joueur gateway (top 200) [modes FACILE et NORMAL]
□ Aucune case > 25 réponses pour NORMAL, > 20 pour EXPERT
□ Score de rareté calculé et stocké pour toutes les réponses valides
□ Au moins 1 case "aha" par grille (réponse surprenante pour l'expert)
```
