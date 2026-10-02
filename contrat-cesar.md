# Contrat d'échange CESAR → Atlas

Version 1 — 2 octobre 2026
Endpoint : `POST https://atlas-emineo.vercel.app/api/cesar-sync`

Ce document décrit le format que l'Atlas attend de CESAR. Il sert deux usages
avec un seul format :

- **import manuel** — un compte direction ou responsable pédagogique dépose un
  export converti en JSON, sans aucune dépendance DSI ;
- **flux automatisé** — la DSI poste le même JSON sur le même endpoint, en
  s'authentifiant par clé de service.

Le passage de l'un à l'autre ne demande aucune modification côté Atlas.

---

## 1. Authentification

**Voie machine (DSI)** — en-tête `x-atlas-cesar-key`, dont la valeur est le
secret partagé `CESAR_SYNC_SECRET`. Aucun compte utilisateur n'est nécessaire.

```
x-atlas-cesar-key: <secret partagé>
Content-Type: application/json
```

**Voie interactive** — en-tête `Authorization: Bearer <jeton>` d'un compte
`dir` ou `rp`. Un responsable pédagogique n'écrit que sur les titres de son
périmètre ; les autres lignes sont rejetées et listées dans le bilan.

---

## 2. Le modèle : la séance appartient au groupe planning

La hiérarchie CESAR retenue est :

```
plan de formation → groupe de formation → groupe planning → séance
```

L'unité de rattachement est le **groupe planning**, pas le groupe de formation.
Deux groupes planning d'un même groupe de formation peuvent suivre des
progressions distinctes ; agréger la couverture au-dessus produirait une
moyenne qui ne décrit aucun groupe réel.

Toute séance porte donc un `code_groupe_cesar`. Une séance dont le groupe est
inconnu d'Atlas, ou connu mais pas encore rattaché à un titre, est **rejetée et
signalée** — jamais devinée.

---

## 3. Déclarer les groupes planning

À faire une fois, avant tout import de séances.

`POST /api/cesar-sync?action=groupes`

```json
{
  "groupes": [
    {
      "code_cesar": "GP-0001",
      "libelle": "MDEC 4-28 ISME LE MANS A",
      "groupe_formation": "MDEC 4-28 ISME LE MANS",
      "campus": "Le Mans",
      "effectif": 18,
      "titre_court": "M1 MDEC"
    }
  ]
}
```

| Champ | Obligatoire | Rôle |
|---|---|---|
| `code_cesar` | oui | identifiant stable du groupe planning dans CESAR |
| `libelle` | non | libellé lisible du groupe planning |
| `groupe_formation` | non | libellé du groupe de formation parent |
| `campus` | non | défaut `Le Mans` |
| `effectif` | non | nombre d'inscrits |
| `titre_court` | non | rattachement immédiat au titre Atlas |

`titre_court` prend une des valeurs du pilote : `Bach CDC`, `M1 MDEC`,
`M2 MDEC`, `M1 MSMC`, `M2 MSMC`, `M1 MRH`, `M2 MRH`. S'il est absent ou
inconnu, le groupe est enregistré en statut `a_rattacher` et attend un
arbitrage. Un rattachement déjà établi n'est jamais effacé par un rechargement
de la liste.

Rattachement ultérieur : `POST /api/cesar-sync?action=rattacher` avec
`{ "code_cesar": "GP-0009", "titre_court": "M2 MDEC" }`. Les séances déjà
importées sous ce groupe en héritent automatiquement.

---

## 4. Flux 1 — Prévisionnel (progressions)

One-shot annuel, rejouable. `POST /api/cesar-sync?action=previsionnel`

```json
{
  "seances": [
    {
      "ref_cesar": "PREV-884412",
      "code_groupe_cesar": "GP-0001",
      "date": "2026-09-15",
      "heure_debut": "09:00",
      "heure_fin": "12:30",
      "matiere": "Stratégie de marque",
      "intervenant_nom": "Camille Faure",
      "intervenant_email": "camille.faure@isme.fr",
      "titre": "Séance 1 — positionnement",
      "contenu": "Introduction au positionnement de marque.",
      "concepts": ["Positionnement", "Plateforme de marque"],
      "modalite": "P"
    }
  ]
}
```

---

## 5. Flux 2 — Réalisé (émargement + compte rendu de séance)

Incrémental, rejouable. `POST /api/cesar-sync?action=realise`

```json
{
  "seances": [
    {
      "ref_cesar": "SEA-1203994",
      "code_groupe_cesar": "GP-0001",
      "date": "2026-09-15",
      "heure_debut": "09:00",
      "heure_fin": "12:30",
      "matiere": "Stratégie de marque",
      "intervenant_nom": "Camille Faure",
      "intervenant_email": "camille.faure@isme.fr",
      "compte_rendu": "Introduction au positionnement. Étude de trois cas. Atelier plateforme de marque en sous-groupes."
    }
  ]
}
```

