/* ============================================================
   photos.js — prise de photos + insertion dans la fiche Word
   À charger APRÈS fdm.js et fdm-forms.js
   ============================================================ */

const MAX_PHOTOS = 6;
const TAILLE_MAX = 1280;
const QUALITE_JPEG = 0.6;
let photos = [];
let envoiPhotoEnCours = false;

function ajouterPhotos(input) {
  const fichiers = Array.from(input.files || []);
  input.value = '';
  const place = MAX_PHOTOS - photos.length;
  if (place <= 0) return msg('Maximum ' + MAX_PHOTOS + ' photos par fiche', false);
  if (fichiers.length > place) msg('Seules ' + place + ' photo(s) ajoutée(s) (max ' + MAX_PHOTOS + ')', false);
  fichiers.slice(0, place).forEach(f => compresser(f).then(b64 => {
    photos.push({ nom: 'photo' + (photos.length + 1) + '.jpg', base64: b64 });
    renommerPhotos();
    afficherPhotos();
  }).catch(() => msg('Photo illisible : ' + f.name, false)));
}

function compresser(fichier) {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onerror = ko;
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = ko;
      img.onload = () => {
        const r = Math.min(1, TAILLE_MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', QUALITE_JPEG).split(',')[1]);
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

function supprimerPhoto(i) { photos.splice(i, 1); renommerPhotos(); afficherPhotos(); }
function renommerPhotos() { photos.forEach((p, i) => { p.nom = 'photo' + (i + 1) + '.jpg'; }); }

function afficherPhotos() {
  const z = document.getElementById('miniatures');
  if (!z) return;
  z.innerHTML = '';
  photos.forEach((p, i) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:relative;width:90px;height:90px';
    d.innerHTML =
      'data:image/jpeg;base64,' + p.base64 + '' +
      '<button type="button" onclick="supprimerPhoto(' + i + ')" style="position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:50%;border:none;background:#d93838;color:#fff;font-weight:700;cursor:pointer">×</button>';
    z.appendChild(d);
  });
  const n = document.getElementById('nbPhotos');
  if (n) n.textContent = photos.length ? photos.length + ' / ' + MAX_PHOTOS + ' photo(s)' : '';
}

function sectionPhotos(liste) {
  if (!liste.length) return '';
  let h = '<h2>Photos</h2><table>';
  for (let i = 0; i < liste.length; i += 2) {
    h += '<tr>';
    [liste[i], liste[i + 1]].forEach(p => {
      h += p
        ? '<td style="text-align:center;width:50%">C:/fdm/' + p.nom + '" width="300"><br>' + p.nom + '</td>'
        : '<td style="width:50%"></td>';
    });
    h += '</tr>';
  }
  return h + '</table>';
}

function couperLignes(txt) {
  return txt.replace(/></g, '>\r\n<').split('\r\n').map(l => {
    const out = [];
    while (l.length > 900) {
      let p = l.lastIndexOf(' ', 900);
      if (p < 1) p = 900;
      out.push(l.slice(0, p));
      l = l.slice(p);
    }
    out.push(l);
    return out.join('\r\n');
  }).join('\r\n');
}

function mhtFicheWord(d, numPV, liste) {
  let html = htmlFicheWord(d, numPV);
  const sec = sectionPhotos(liste);
  html = html.indexOf('<h2>Clôture</h2>') >= 0
    ? html.replace('<h2>Clôture</h2>', sec + '<h2>Clôture</h2>')
    : html.replace('</body>', sec + '</body>');
  const B = '----=_NextPart_FDM_' + Date.now();
  let m = 'MIME-Version: 1.0\r\n' +
          'Content-Type: multipart/related; boundary="' + B + '"\r\n\r\n' +
          '--' + B + '\r\n' +
          'Content-Location: file:///C:/fdm/fiche.htm\r\n' +
          'Content-Transfer-Encoding: 8bit\r\n' +
          'Content-Type: text/html; charset="utf-8"\r\n\r\n' +
          couperLignes(html) + '\r\n';
  liste.forEach(p => {
    m += '--' + B + '\r\n' +
         'Content-Location: file:///C:/fdm/' + p.nom + '\r\n' +
         'Content-Transfer-Encoding: base64\r\n' +
         'Content-Type: image/jpeg\r\n\r\n' +
         p.base64.match(/.{1,76}/g).join('\r\n') + '\r\n';
  });
  return m + '--' + B + '--\r\n';
}

function genererWord() {
  const d = donneesFDM();
  const blob = new Blob([mhtFicheWord(d, "N° attribué à l'archivage", photos)], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = d.ID_FDM + '.doc';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return d;
}

function ajouterJournal(d) {
  try {
    const leger = Object.assign({}, d);
    delete leger.HtmlFiche; delete leger.Photos;
    const j = lire(CLE_JOURNAL); j.push(leger); ecrire(CLE_JOURNAL, j.slice(-200));
  } catch (e) { }
}

function mettreEnAttente(d) {
  const q = lire(CLE_ATTENTE);
  if (q.some(x => x.ID_FDM === d.ID_FDM)) return;
  try {
    q.push(d); ecrire(CLE_ATTENTE, q);
  } catch (e) {
    q.pop();
    const sans = Object.assign({}, d, { Photos: [] });
    sans.HtmlFiche = mhtFicheWord(sans, '{{NUM_PV}}', []);
    try {
      q.push(sans); ecrire(CLE_ATTENTE, q);
      setTimeout(() => msg('Mémoire du téléphone pleine : fiche gardée SANS les photos.', false), 300);
    } catch (e2) {
      setTimeout(() => msg('Mémoire pleine : fiche NON conservée. Utilise "Générer la fiche Word" en secours.', false), 300);
    }
  }
  majBadge();
}

async function archiverSharePoint() {
  if (envoiPhotoEnCours) return;
  if (typeof verifier === 'function') {
    const err = verifier();
    if (err) return msg(err, false);
  }
  if (!(window.CONFIG && window.CONFIG.flowUrl)) return msg('URL du flux non configurée dans config.json', false);

  const d = donneesFDM();
  const nbPhotos = photos.length;
    d.HtmlFiche = mhtFicheWord(d, '{{NUM_PV}}', photos);

  envoiPhotoEnCours = true;
  const bouton = document.getElementById('btnEnvoyer');
  if (bouton) { bouton.disabled = true; bouton.textContent = '⏳ Envoi en cours…'; }
  try {
    ajouterJournal(d);
    if (!navigator.onLine) throw new Error('hors ligne');
    await posterFiche(d);
    msg('Fiche envoyée ✔ (' + nbPhotos + ' photo(s)) — elle apparaîtra dans le suivi SharePoint d’ici une minute.', true);
    if (typeof reinit === 'function') setTimeout(reinit, 1500);
  } catch (e) {
    mettreEnAttente(d);
    msg('Pas de réseau : fiche gardée sur le téléphone, envoi automatique au retour du réseau.', false);
  } finally {
    envoiPhotoEnCours = false;
    if (bouton) { bouton.disabled = false; bouton.textContent = '📨 Envoyer la FDM'; }
  }
}

// Réinitialisation : vide aussi les photos
if (typeof reinit === 'function') {
  const reinitSansPhotos = reinit;
  reinit = function () { reinitSansPhotos(); photos = []; afficherPhotos(); };
}