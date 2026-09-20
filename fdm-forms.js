/* ============================================================
   fdm-forms.js — archivage SANS licence premium, via Microsoft Forms
   À placer à la racine du dépôt, chargé APRÈS fdm.js
   ============================================================ */

/* Le principe :
   1. la webapp met la fiche au format JSON dans le presse-papiers
   2. elle ouvre le formulaire Forms (1 seule question : coller le JSON)
   3. l'agent colle + envoie
   4. Power Automate (connecteurs gratuits) décode le JSON
      et écrit les 26 colonnes dans l'Excel SharePoint
*/

/* ---------- Envoi principal : presse-papiers + ouverture du Forms ---------- */
async function envoyerViaForms() {
  const d = donneesFDM();
  const url = (window.CONFIG && window.CONFIG.formsUrl) || '';
  if (!url) return msg("URL du Forms non configurée dans config.json", false);

  const json = JSON.stringify(d);

  try {
    await navigator.clipboard.writeText(json);
    msg('Fiche copiée ✔ — colle-la dans le formulaire qui s’ouvre, puis Envoyer.', true);
  } catch {
    // Safari/iOS bloque parfois le presse-papiers : on affiche le texte à copier
    afficherJSON(json);
    msg('Copie automatique impossible : copie le texte affiché ci-dessous.', false);
  }

  // archivage local de secours (traçabilité + file d'attente)
  fileQueue(d);

  setTimeout(() => window.open(url, '_blank'), 600);
}

/* ---------- Secours : afficher le JSON pour copie manuelle ---------- */
function afficherJSON(json) {
  let z = document.getElementById('zoneJSON');
  if (!z) {
    z = document.createElement('textarea');
    z.id = 'zoneJSON';
    z.style.cssText = 'margin-top:10px;font-family:monospace;font-size:12px;min-height:120px';
    document.getElementById('status').parentNode.appendChild(z);
  }
  z.value = json;
  z.select();
}

function copierJSON() {
  const json = JSON.stringify(donneesFDM());
  navigator.clipboard.writeText(json)
    .then(() => msg('JSON de la fiche copié ✔', true))
    .catch(() => { afficherJSON(json); msg('Copie manuelle nécessaire', false); });
}

/* ---------- Journal local des fiches envoyées ---------- */
function voirJournal() {
  const q = JSON.parse(localStorage.getItem('fdmQueue') || '[]');
  if (!q.length) return msg('Aucune fiche enregistrée sur cet appareil', true);
  const txt = q.map(f => `${f.ID_FDM} — ${f.Equipement} — ${f.Date_Constat}`).join('\n');
  alert('Fiches créées depuis cet appareil :\n\n' + txt);
}

function viderJournal() {
  if (confirm('Effacer le journal local des fiches ? (les fiches déjà envoyées dans Forms sont conservées côté SharePoint)')) {
    localStorage.removeItem('fdmQueue');
    majBadge();
    msg('Journal local effacé', true);
  }
}