Le champ `compte_rendu` est celui qui existe déjà dans CESAR. C'est le seul
élément de contenu réel attendu : **aucune saisie supplémentaire n'est demandée
aux intervenants.**

### Champs communs aux deux flux

| Champ | Obligatoire | Notes |
|---|---|---|
| `code_groupe_cesar` | oui | doit correspondre à un groupe déclaré |
| `date` | oui | `2026-09-15` ou `15/09/2026` |
| `matiere` | oui | intitulé tel que planifié dans CESAR |
| `ref_cesar` | recommandé | identifiant de la séance, clé d'idempotence |
| `heure_debut`, `heure_fin` | non | `09:00` ou `09h00` ; servent au calcul de durée |
| `duree_minutes` | non | si fourni, prime sur le calcul par les heures |
| `intervenant_nom` | non | stocké tel quel |
| `intervenant_email` | non | seul moyen de rattacher un compte Atlas existant |
| `numero` | non | sinon numérotation chronologique automatique |

**Sur `ref_cesar`** — c'est la clé d'idempotence. Rejouer le même export met à
jour les lignes existantes, il n'en crée jamais de doublon. En son absence,
Atlas fabrique un identifiant déterministe à partir de
`groupe + date + heure + matière` : le rejeu reste sûr, mais un changement
d'horaire créera une nouvelle ligne. Fournir l'identifiant CESAR réel est donc
préférable.

**Limite** : 5 000 séances par appel. Au-delà, découper par titre ou par
période.

---

## 6. Simulation obligatoire avant un premier import

Ajouter `&dry=1` à l'URL. Tout est calculé — résolution des groupes, des
matières, appariement prévu/réalisé — et **rien n'est écrit**. La réponse est
identique à celle d'un import réel.

```bash
curl -X POST "https://atlas-emineo.vercel.app/api/cesar-sync?action=realise&dry=1" \
  -H "x-atlas-cesar-key: $CESAR_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  --data @export-realise.json
```

### Lecture du bilan

```json
{
  "ok": true,
  "simulation": true,
  "bilan": {
    "lues": 412,
    "creees": 398,
    "mises_a_jour": 0,
    "rejetees": 14,
    "sans_previsionnel": 23,
    "avec_compte_rendu": 371,
    "rejets": [{ "ligne": 17, "motif": "groupe planning inconnu : GP-0043" }],
    "nouveaux_intitules": [{ "formation_id": 2, "libelle": "Négociation avancée" }],
    "groupes_inconnus": ["GP-0043"]
  }
}
```

| Clé | À lire comme |
|---|---|
| `rejetees` | lignes non importées — groupe inconnu, non rattaché, date illisible, hors périmètre |
| `sans_previsionnel` | séances réalisées sans ligne de prévisionnel correspondante |
| `nouveaux_intitules` | intitulés rencontrés pour la première fois, en attente d'arbitrage |
| `groupes_inconnus` | codes à déclarer avant de relancer |

---

## 7. Séquençage : ce qu'Atlas ne devine pas

Quand un établissement séquence une matière, CESAR planifie les sous-matières
et la matière mère n'apparaît nulle part dans la planification — alors que
c'est elle que le certificateur attend. Une séance peut donc porter un intitulé
absent du plan de formation.

Atlas ne tranche jamais seul. Tout intitulé rencontré entre dans une file
d'arbitrage, consultable par `GET /api/cesar-sync?action=matieres&a_arbitrer=1`,
et c'est un humain qui établit la correspondance :

`POST /api/cesar-sync?action=matiere`

```json
{ "formation_id": 2, "libelle_cesar": "Stratégie de marque", "module_ref": "M12" }
```

Les séances déjà importées sous cet intitulé reçoivent le module
rétroactivement : un arbitrage tardif n'oblige jamais à réimporter.

Une séance dont la matière n'est pas encore arbitrée **est importée quand
même** — elle est factuelle. Elle ne contribue simplement pas encore au calcul
de couverture.

---

## 8. Ce que cet endpoint ne fait pas

Il ne rattache **jamais** une séance à une compétence RNCP. Le compte rendu
arrive en prose libre : il est stocké tel quel, marqué `a_mapper`, et son
rattachement aux compétences reste une étape distincte — proposée par analyse
automatique, validée par le Formateur Référent. Rien n'entre dans le graphe de
compétences sans décision humaine.

Il ne crée aucun compte utilisateur. Un `intervenant_email` inconnu laisse
simplement la séance sans rattachement de compte, le nom restant conservé.

---

## 9. Vérifier l'état à tout moment

`GET /api/cesar-sync?action=etat` renvoie, par groupe planning : le titre
rattaché, le nombre de séances prévues et réalisées, le nombre d'intitulés en
attente d'arbitrage et le nombre de comptes rendus à mapper.
