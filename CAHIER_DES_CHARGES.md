# Cahier des charges : USPTA, assistant de l'arbitre de chaise

Version 0.1 du 25/11/2026, brouillon à valider.

## 1. Vision

USPTA est une PWA (application web installable) pour smartphone. Elle remplace la feuille de match papier de **l'arbitre de chaise** et l'aide dans toutes ses tâches :

- **tenir le score**, point par point, avec toutes les corrections possibles ;
- **contrôler le temps** : chronomètres de pause, d'échauffement et de soins, temps écoulé entre les points ;
- **appliquer le code de conduite** et le barème des dépassements de temps, sans rien retenir de tête ;
- **dire la bonne annonce au bon moment** : l'écran affiche le texte exact à prononcer ;
- **suivre la procédure** du match, de la vérification du court jusqu'à la feuille signée.

Cadre de la V1 :

- **Règles :** tournois FFT uniquement.
- **Utilisateur :** un arbitre seul sur la chaise, avec son propre téléphone.
- **Langue :** annonces en français ; tous les textes d'annonce sont centralisés dans un catalogue pour ajouter l'anglais sans toucher au moteur.
- **Fonctionnement :** 100 % hors ligne ; Android en priorité, iOS compatible via la PWA.
- **Indépendance :** USPTA est une application autonome, sans lien de données avec USPTStats. Elle reprend sa stack technique.

## 2. Périmètre par version

| Fonction | V1 | V2 | Plus tard |
|---|:-:|:-:|:-:|
| Simple, formats FFT 1 à 7 | ✅ | | |
| Saisie du service (faute, filet, ace, double faute) et de l'échange (faute, let) | ✅ | | |
| Toutes les corrections, tracées dans la feuille | ✅ | | |
| Erreurs de service (mauvais serveur, mauvais côté, mauvais ordre) guidées | ✅ | | |
| Chronomètres (échauffement, changements de côté, fin de set, soins, toilettes, interruption) | ✅ | | |
| Temps écoulé depuis la fin du point (continuité du jeu) | ✅ | | |
| Code de conduite et barème des dépassements de temps | ✅ | | |
| Texte de l'annonce à prononcer, à chaque étape | ✅ | | |
| Procédure guidée (avant, pendant, après le match) | ✅ | | |
| Option balles neuves | ✅ | | |
| Abandon, disqualification, forfait (WO), retard | ✅ | | |
| Interruption longue et reprise du match | ✅ | | |
| Feuille de match PDF (modèle simple) | ✅ | | |
| Feuille PDF au modèle officiel FFT (fourni plus tard) | | ✅ | |
| **Double** (évolution obligatoire) | | ✅ | |
| Historique des matchs arbitrés | | ✅ | |
| Score en direct pour la table du juge-arbitre | | ✅ | |
| Annonces en anglais | | | ✅ |
| Règles ITF | | | ✅ |

## 3. Formats de match (FFT)

| Format | Sets | Jeux par set | Jeu décisif | Point décisif | 3e set |
|---|---|:-:|---|:-:|---|
| 1 | 3 sets | 6 | à 6-6 | non | set classique, jeu décisif à 6-6 |
| 2 | 2 sets | 6 | à 6-6 | non | super jeu décisif en 10 points |
| 3 | 2 sets | 4 | à 4-4 | oui | super jeu décisif en 10 points |
| 4 | 2 sets | 6 | à 6-6 | oui | super jeu décisif en 10 points |
| 5 | 2 sets | 3 | à 2-2 | oui | super jeu décisif en 10 points |
| 6 | 2 sets | 4 | à 3-3 | oui | super jeu décisif en 10 points |
| 7 | 2 sets | 5 | à 4-4 | oui | super jeu décisif en 10 points |

Les formats sont figés dans le code : ils ne sont pas modifiables dans les réglages.

**Gain d'un set :** il se joue en N jeux, avec un jeu décisif à J-J.
- Quand le jeu décisif est à N-N (formats 1, 2, 3, 4), il faut 2 jeux d'écart avant N-N : 6-4, 7-5, puis 7-6 par jeu décisif. Pour le format 3 : 4-2, 5-3, puis 5-4.
- Quand le jeu décisif est à (N-1)-(N-1) (formats 5, 6, 7), le premier à N jeux gagne le set, sauf à (N-1)-(N-1) : 3-1 puis 3-2 par jeu décisif (format 5), 4-2 puis 4-3 (format 6), 5-3 puis 5-4 (format 7).

