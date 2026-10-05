/* ============================================================
   colisage.js — scan QR conteneur + équipements -> Excel (.xlsx)
   - lecture QR : BarcodeDetector natif (Android/Chrome),
     sinon jsQR chargé à la demande, sinon saisie manuelle / scannette
   - données gardées sur le téléphone (fonctionne sans réseau)
   - export .xlsx natif (aucune librairie externe)
   ============================================================ */

const CLE_COLIS = 'colisageNPGV';
let etat = JSON.parse(localStorage.getItem(CLE_COLIS) || '{"courant":"","conteneurs":{}}');
let conteneursRef = [], equipementsRef = [];
let modeScan = 'conteneur';          // 'conteneur' | 'equipement'
let flux = null, detecteur = null, boucle = null, dernierCode = '', dernierInstant = 0;

const $ = id => document.getElementById(id);
const sauver = () => localStorage.setItem(CLE_COLIS, JSON.stringify(etat));
const maintenant = () => new Date().toLocaleString('fr-FR');

function msgC(t, ok) {
  const s = $('status');
  s.textContent = t;
  s.className = 'status ' + (ok ? 'ok' : 'erreur');
  clearTimeout(msgC.t);
  msgC.t = setTimeout(() => { s.className = 'status'; }, 4000);
}

/* ---------- Référentiels (facultatifs) ---------- */
Promise.all([
  fetch('conteneurs.json').then(r => r.ok ? r.json() : []).catch(() => []),
  fetch('equipements.json').then(r => r.ok ? r.json() : []).catch(() => [])
]).then(([c, e]) => { conteneursRef = c || []; equipementsRef = e || []; afficher(); });

function nomConteneur(sap) {
  const c = conteneursRef.find(x => String(x.sap) === sap);
  return c ? (c.reference || c.designation || '') : '';
}
function nomEquipement(sap) {
  const e = equipementsRef.find(x => String(x.sap || '') === sap || String(x.ref || '') === sap);
  return e ? (e.designation || '') : '';
}

/* ---------- Nettoyage du contenu du QR ----------
   Si le QR contient du texte autour, on garde le 1er nombre de 6 à 10 chiffres.
   Sinon on garde le contenu brut. */
function lireCode(brut) {
  const t = String(brut || '').trim();
  const m = t.match(/\d{6,10}/);
  return m ? m[0] : t;
}

/* ---------- Traitement d'un code ---------- */
function traiterCode(brut) {
  const code = lireCode(brut);
  if (!code) return;
  const t = Date.now();
  if (code === dernierCode && t - dernierInstant < 2500) return;   // même QR encore devant la caméra
  dernierCode = code; dernierInstant = t;

  // Un QR de conteneur connu (conteneurs.json) bascule toujours sur ce conteneur
  const estConteneurConnu = conteneursRef.some(x => String(x.sap) === code);
  if (modeScan === 'conteneur' || estConteneurConnu) {
    if (!etat.conteneurs[code]) {
      etat.conteneurs[code] = { sap: code, nom: nomConteneur(code), debut: maintenant(), items: [] };
    }
    etat.courant = code;
    sauver();
    bip(true);
    msgC('Conteneur ' + code + ' sélectionné ✔ — scanne maintenant les équipements', true);
    passerMode('equipement');
    afficher();
    return;
  }

  const c = etat.conteneurs[etat.courant];
  if (!c) { passerMode('conteneur'); return msgC('Scanne d’abord le conteneur', false); }
  if (code === c.sap) return msgC('C’est le QR du conteneur, pas d’un équipement', false);

  if (c.items.some(i => i.sap === code)) { bip(false); return msgC('Déjà scanné dans ce conteneur : ' + code, false); }
  const ailleurs = Object.values(etat.conteneurs).find(x => x.sap !== c.sap && x.items.some(i => i.sap === code));
  if (ailleurs && !confirm('L’équipement ' + code + ' est déjà dans le conteneur ' + ailleurs.sap + '.\nLe déplacer dans ' + c.sap + ' ?')) return;
  if (ailleurs) ailleurs.items = ailleurs.items.filter(i => i.sap !== code);

  c.items.push({ sap: code, designation: nomEquipement(code), heure: maintenant() });
  sauver();
  bip(true);
  msgC('➕ ' + code + (nomEquipement(code) ? ' — ' + nomEquipement(code) : '') + ' (' + c.items.length + ')', true);
  afficher();
}

