/* ============================================================
   fdm-forms.js — archivage SANS licence premium, via Microsoft Forms
   À placer à la racine du dépôt, chargé APRÈS fdm.js
   v2 : correction de l'ouverture du Forms depuis l'app installée (PWA)
   ============================================================ */

/* Le principe :
   1. la webapp met la fiche au format JSON dans le presse-papiers
   2. elle ouvre le formulaire Forms dans le NAVIGATEUR SYSTÈME
      (et non dans la fenêtre isolée de la PWA, qui ne partage pas
       la session Microsoft et provoque un écran de connexion en boucle)
   3. l'agent colle + envoie
   4. Power Automate décode le JSON et écrit les 26 colonnes dans
      l'Excel SharePoint
*/

/* ---------- Détection du mode "app installée" ---------- */
function estInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

/* ---------- Envoi principal ---------- */
async function envoyerViaForms() {
  const d = donneesFDM();
  const url = (window.CONFIG && window.CONFIG.formsUrl) || '';
  if (!url) return msg("URL du Forms non configurée dans config.json", false);

  const json = JSON.stringify(d);
  let copieOK = false;

  try {
    await navigator.clipboard.writeText(json);
    copieOK = true;
  } catch {
    copieOK = copieSecours(json);
  }

  // archivage local (traçabilité + journal de l'appareil)
  fileQueue(d);

  if (!copieOK) {
    afficherJSON(json);
    return msg('Copie automatique impossible : copie le texte ci-dessous, puis ouvre le formulaire.', false);
  }

  msg('Fiche copiée ✔ — colle-la dans le formulaire, puis Envoyer.', true);

  // Ouverture du Forms :
  // en mode app installée, window.open() crée un webview sans session M365
  // -> on navigue dans l'onglet courant, qui bascule vers le navigateur système.
  setTimeout(() => {
    if (estInstallee()) {
      window.location.href = url;
    } else {
      const w = window.open(url, '_blank', 'noopener');
      if (!w) window.location.href = url;   // popup bloquée
    }
  }, 700);
}

/* ---------- Copie de secours (iOS / navigateurs restrictifs) ---------- */
function copieSecours(texte) {
  try {
    const ta = document.createElement('textarea');
    ta.value = texte;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/* ---------- Affichage du JSON pour copie manuelle ---------- */
function afficherJSON(json) {
  let z = document.getElementById('zoneJSON');
  if (!z) {
    z = document.createElement('textarea');
    z.id = 'zoneJSON';
    z.style.cssText = 'margin-top:10px;font-family:monospace;font-size:12px;min-height:120px';
    document.getElementById('status').parentNode.appendChild(z);
  }
  z.value = json;
  z.focus(); z.select();
}

function copierJSON() {
  const json = JSON.stringify(donneesFDM());
  navigator.clipboard.writeText(json)
    .then(() => msg('JSON de la fiche copié ✔', true))
    .catch(() => {
      if (copieSecours(json)) return msg('JSON de la fiche copié ✔', true);
      afficherJSON(json);
      msg('Copie manuelle nécessaire : sélectionne le texte ci-dessous.', false);
    });
}

/* ---------- Ouvrir le Forms seul (sans regénérer la fiche) ---------- */
function ouvrirForms() {
  const url = (window.CONFIG && window.CONFIG.formsUrl) || '';
  if (!url) return msg("URL du Forms non configurée", false);
  window.location.href = url;
}

/* ---------- Journal local des fiches ---------- */
function voirJournal() {
  const q = JSON.parse(localStorage.getItem('fdmQueue') || '[]');
  if (!q.length) return msg('Aucune fiche enregistrée sur cet appareil', true);
  const txt = q.map(f => `${f.ID_FDM} — ${f.Equipement} — ${f.Date_Constat}`).join('\n');
  alert('Fiches créées depuis cet appareil :\n\n' + txt);
}

function viderJournal() {
  if (confirm('Effacer le journal local des fiches ? (les fiches déjà envoyées via Forms restent dans SharePoint)')) {
    localStorage.removeItem('fdmQueue');
    majBadge();
    msg('Journal local effacé', true);
  }
}
