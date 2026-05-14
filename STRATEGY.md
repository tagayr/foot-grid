# Foot Grid — Stratégie Produit

> Analyse comparative basée sur Wordle, Immaculate Grid, Cemantix, Box2Box, GridSport.
> À lire avant toute décision produit ou technique.

---

## Concept cible

Jeu de grille 3×3 quotidien sur le foot européen. Chaque case = trouver un joueur qui satisfait **deux critères croisés hétérogènes** (ex: "Champion du monde" × "Gaucher"). Pool de joueurs : top 500 des 5 grands championnats (≥ 20M€ de valeur marchande), saison 2025/26.

Référence directe : **Metrodoku** (critères croisés) + **Immaculate Grid** (mécanique rareté) + **Wordle** (rituel quotidien + partage).

---

## Leçons clés des jeux viraux

### 1. Score de rareté inversé — LA mécanique à implémenter en priorité

Inventée par Immaculate Grid, c'est ce qui transforme un quiz en jeu d'expert.

- Réponse commune (Mbappé, Haaland) = **mauvais score**
- Réponse rare (joueur obscur qui valide les deux critères) = **excellent score**
- Calcul : `rareté = 100 - (nb_joueurs_valides / taille_pool × 100)`

Crée deux niveaux de jeu simultanés : le casual veut finir la grille, l'expert veut optimiser son score de rareté. C'est le principal moteur de partage ("j'ai trouvé Willian Pacho, score 94% — bat ça").

### 2. Rituel quotidien — 1 puzzle par jour, pas plus

- La **frustration d'attendre demain est une feature**, pas un bug (Wordle)
- Crée un sujet de conversation commun (tout le monde a le même puzzle)
- Génère de la FOMO et de l'habitude
- **Ne jamais proposer plus d'1 grille par jour par mode** — même si techniquement possible

### 3. Partage sans spoiler

- Le format emoji (🟢⬛) de Wordle a déclenché sa viralité : on partage le résultat sans révéler la solution
- Pour Foot Grid : inclure le **score de rareté par case** dans le partage WhatsApp
- Format cible :
  ```
  ⚽ Foot Grid — 13 mai
  🟢🟢⬛
  🟢⬛🟢
  ⬛🟢🟢
  ✅ 7/9 · Rareté moy: 67% · 0 erreur
  joue sur footgrid.fr
  ```

### 4. Critères croisés hétérogènes — le vrai différenciateur

Club × Club = trop classique, peu de surprise.
**Hétérogène = fun** : "Champion du monde" × "Gaucher" oblige le joueur à faire deux recherches mentales différentes → moment "aha" → satisfaction → partage.

Critères disponibles dans la BDD :
| Type | Exemples |
|---|---|
| Palmarès | Champion du monde, Vainqueur C1, Copa América, CAN |
| Position | Gardien, Défenseur, Milieu, Attaquant |
| Physique | Gaucher, Plus d'1m90 |
| Âge | Moins de 23 ans, Plus de 30 ans |
| Club | A joué au Real, PSG, Juve, Barcelone… |
| Carrière | 4+ clubs, 1 seul club de carrière |
| Valeur | Valeur > 50M€ |
| Numéro | Porte le n°10 |

### 5. Streak counter — moteur de rétention numéro 1

Duolingo, Wordle, Snapchat : les streaks sont prouvés pour augmenter le DAU. Implémenter dès le début :
- "🔥 14 jours de suite"
- Notification (optionnelle) à l'heure habituelle de jeu
- La peur de perdre son streak est plus puissante que l'envie de jouer

---

## Compte utilisateur / Login — décision stratégique

### Verdict : optionnel, jamais obligatoire, introduit en Phase 2

Les 3 plus grands succès du genre (Wordle, Immaculate Grid, Cemantix) ont décollé **sans compte utilisateur**.

Chaque écran de login = perte de 40-60% des nouveaux arrivants (lien WhatsApp → écran login → abandon).

