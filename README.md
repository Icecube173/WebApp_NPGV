# Webapp Chantier — kit de départ

Application web statique (GitHub Pages) pour saisir des fiches de maintenance (FDM) sur le terrain.

## Mise en ligne
1. Créer un dépôt GitHub **public** (ex. `Webapp_MONCHANTIER`).
2. Déposer tous ces fichiers à la racine du dépôt.
3. Settings > Pages > Source : `Deploy from a branch`, branche `main`, dossier `/ (root)`.
4. Le site est disponible sur `https://<compte>.github.io/<depot>/`.

## À personnaliser
- `chantiers.json` : liste des chantiers (site, tranche, network, n° d'affaire, mail destinataire des FDM).
- `equipements.json` : liste des équipements proposés en auto-complétion.
- `index.html` : titre de l'app et tuiles à activer.