**Règles communes :**
- jeu décisif en 7 points et super jeu décisif en 10 points, avec 2 points d'écart ;
- point décisif à 40-40 : le relanceur choisit le côté de réception ;
- service dans le jeu décisif : 1 point, puis 2, puis 2… ; le joueur qui a relancé au premier point du jeu décisif sert le premier jeu du set suivant ;
- changement de côté après chaque jeu impair du set, et tous les 6 points dans un jeu décisif ou un super jeu décisif ;
- le décompte des jeux pour le changement de côté continue d'un set à l'autre ; le jeu décisif compte pour un jeu.

## 4. Saisie du score

### 4.1 Principes d'écran
- **Les joueurs sont affichés à leur place réelle** par rapport à la chaise : bouton de gauche pour le joueur à gauche de l'arbitre. Ils s'inversent automatiquement au changement de côté.
- Le score, le serveur et le côté de service (droite ou gauche) sont toujours visibles.
- Grands boutons, utilisables au pouce. **Portrait par défaut**, paysage possible.
- Une **zone d'annonce** en gros caractères montre la phrase à prononcer (voir §7).
- Le bouton **Annuler** est toujours accessible.

### 4.2 Au service
| Bouton | Annonce | Effet |
|---|---|---|
| `Faute` | « Faute » | Faute de longueur, de largeur ou de pied. Sur la 1re balle, on passe à la 2e. Sur la 2e, double faute et point au relanceur. |
| `Filet faute` | « Filet, faute » | Service qui touche le filet puis sort : même effet que `Faute`. |
| `Filet` (1re balle) | « Filet, premier service » | La 1re balle est rejouée. |
| `Filet` (2e balle) | « Filet, deuxième service » ⚠️ à confirmer | La 2e balle est rejouée. |
| `Ace` | (score) | Point au serveur, compté à part dans la feuille. |
| `Balle en jeu` | — | Ouvre la saisie de l'échange. |

### 4.3 Pendant l'échange
| Bouton | Annonce | Effet |
|---|---|---|
| `Point Joueur gauche` / `Point Joueur droite` | « Faute » si besoin, puis le score | Point au joueur. |
| `Let` | « Let » | Le point est rejoué avec deux services (gêne, interférence). |

Pour aller vite, l'arbitre peut aussi toucher directement le joueur qui gagne le point, sans passer par `Balle en jeu`.

### 4.4 Corrections
Toutes les corrections laissent une **trace dans la feuille** : heure, point concerné, motif (choisi dans une liste ou saisi en texte libre).
- **Annuler le dernier point**, sur autant de niveaux que nécessaire.
- **Modifier un point plus ancien** : changer le vainqueur ou la nature du service. Tout ce qui suit est recalculé, et l'arbitre voit le nouveau score avant de valider.
- **Corriger une décision (overrule)** et **rejouer un point** : la décision corrigée est enregistrée.
- **Erreurs de service** : un assistant applique la règle FFT et dit ce qui reste acquis et comment reprendre.
  - **Mauvais serveur :** on rétablit le bon serveur dès que l'erreur est découverte ; les points joués restent acquis.
  - **Mauvais côté :** on corrige le côté dès que l'erreur est découverte ; les points restent acquis.
  - **Mauvais ordre dans le jeu décisif :** la correction dépend du nombre de points joués.
  - ⚠️ Les cas détaillés (faute isolée avant la découverte, jeu terminé, nombre pair ou impair de points) seront rédigés à partir du règlement et validés avant d'être codés.
- **Correction du score sur réclamation** : l'arbitre fixe un score manuellement en dernier recours. L'opération est tracée.

## 5. Gestion du temps

### 5.1 Chronomètres
| Chronomètre | Durée | Démarrage | Alertes |
|---|---|---|---|
| Échauffement | 5 min | au toucher | annonces à 2 min, 1 min et 0 (voir §7) |
| Changement de côté | 90 s | **automatique** à la fin du jeu | vibration et bip à 10 s et à 0, puis rappel de l'annonce « Time » |
| Fin de set | 120 s | **automatique** à la fin du set | idem |
| Temps mort médical | 3 min de soins | au toucher, après l'évaluation | idem |
| Pause toilettes ou tenue | 3 min, cumulables avec les 2 min de fin de set | au toucher | idem |
| Interruption (pluie, nuit…) | — | au toucher | le temps est décompté du temps de jeu |
| Durée du match | — | au premier point | — |