**Ce qu'on peut faire sans compte (localStorage) :**
- Streak personnel ✅
- Stats (victoires, score moyen, meilleur score) ✅
- Bloquer le replay du jour ✅
- Sauvegarder la progression en cours ✅

**Ce qui nécessite un compte (Phase 2 seulement) :**
- Leaderboard global ✅
- Sync multi-appareils ✅
- Historique long terme ✅

**Séquence recommandée :**
```
Phase 1 — Lancement (0 → 1 000 users/j)
  → Zéro compte requis, tout en localStorage
  → Mesurer la rétention naturelle (% reviennent J+1, J+7)

Phase 2 — Traction (1 000 → 10 000 users/j)
  → Compte optionnel, proposé APRÈS la première partie
  → Message : "Sauvegarde ton streak sur tous tes appareils →"
  → Jamais sur la page d'accueil, jamais obligatoire

Phase 3 — Croissance (10 000+ users/j)
  → Leaderboard hebdo/mensuel
  → Profil public partageable
  → Features premium éventuelles
```

L'infra Supabase Auth de Tarik est un bon investissement — mais la rendre optionnelle côté UX est critique.

---

## Erreurs à éviter (apprises des concurrents)

| Erreur | Exemple | Impact |
|---|---|---|
| Trop de modes / ligues | Box2Box (7 ligues), GridSport (8 ligues) | Fragmentation de la communauté |
| Login obligatoire au lancement | — | Perte massive des nouveaux arrivants |
| Monétisation prématurée | — | Détruit la perception d'authenticité |
| Critères trop homogènes | Club × Club | Moins fun, moins partageable |
| Pas de progression visible | — | Pas de raison de revenir demain |

---

## Stratégie de lancement

Le pattern viral est toujours le même : **1 influenceur niche dans la bonne communauté**.

- Wordle → Twitter @FoolishBB (compte baseball niche)
- Immaculate Grid → Reddit r/baseball
- Cemantix → groupes WhatsApp France

**Cibles pour Foot Grid :**
1. Reddit : r/Ligue1, r/ligue1, r/soccer, r/footballtactics
2. Twitter/X : journalistes L'Équipe, RMC Sport, journalistes foot indépendants
3. WhatsApp : groupes de fans (le partage est déjà intégré = parfait)
4. TikTok : vidéo "j'ai trouvé X pour cette case impossible" = format naturel

**Ne pas faire :** campagne pub payante avant d'avoir une base organique. Le jeu doit marcher par lui-même.

---

## Base de données

Fichier : `database_5leagues_2025-26.json` (dans `/Foot-Grid/`)
- 2 475 joueurs, 5 grands championnats, saison 2025/26
- Seuil de jeu : top 500 (≥ 20M€ valeur marchande)
- Champs disponibles : `nom`, `nationalites`, `carriere`, `valeur_marchande`, `rang_mondial`, `date_naissance`, `age`, `position`, `pied`, `taille`, `numero_maillot`, `ville_naissance`, `pays_naissance`, `trophees`, `nb_clubs_carriere`

---

## Roadmap prioritaire

| Priorité | Feature | Pourquoi |
|---|---|---|
| 🔴 P0 | Score de rareté par case | Principal moteur d'engagement expert |
| 🔴 P0 | Streak counter (localStorage) | Rétention quotidienne |
| 🔴 P0 | Login optionnel (pas obligatoire) | Réduire friction onboarding |
| 🟠 P1 | Format partage enrichi (rareté) | Viralité WhatsApp/Twitter |
| 🟠 P1 | Génération automatique de puzzles | Scalabilité |
| 🟠 P1 | Critères croisés hétérogènes | Différenciation vs concurrents |
| 🟡 P2 | Leaderboard global | Engagement communauté |
| 🟡 P2 | Historique personnel (avec compte) | Rétention long terme |
| 🟢 P3 | Monétisation | Après 10K users/jour |