function bip(ok) {
  try { navigator.vibrate && navigator.vibrate(ok ? 80 : [80, 60, 80]); } catch (e) {}
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(); o.frequency.value = ok ? 1200 : 300;
    o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.12);
  } catch (e) {}
}

function passerMode(m) {
  modeScan = m;
  $('modeTxt').textContent = m === 'conteneur' ? '1️⃣ Scanne le QR du CONTENEUR' : '2️⃣ Scanne les ÉQUIPEMENTS du conteneur ' + etat.courant;
  $('modeTxt').style.background = m === 'conteneur' ? '#fff8e1' : '#e4f6ec';
}

/* ---------- Caméra ---------- */
async function demarrerCamera() {
  if (flux) return arreterCamera();
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) { flux = null; return msgC('Caméra inaccessible : autorise la caméra pour ce site', false); }
  const v = $('video');
  v.srcObject = flux; v.setAttribute('playsinline', ''); await v.play();
  $('zoneVideo').style.display = 'block';
  $('btnCamera').textContent = '⏹️ Arrêter la caméra';

  if ('BarcodeDetector' in window) {
    try { detecteur = new BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'code_128'] }); } catch (e) { detecteur = null; }
  }
  if (!detecteur && !window.jsQR) await chargerJsQR();
  boucle = setInterval(analyser, 250);
}

function arreterCamera() {
  clearInterval(boucle); boucle = null;
  if (flux) flux.getTracks().forEach(t => t.stop());
  flux = null;
  $('zoneVideo').style.display = 'none';
  $('btnCamera').textContent = '📷 Démarrer la caméra';
}

function chargerJsQR() {
  return new Promise(ok => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = ok;
    s.onerror = () => { msgC('Lecteur QR indisponible hors réseau sur ce téléphone : utilise la saisie manuelle', false); ok(); };
    document.head.appendChild(s);
  });
}

const toile = document.createElement('canvas');
async function analyser() {
  const v = $('video');
  if (!v.videoWidth) return;
  try {
    if (detecteur) {
      const r = await detecteur.detect(v);
      if (r.length) traiterCode(r[0].rawValue);
    } else if (window.jsQR) {
      toile.width = v.videoWidth; toile.height = v.videoHeight;
      const ctx = toile.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, toile.width, toile.height);
      const r = jsQR(img.data, img.width, img.height);
      if (r && r.data) traiterCode(r.data);
    }
  } catch (e) {}
}

/* ---------- Saisie manuelle / scannette Bluetooth ---------- */
function saisieManuelle() {
  const i = $('saisie');
  if (i.value.trim()) { dernierCode = ''; traiterCode(i.value); }
  i.value = ''; i.focus();
}

