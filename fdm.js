/* ============================================================
   fdm.js — v4 : envoi automatique au flux Power Automate (HTTP)
   - génération Word / Excel
   - envoi direct sans Forms ni collage
   - file d'attente hors ligne (renvoi automatique au retour du réseau)
   ============================================================ */

const val   = id => (document.getElementById(id)?.value || '').trim();
const radio = name => { const r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; };

const CLE_JOURNAL = 'fdmQueue';
const CLE_ATTENTE = 'fdmEnAttente';

/* ---------- Identifiant technique unique ---------- */
function idFDM() {
  const c = window.chantierCourant || {};
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return 'FDM-' + (c.site || 'XXX') + (c.tranche || '') + '-' +
         d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
         p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/* ---------- Préfixe de numérotation PV ---------- */
function prefixePV() {
  const c = window.chantierCourant || {};
  const an = String(new Date().getFullYear()).slice(2);
  return 'WEF-' + an + '-' + (c.projet || 'XXXX') + '-' + (c.site || 'XXX') + (c.tranche || '') + '-PV';
}

/* ---------- Collecte de tous les champs ---------- */
function donneesFDM() {
  const c = window.chantierCourant || {};
  return {
    ID_FDM: idFDM(),
    Horodatage: new Date().toISOString(),
    Chantier: c.nom || '',
    N_Affaire: c.affaire || '',
    Lieu_Tranche: val('lieu'),
    Network: val('network'),
    Equipement: val('equipement'),
    Ref_SAP: val('refsap'),
    Autre_Ref: val('autreref'),
    Circonstances: radio('circ'),
    Symptomes: val('symptomes'),
    Action_Immediate: val('action'),
    Materiel_Utilisable: radio('utilisable'),
    Redacteur: val('nom'),
    Date_Constat: val('date'),
    Diagnostic: val('diagnostic'),
    Type_Panne: val('typepanne'),
    Description_Maintenance: val('descmaint'),
    Type_Maintenance: radio('typemaint'),
    Verif_Periodique: radio('verifperio'),
    Tests_Fonctionnels: radio('tests'),
    Equipement_Fonctionnel: radio('fonctionnel'),
    PR_Num: val('pr'),
    Cout_Achats_EUR: val('cout'),
    Temps_Passe_h: val('temps'),
    Statut: 'Ouverte',
    Lien_Fiche: '',
    Prefixe_PV: prefixePV(),
    Num_PV: ''
  };
}

/* ---------- Téléchargement générique ---------- */
function telecharger(contenu, nom, type) {
  const blob = new Blob(['\ufeff' + contenu], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
const ligne = (l, v) => '<tr><td class="lab">' + esc(l) + '</td><td>' + esc(v) + '</td></tr>';

/* ---------- FICHE WORD : construction du HTML ---------- */
function htmlFicheWord(d, numPV) {
return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
'<head><meta charset="utf-8"><style>' +
'@page { size:21cm 29.7cm; margin:2cm; }' +
'body { font-family:Arial, sans-serif; font-size:10pt; }' +
'h1 { font-size:14pt; text-align:center; border-bottom:2px solid #0078D7; padding-bottom:6px; }' +
'h2 { font-size:11pt; background:#0078D7; color:#fff; padding:4px 8px; margin-top:16px; }' +
'table { width:100%; border-collapse:collapse; margin-top:6px; }' +
'td { border:1px solid #888; padding:5px 7px; vertical-align:top; }' +
'td.lab { width:32%; background:#f2f4f7; font-weight:bold; }' +
'.sign { margin-top:18px; font-size:9pt; }' +
'.pied { margin-top:24px; font-size:8pt; color:#555; text-align:center; }' +
'</style></head><body>' +
'<p style="font-size:9pt;text-align:right">Procès-verbal ' + esc(numPV) + '</p>' +
'<h1>FICHE DE MAINTENANCE – ' + esc(d.Equipement) + '<br><span style="font-size:11pt">' + esc(numPV) + '</span></h1>' +
'<h2>Identification</h2><table>' +
ligne('Chantier', d.Chantier) + ligne("N° d'affaire", d.N_Affaire) +
ligne('Lieu / Tranche', d.Lieu_Tranche) + ligne('Network', d.Network) +
ligne('Équipement', d.Equipement) + ligne('Réf. SAP', d.Ref_SAP) +
ligne('Autre réf.', d.Autre_Ref) + ligne('Circonstances', d.Circonstances) +
'</table>' +
'<h2>Dysfonctionnement — demande de maintenance</h2><table>' +
ligne('Symptômes / description du problème', d.Symptomes) +
ligne('Intervention / action corrective immédiate', d.Action_Immediate) +
ligne('Matériel utilisable', d.Materiel_Utilisable) +
ligne('Nom', d.Redacteur) + ligne('Date', d.Date_Constat) +
'</table><p class="sign">Signature : ______________________</p>' +
'<h2>Diagnostic</h2><table>' + ligne('Diagnostic', d.Diagnostic) + ligne('Type de panne', d.Type_Panne) + '</table>' +
'<h2>Description de la maintenance</h2><table>' +
ligne('Description de la maintenance', d.Description_Maintenance) +
ligne('Type de maintenance', d.Type_Maintenance) +
ligne('Vérification périodique à venir', d.Verif_Periodique) +
ligne('Tests fonctionnels', d.Tests_Fonctionnels) +
ligne('Équipement fonctionnel', d.Equipement_Fonctionnel) +
ligne('PR n°', d.PR_Num) + ligne('Coût des achats (€)', d.Cout_Achats_EUR) +
ligne('Temps passé (h)', d.Temps_Passe_h) +
'</table><p class="sign">Nom : ____________________ &nbsp;&nbsp; Date : ____________ &nbsp;&nbsp; Signature : ______________</p>' +
'<h2>Clôture</h2><table>' + ligne('Fiche de maintenance soldée le', '') + ligne('Nom', '') + ligne('Signature', '') + '</table>' +
'<p class="pied">Réf. technique ' + esc(d.ID_FDM) + ' — générée le ' + new Date().toLocaleString('fr-FR') + ' via la webapp chantier.</p>' +
'</body></html>';
}

/* ---------- FICHE EXCEL ---------- */
function genererExcel() {
  const d = donneesFDM();
  const lignes = Object.entries(d)
    .map(([k, v]) => '<tr><td style="background:#f2f4f7;font-weight:bold">' + esc(k) + '</td><td>' + esc(v) + '</td></tr>')
    .join('');
  const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">' +
'<style>td{border:1px solid #999;font-family:Arial;font-size:10pt;padding:4px;vertical-align:top}</style>' +
'</head><body><table>' + lignes + '</table></body></html>';
  telecharger(html, d.ID_FDM + '.xls', 'application/vnd.ms-excel');
  return d;
}

/* ---------- Stockage local ---------- */
const lire   = cle => JSON.parse(localStorage.getItem(cle) || '[]');
const ecrire = (cle, v) => localStorage.setItem(cle, JSON.stringify(v));

function ajouterJournal(d) {
  const j = lire(CLE_JOURNAL); j.push(d); ecrire(CLE_JOURNAL, j.slice(-200));
}
function fileQueue(d) {
  ajouterJournal(d); majBadge();
}
function mettreEnAttente(d) {
  const q = lire(CLE_ATTENTE);
  if (!q.some(x => x.ID_FDM === d.ID_FDM)) q.push(d);
  ecrire(CLE_ATTENTE, q); majBadge();
}
function majBadge() {
  const n = lire(CLE_ATTENTE).length;
  const b = document.getElementById('badgeQueue');
  if (b) b.textContent = n ? n + " fiche(s) en attente d'envoi — elles partiront au retour du réseau" : '';
}

/* ---------- Envoi HTTP vers Power Automate ---------- */
async function posterFiche(d) {
  const url = (window.CONFIG && window.CONFIG.flowUrl) || '';
  if (!url) throw new Error('flowUrl absent');
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(d)
  });
}

let envoiEnCours = false;

async function archiverSharePoint() {
  if (envoiEnCours) return;
  if (typeof verifier === 'function') {
    const err = verifier();
    if (err) return msg(err, false);
  }
  if (!(window.CONFIG && window.CONFIG.flowUrl)) return msg('URL du flux non configurée dans config.json', false);

  const d = donneesFDM();
  d.HtmlFiche = htmlFicheWord(d, '{{NUM_PV}}');
  envoiEnCours = true;
  const bouton = document.getElementById('btnEnvoyer');
  if (bouton) { bouton.disabled = true; bouton.textContent = '⏳ Envoi en cours…'; }

  ajouterJournal(d);
  try {
    if (!navigator.onLine) throw new Error('hors ligne');
    await posterFiche(d);
    msg('Fiche envoyée ✔ — elle apparaîtra dans le suivi SharePoint d’ici une minute.', true);
    if (typeof reinit === 'function') setTimeout(reinit, 1500);
  } catch (e) {
    mettreEnAttente(d);
    msg('Pas de réseau : fiche gardée sur le téléphone, envoi automatique au retour du réseau.', false);
  } finally {
    envoiEnCours = false;
    if (bouton) { bouton.disabled = false; bouton.textContent = '📨 Envoyer la FDM'; }
  }
}

async function viderFile() {
  const q = lire(CLE_ATTENTE);
  if (!q.length) return msg('Aucune fiche en attente', true);
  if (!navigator.onLine) return msg('Toujours pas de réseau', false);
  const reste = [];
  for (const d of q) {
    try { await posterFiche(d); } catch { reste.push(d); }
  }
  ecrire(CLE_ATTENTE, reste);
  majBadge();
  msg(reste.length ? reste.length + ' fiche(s) toujours en attente' : (q.length - reste.length) + ' fiche(s) envoyée(s) ✔', !reste.length);
}

window.addEventListener('online', () => { if (lire(CLE_ATTENTE).length) viderFile(); });
document.addEventListener('DOMContentLoaded', () => {
  majBadge();
  setTimeout(() => { if (navigator.onLine && lire(CLE_ATTENTE).length) viderFile(); }, 3000);
});

/* ---------- Question "Matériel utilisable ?" ---------- */
function ajouterQuestionUtilisable() {
  const zone = document.getElementById('action');
  if (!zone || document.getElementById('grpUtilisable')) return;
  const grp = document.createElement('div');
  grp.className = 'field-group';
  grp.id = 'grpUtilisable';
  const titre = document.createElement('label');
  titre.textContent = 'Matériel utilisable ?';
  const choix = document.createElement('div');
  choix.className = 'choix';
  ['Oui', 'Oui, dégradé', 'Non'].forEach(v => {
    const l = document.createElement('label');
    const r = document.createElement('input');
    r.type = 'radio'; r.name = 'utilisable'; r.value = v;
    l.appendChild(r);
    l.appendChild(document.createTextNode(' ' + v));
    choix.appendChild(l);
  });
  grp.appendChild(titre);
  grp.appendChild(choix);
  zone.closest('.field-group').after(grp);
}
ajouterQuestionUtilisable();