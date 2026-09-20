/* ============================================================
   fdm.js — génération Word / Excel + archivage SharePoint
   À placer à la racine du dépôt, appelé par fdm.html
   ============================================================ */

const val   = id => (document.getElementById(id)?.value || '').trim();
const radio = name => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };

/* ---------- Identifiant unique de la fiche ---------- */
function idFDM() {
  const c = window.chantierCourant || {};
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `FDM-${(c.site || 'XXX')}${(c.tranche || '')}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
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
    Lien_Fiche: ''
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

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const ligne = (l, v) => `<tr><td class="lab">${esc(l)}</td><td>${esc(v)}</td></tr>`;

/* ---------- 1) FICHE WORD (.doc, ouvert nativement par Word) ---------- */
function genererWord() {
  const d = donneesFDM();
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
@page { size:21cm 29.7cm; margin:2cm; }
body { font-family:Arial, sans-serif; font-size:10pt; }
h1 { font-size:14pt; text-align:center; border-bottom:2px solid #0078D7; padding-bottom:6px; }
h2 { font-size:11pt; background:#0078D7; color:#fff; padding:4px 8px; margin-top:16px; }
table { width:100%; border-collapse:collapse; margin-top:6px; }
td { border:1px solid #888; padding:5px 7px; vertical-align:top; }
td.lab { width:32%; background:#f2f4f7; font-weight:bold; }
.sign { margin-top:18px; font-size:9pt; }
.pied { margin-top:24px; font-size:8pt; color:#555; text-align:center; }
</style></head><body>
<h1>FICHE DE MAINTENANCE<br><span style="font-size:11pt">${esc(d.ID_FDM)}</span></h1>

<h2>Identification</h2>
<table>
${ligne('Chantier', d.Chantier)}${ligne("N° d'affaire", d.N_Affaire)}
${ligne('Lieu / Tranche', d.Lieu_Tranche)}${ligne('Network', d.Network)}
${ligne('Équipement', d.Equipement)}${ligne('Réf. SAP', d.Ref_SAP)}
${ligne('Autre réf.', d.Autre_Ref)}${ligne('Circonstances', d.Circonstances)}
</table>

<h2>Dysfonctionnement — demande de maintenance</h2>
<table>
${ligne('Symptômes / description du problème', d.Symptomes)}
${ligne('Intervention / action corrective immédiate', d.Action_Immediate)}
${ligne('Nom', d.Redacteur)}${ligne('Date', d.Date_Constat)}
</table>
<p class="sign">Signature : ______________________</p>

<h2>Diagnostic</h2>
<table>${ligne('Diagnostic', d.Diagnostic)}${ligne('Type de panne', d.Type_Panne)}</table>

<h2>Description de la maintenance</h2>
<table>
${ligne('Description de la maintenance', d.Description_Maintenance)}
${ligne('Type de maintenance', d.Type_Maintenance)}
${ligne('Vérification périodique à venir', d.Verif_Periodique)}
${ligne('Tests fonctionnels', d.Tests_Fonctionnels)}
${ligne('Équipement fonctionnel', d.Equipement_Fonctionnel)}
${ligne('PR n°', d.PR_Num)}${ligne('Coût des achats (€)', d.Cout_Achats_EUR)}
${ligne('Temps passé (h)', d.Temps_Passe_h)}
</table>
<p class="sign">Nom : ____________________ &nbsp;&nbsp; Date : ____________ &nbsp;&nbsp; Signature : ______________</p>

<h2>Clôture</h2>
<table>${ligne('Fiche de maintenance soldée le', '')}${ligne('Nom', '')}${ligne('Signature', '')}</table>

<p class="pied">Fiche générée le ${new Date().toLocaleString('fr-FR')} via la webapp chantier.</p>
</body></html>`;
  telecharger(html, d.ID_FDM + '.doc', 'application/msword');
  return d;
}

/* ---------- 2) FICHE EXCEL (.xls lisible par Excel) ---------- */
function genererExcel() {
  const d = donneesFDM();
  const lignes = Object.entries(d)
    .map(([k, v]) => `<tr><td style="background:#f2f4f7;font-weight:bold">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>FDM</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>td{border:1px solid #999;font-family:Arial;font-size:10pt;padding:4px;vertical-align:top}</style>
</head><body><table>${lignes}</table></body></html>`;
  telecharger(html, d.ID_FDM + '.xls', 'application/vnd.ms-excel');
  return d;
}

/* ---------- 3) ARCHIVAGE SHAREPOINT (via Power Automate) ---------- */
async function archiverSharePoint() {
  const d = donneesFDM();
  const url = (window.CONFIG && window.CONFIG.flowUrl) || '';
  if (!url) return msg("URL du flux non configurée dans config.json", false);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    });
    if (!r.ok) throw new Error(r.status);
    msg('Fiche ' + d.ID_FDM + ' archivée sur SharePoint ✔', true);
    filePending(false, d);
  } catch (e) {
    fileQueue(d);
    msg('Pas de réseau : fiche mise en file d’attente, elle partira à la reconnexion.', false);
  }
}

/* ---------- File d'attente hors ligne ---------- */
function fileQueue(d) {
  const q = JSON.parse(localStorage.getItem('fdmQueue') || '[]');
  q.push(d); localStorage.setItem('fdmQueue', JSON.stringify(q));
  majBadge();
}
function filePending(_, d) { majBadge(); }
function majBadge() {
  const q = JSON.parse(localStorage.getItem('fdmQueue') || '[]');
  const b = document.getElementById('badgeQueue');
  if (b) { b.textContent = q.length ? `${q.length} fiche(s) en attente d'envoi` : ''; }
}
async function viderFile() {
  const url = (window.CONFIG && window.CONFIG.flowUrl) || '';
  let q = JSON.parse(localStorage.getItem('fdmQueue') || '[]');
  if (!q.length) return msg('Aucune fiche en attente', true);
  const reste = [];
  for (const d of q) {
    try {
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(d) });
      if (!r.ok) throw new Error();
    } catch { reste.push(d); }
  }
  localStorage.setItem('fdmQueue', JSON.stringify(reste));
  majBadge();
  msg(reste.length ? `${reste.length} fiche(s) toujours en attente` : 'File vidée ✔', !reste.length);
}

window.addEventListener('online', viderFile);
document.addEventListener('DOMContentLoaded', majBadge);