- **Pas de pause** au changement de côté qui suit le premier jeu d'un set, ni pendant un jeu décisif : le chronomètre ne se lance pas, l'écran rappelle « Changement de côté, sans pause ».
- **Pauses toilettes :** 2 par joueur et par match, échauffement compris, de préférence à la fin d'un set. Le compteur s'affiche et l'application prévient quand la limite est atteinte.
- Chaque chronomètre peut être mis en pause, relancé ou arrêté avant la fin.
- ⚠️ Durées à confirmer par le règlement FFT. Elles restent modifiables dans les réglages au cas où le règlement change.

### 5.2 Continuité du jeu
- **Il n'y a pas de règle des 25 s** à la FFT. L'application affiche un **compteur discret du temps écoulé depuis la fin du dernier point**, sans limite ni alerte.
- C'est l'arbitre seul qui juge s'il y a dépassement de temps volontaire.

### 5.3 Barème des dépassements de temps
Ce barème est **indépendant** du code de conduite : l'un n'influe jamais sur l'autre.
1. Premier dépassement : **avertissement**.
2. Ensuite : **1 point de pénalité**. Le bouton `Encore 30 s` ajoute un point de pénalité à chaque appui, **à la discrétion de l'arbitre**. L'application ne retire jamais de point toute seule.

L'application affiche le texte de l'annonce et applique le point au score.

## 6. Code de conduite

### 6.1 Barème FFT
Cumulé par joueur, **toutes infractions confondues**, pour tout le match :
1. **Avertissement**
2. **1 point de pénalité**
3. **3 points de pénalité**
4. **Disqualification**, prononcée par le juge-arbitre. L'application rappelle d'appeler le juge-arbitre et enregistre sa décision.

**Report des points :** si le jeu se termine avant que tous les points de pénalité soient attribués, le reste se reporte sur le jeu suivant. Le cas se présente sur 3 points de pénalité à 30-0 ou au point décisif, par exemple. L'application gère ce report automatiquement et l'affiche.

### 6.2 Infractions
La liste est **modifiable** dans les réglages : on peut ajouter, renommer ou désactiver une infraction. Liste initiale :
- obscénité audible ;
- obscénité visible ;
- abus de balle ;
- abus de raquette ou d'équipement ;
- abus verbal ;
- abus physique ;
- conseils (coaching) ;
- comportement antisportif ;
- non-respect du code vestimentaire ;
- autre (texte libre).

### 6.3 Déroulé dans l'application
1. L'arbitre choisit le joueur, puis l'infraction.
2. L'application détermine le niveau de la sanction, **affiche l'annonce exacte** et **applique la pénalité au score**.
3. Une note libre peut être ajoutée. L'événement est horodaté et inscrit dans la feuille.

## 7. Annonces

L'application **affiche uniquement le texte**, sans synthèse vocale. Les formulations sont dans un catalogue unique, qui servira aussi pour l'anglais.

**Désignation des joueurs :** civilité, prénom et nom (« M. Paul Dupont », « Mme Julie Martin »). Une forme courte (civilité et nom) peut être utilisée dans les annonces de score (⚠️ à confirmer).

| Moment | Annonce (exemples) |
|---|---|
| Score dans le jeu | « 15-0 », « 30 partout », « Égalité », « Avantage M. Dupont » |
| Point décisif | « Point décisif, choix du relanceur » |
| Fin de jeu | « Jeu M. Dupont. M. Dupont mène 4 jeux à 2, premier set » |
| Égalité de jeux | « Jeu Mme Martin. 3 jeux partout, deuxième set » |
| Jeu décisif | « Jeu décisif » ; score du type « 3-2 M. Dupont » |
| Fin de set | « Jeu et premier set M. Dupont, 6 jeux à 4 » |
| Super jeu décisif | « Un set partout, super jeu décisif » |
| Fin de match | « Jeu, set et match M. Dupont, 6-4 3-6 10-7 » |
| Changement de côté | « Changement de côté » ou « Changement de côté, sans pause » |
| Échauffement | « Échauffement, 5 minutes », « 2 minutes », « 1 minute », « Time » |
| Reprise | « Time » |
| Balles neuves | « Balles neuves » |
| Code de conduite | « Infraction au code de conduite, abus de balle, avertissement, M. Dupont » ; « …, point de pénalité, M. Dupont » |
| Dépassement de temps | « Dépassement de temps, avertissement, M. Dupont » ; « …, point de pénalité, M. Dupont » |