/* ---------- Affichage ---------- */
function afficher() {
  const c = etat.conteneurs[etat.courant];
  $('titreConteneur').textContent = c ? 'Conteneur ' + c.sap + (c.nom ? ' — ' + c.nom : '') + ' : ' + c.items.length + ' équipement(s)' : 'Aucun conteneur sélectionné';
  const l = $('listeItems'); l.innerHTML = '';
  if (c) c.items.slice().reverse().forEach(it => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 4px;border-bottom:1px solid #eee';
    const t = document.createElement('div');
    t.style.flex = '1';
    t.textContent = it.sap + (it.designation ? ' — ' + it.designation : '');
    const b = document.createElement('button');
    b.textContent = '🗑️'; b.className = 'btn-copy'; b.style.background = '#d93838';
    b.onclick = () => { if (confirm('Retirer ' + it.sap + ' ?')) { c.items = c.items.filter(x => x.sap !== it.sap); sauver(); afficher(); } };
    d.appendChild(t); d.appendChild(b); l.appendChild(d);
  });

  const r = $('recap'); r.innerHTML = '';
  Object.values(etat.conteneurs).forEach(x => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;flex-wrap:wrap';
    const t = document.createElement('div');
    t.style.cssText = 'flex:1;min-width:150px;font-weight:' + (x.sap === etat.courant ? '700' : '400');
    t.textContent = x.sap + (x.nom ? ' (' + x.nom + ')' : '') + ' — ' + x.items.length + ' éq.';
    const bo = document.createElement('button'); bo.className = 'btn-copy'; bo.textContent = 'Ouvrir';
    bo.onclick = () => { etat.courant = x.sap; sauver(); passerMode('equipement'); afficher(); };
    const bx = document.createElement('button'); bx.className = 'btn-copy'; bx.style.background = '#1f9d55'; bx.textContent = '📊 Excel';
    bx.onclick = () => exporterConteneur(x.sap);
    const bs = document.createElement('button'); bs.className = 'btn-copy'; bs.style.background = '#d93838'; bs.textContent = '🗑️';
    bs.onclick = () => { if (confirm('Supprimer la liste du conteneur ' + x.sap + ' ?')) { delete etat.conteneurs[x.sap]; if (etat.courant === x.sap) { etat.courant = ''; passerMode('conteneur'); } sauver(); afficher(); } };
    d.appendChild(t); d.appendChild(bo); d.appendChild(bx); d.appendChild(bs); r.appendChild(d);
  });
  if (!r.children.length) r.textContent = 'Aucune liste en cours.';
}

function changerConteneur() { passerMode('conteneur'); msgC('Scanne le QR du nouveau conteneur', true); }

/* ---------- Export Excel ---------- */
function exporterConteneur(sap) {
  const c = etat.conteneurs[sap];
  if (!c || !c.items.length) return msgC('Aucun équipement dans ce conteneur', false);
  const chantier = (() => { try { return JSON.parse(localStorage.getItem('chantier') || '{}').nom || ''; } catch (e) { return ''; } })();
  const op = $('operateur').value.trim();
  localStorage.setItem('colisageOperateur', op);
  const lignes = [['N°', 'Conteneur SAP', 'Conteneur', 'Equipement SAP', 'Désignation', 'Date scan', 'Opérateur', 'Chantier']];
  c.items.forEach((it, i) => lignes.push([i + 1, c.sap, c.nom || '', it.sap, it.designation || '', it.heure, op, chantier]));
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const nom = 'Colisage_' + c.sap + '_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.xlsx';
  const blob = new Blob([creerXlsx(lignes, 'Colisage ' + c.sap)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  msgC('Fichier ' + nom + ' créé ✔', true);
}

/* ---------- Générateur XLSX minimal (zip non compressé) ---------- */
function creerXlsx(lignes, nomFeuille) {
  const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const lt = '<', gt = '>';
  const balise = (n, attrs, contenu) => lt + n + (attrs ? ' ' + attrs : '') + (contenu === undefined ? '/' + gt : gt + contenu + lt + '/' + n + gt);
  const entete = lt + '?xml version="1.0" encoding="UTF-8" standalone="yes"?' + gt;

  let rows = '';
  lignes.forEach((l, r) => {
    let cells = '';
    l.forEach((v, c) => {
      const ref = col(c) + (r + 1), st = r === 0 ? ' s="1"' : '';
      cells += typeof v === 'number'
        ? balise('c', 'r="' + ref + '"' + st, balise('v', '', v))
        : balise('c', 'r="' + ref + '" t="inlineStr"' + st, balise('is', '', balise('t', 'xml:space="preserve"', x(v))));
    });
    rows += balise('row', 'r="' + (r + 1) + '"', cells);
  });
  const largeurs = [6, 16, 22, 16, 45, 20, 18, 28].map((w, i) => balise('col', 'min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"')).join('');
  const derniere = col(lignes[0].length - 1) + lignes.length;

  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const NSR = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const fichiers = {
    '[Content_Types].xml': entete + balise('Types', 'xmlns="http://schemas.openxmlformats.org/package/2006/content-types"',
      balise('Default', 'Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"') +
      balise('Default', 'Extension="xml" ContentType="application/xml"') +
      balise('Override', 'PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"') +
      balise('Override', 'PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"') +
      balise('Override', 'PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"')),
    '_rels/.rels': entete + balise('Relationships', 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"',
      balise('Relationship', 'Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"')),
    'xl/workbook.xml': entete + balise('workbook', NS + ' ' + NSR,
      balise('sheets', '', balise('sheet', 'name="' + x(nomFeuille.slice(0, 31)) + '" sheetId="1" r:id="rId1"'))),
    'xl/_rels/workbook.xml.rels': entete + balise('Relationships', 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"',
      balise('Relationship', 'Id="rId1" Type="' + REL + '/worksheet" Target="worksheets/sheet1.xml"') +
      balise('Relationship', 'Id="rId2" Type="' + REL + '/styles" Target="styles.xml"')),
    'xl/styles.xml': entete + balise('styleSheet', NS,
      balise('fonts', 'count="2"', balise('font', '', balise('sz', 'val="11"') + balise('name', 'val="Arial"')) +
                                   balise('font', '', balise('b') + balise('color', 'rgb="FFFFFFFF"') + balise('sz', 'val="11"') + balise('name', 'val="Arial"'))) +
      balise('fills', 'count="3"', balise('fill', '', balise('patternFill', 'patternType="none"')) +
                                   balise('fill', '', balise('patternFill', 'patternType="gray125"')) +
                                   balise('fill', '', balise('patternFill', 'patternType="solid"', balise('fgColor', 'rgb="FF0078D7"')))) +
      balise('borders', 'count="1"', balise('border')) +
      balise('cellStyleXfs', 'count="1"', balise('xf', 'numFmtId="0" fontId="0" fillId="0" borderId="0"')) +
      balise('cellXfs', 'count="2"', balise('xf', 'numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"') +
                                     balise('xf', 'numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"')) +
      balise('cellStyles', 'count="1"', balise('cellStyle', 'name="Normal" xfId="0" builtinId="0"'))),
    'xl/worksheets/sheet1.xml': entete + balise('worksheet', NS + ' ' + NSR,
      balise('sheetViews', '', balise('sheetView', 'workbookViewId="0"', balise('pane', 'ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"'))) +
      balise('cols', '', largeurs) +
      balise('sheetData', '', rows) +
      balise('autoFilter', 'ref="A1:' + derniere + '"'))
  };
  return zipStocke(fichiers);
}

function zipStocke(fichiers) {
  const enc = new TextEncoder();
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const parts = [], central = []; let offset = 0;
  Object.entries(fichiers).forEach(([nom, txt]) => {
    const n = enc.encode(nom), d = enc.encode(txt), c = crc(d);
    const loc = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(n.length), u16(0));
    parts.push(new Uint8Array(loc), n, d);
    central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c), u32(d.length), u32(d.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), n);
    offset += loc.length + n.length + d.length;
  });
  const tailleC = central.reduce((s, b) => s + b.length, 0);
  const fin = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(Object.keys(fichiers).length), u16(Object.keys(fichiers).length), u32(tailleC), u32(offset), u16(0)));
  const tout = parts.concat(central, [fin]);
  const out = new Uint8Array(tout.reduce((s, b) => s + b.length, 0));
  let p = 0; tout.forEach(b => { out.set(b, p); p += b.length; });
  return out;
}

/* ---------- Démarrage ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('operateur').value = localStorage.getItem('colisageOperateur') || '';
  $('saisie').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saisieManuelle(); } });
  passerMode(etat.courant && etat.conteneurs[etat.courant] ? 'equipement' : 'conteneur');
  afficher();
});
window.addEventListener('pagehide', arreterCamera);