⚠️ Les formulations exactes de l'échauffement, des jeux décisifs, des infractions et des dépassements de temps sont à valider.

**Rappels contextuels :** balle de break, de set et de match (pour l'arbitre seulement, rien à annoncer), changement de côté, entrée dans un jeu décisif, balles neuves au prochain jeu.

## 8. Procédure guidée

Une liste d'étapes cochables, affichée au bon moment. Cette première version s'appuie sur les usages courants et sera complétée.

**Avant le match**
1. Saisie du match : tournoi, tour, court, juge-arbitre, arbitre (nom et numéro de licence), format, options.
2. Saisie des joueurs : civilité, prénom, nom, club, classement, numéro de licence.
3. Vérification du court : hauteur du filet au centre (0,914 m), piquets de simple, sangle, chaises, balles.
4. Appel des joueurs et contrôle de la tenue.
5. Tirage au sort : le gagnant choisit de servir, de recevoir, son côté, ou laisse le choix à l'autre. L'adversaire fait le choix restant.
6. Position des joueurs par rapport à la chaise.
7. Échauffement de 5 minutes, avec ses annonces.
8. Annonce du début du match et « Time ».

**Pendant le match** (rappels automatiques)
- Changements de côté et pauses.
- Balles neuves si l'option est active.
- Jeu décisif et super jeu décisif : rappel du serveur et des changements de côté.

**Après le match**
1. Annonce du résultat.
2. Contrôle de la feuille, signature, remise au juge-arbitre.
3. Export du PDF.

## 9. Balles neuves (option)
Elle est désactivée par défaut. Quand on l'active à la création du match, on choisit :
- **Changements réglementaires** : après les 7 premiers jeux (échauffement compris), puis tous les 9 jeux ;
- ou **avant le 3e set** uniquement.

L'application annonce les balles neuves au jeu concerné. Un jeu décisif compte pour un jeu. Si un changement tombe au début d'un jeu décisif, il est reporté au début du 2e jeu du set suivant.

## 10. Fins de match particulières
- **Abandon** : en cours de match, avec le score figé et l'annonce du résultat.
- **Disqualification** : décision du juge-arbitre, enregistrée au barème.
- **Forfait (WO)** : avant le match, avec le motif.
- **Retard** : la saisie de l'heure d'arrivée des joueurs et la décision prise. ⚠️ La règle FFT sur les délais de retard est à préciser.
- **Interruption longue** : le match est sauvegardé à chaque point. Il peut être **mis de côté** puis **repris plus tard ou un autre jour**, avec tout son état (score, serveur, côtés, barèmes, compteur de pauses toilettes). La reprise propose un nouvel échauffement.

## 11. Feuille de match et exports
- **PDF simple en V1** : en-tête (tournoi, tour, court, arbitre, joueurs), score par set, détail jeu par jeu, chronologie des incidents (infractions, dépassements de temps, soins, pauses, interruptions, corrections), heures de début et de fin, durée.
- **V2** : PDF au **modèle officiel** fourni par l'arbitre.
- **Partage** par la feuille de partage d'Android.
- **Sauvegarde et restauration** de toute la base en JSON.

## 12. Architecture technique

Elle reprend celle d'USPTStats.

| Élément | Choix |
|---|---|
| Type d'application | PWA installable, hors ligne (service worker) |
| Langage | TypeScript |
| Framework | Svelte 5 |
| Build | Vite avec vite-plugin-pwa |
| Stockage local | IndexedDB, via Dexie |
| PDF | jsPDF et jspdf-autotable |
| Tests | Vitest, en priorité sur le moteur de règles et les barèmes |
| Écran | Wake Lock API pour garder l'écran allumé ; vibration via l'API Vibration |
| Hébergement | GitHub Pages, dépôt `unagisim/USPTA` |

**Principe clé : stocker les événements plutôt que l'état.**
- Un match est une **liste ordonnée d'événements horodatés**.
- Le score, le serveur, les côtés, les barèmes, les chronomètres attendus et les annonces sont **recalculés** en rejouant les événements avec un moteur pur et testé.
- Conséquences :
  - annuler supprime le dernier événement ;
  - une correction ancienne s'ajoute comme un événement qui remplace un point, ce qui garde la trace ;
  - aucune incohérence n'est possible ;
  - le modèle est prêt pour le double et le direct de la V2.

**Moteur prêt pour le double** : l'ordre de service et de réception est modélisé dès la V1 par équipe et par joueur, même si seule la saisie en simple est proposée.

```
Match { id, format, options { ballesNeuves }, tournoi, tour, court, jugeArbitre, arbitre,
        joueurs[2], tirage, positionsInitiales, etat, evenements[] }
Joueur { civilite, prenom, nom, club?, classement?, licence? }
// chaque événement porte un horodatage automatique : ts
Service   { ts, type: faute | filet_faute | filet | ace | balle_en_jeu }
Point     { ts, gagnant, fin?: faute | normal }
Let       { ts }
Sanction  { ts, bareme: conduite | temps, joueur, infraction?, niveau, pointsAppliques, note? }
Chrono    { ts, type: echauffement | changement | fin_set | medical | toilettes | interruption, action: debut | pause | fin }
Correction{ ts, type: annulation | modification | overrule | erreur_service | score_manuel, cible?, motif }
FinMatch  { ts, type: normal | abandon | disqualification | forfait, joueur?, motif? }
```

## 13. Écrans V1
1. **Accueil** : nouveau match, reprendre un match interrompu, réglages.
2. **Création du match** : informations, joueurs, format, options.
3. **Avant le match** : liste de contrôle, tirage au sort, positions, échauffement.
4. **Arbitrage** : score, zone d'annonce, boutons de saisie, chronomètre actif, compteur depuis la fin du point. Accès rapide à Code de conduite, Temps, Soins/Toilettes, Corrections, Interruption.
5. **Feuille** : chronologie complète du match, consultable à tout moment.
6. **Fin de match** : résultat, contrôle, export PDF.
7. **Réglages** : liste des infractions, durées des chronomètres, alertes (son, vibration), thème.

Thèmes clair et sombre, avec un mode **« plein soleil »** à fort contraste. L'écran reste allumé pendant le match.

## 14. Décisions validées (25/11/2026)

| Sujet | Décision |
|---|---|
| Règlement | FFT uniquement pour l'instant. |
| Langue | Annonces en français ; catalogue prêt pour l'anglais. |
| Utilisateur | Un arbitre seul, son propre téléphone. |
| Lien avec USPTStats | Même stack, applications indépendantes. |
| Formats | FFT 1 à 7 (§3), figés dans le code. |
| Double | V2, obligatoire ; moteur conçu pour dès la V1. |
| Annonces au service | « Faute », « Filet, faute », « Filet, premier service » ; « Let » pendant l'échange. En anglais, « Net » pour le filet. |
| Corrections | Toutes, avec trace dans la feuille ; erreurs de service guidées. |
| Temps entre les points | Pas de 25 s ; compteur du temps écoulé, jugement de l'arbitre. |
| Dépassement de temps | Avertissement, puis 1 point par tranche de 30 s, à la discrétion de l'arbitre ; barème indépendant du code. |
| Code de conduite | Avertissement, 1 point, 3 points, disqualification (juge-arbitre) ; points reportés sur le jeu suivant ; liste d'infractions modifiable. |
| Annonces | Texte affiché seulement, pas de voix. |
| Joueurs | Civilité, prénom et nom. |
| Balles neuves | Option : 7 puis 9 jeux, ou avant le 3e set. |
| Feuille PDF | Modèle simple en V1, modèle officiel en V2. |
| Historique et direct | V2. |
| Hébergement | GitHub Pages, dépôt `unagisim/USPTA`. |

## 15. Points à confirmer
1. L'annonce d'un filet sur la 2e balle : « Filet, deuxième service » ?
2. Les durées FFT des chronomètres du §5.1, notamment la durée maximale d'une interruption avant nouvel échauffement.
3. Les formulations des annonces marquées ⚠️ au §7, dont la forme courte du nom.
4. Les cas détaillés des erreurs de service (§4.4).
5. La règle FFT sur le retard des joueurs (§10).
6. La procédure guidée du §8, à compléter.
