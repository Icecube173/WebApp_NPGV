// colisage-mail.js : bouton "Envoyer le colisage" -> Power Automate (archivage + mail)
(function () {
  let dernierFichier = null; // { blob, nom }

  // --- 1. Memoriser le dernier fichier Excel/CSV telecharge par colisage.js ---
  const blobsParUrl = new Map();
  const createOriginal = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = createOriginal.call(URL, obj);
    if (obj instanceof Blob) blobsParUrl.set(url, obj);
    return url;
  };
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      const nom = this.download;
      const blob = blobsParUrl.get(this.href);
      if (nom && blob && /\.(xlsx|xls|csv)$/i.test(nom)) {
        dernierFichier = { blob: blob, nom: nom };
        majBouton();
      }
    } catch (e) { console.error('Colisage mail :', e); }
    return clickOriginal.apply(this, arguments);
  };

  // --- 2. Outils ---
  function blobVersBase64(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  function extraireConteneur(nom) {
    const m = nom.replace(/\.(xlsx|xls|csv)$/i, '').split('_');
    return m.length > 1 ? m[1] : m[0];
  }
  function choisirFichier() {
    return new Promise(function (resolve) {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.xlsx,.xls,.csv';
      inp.onchange = function () { resolve(inp.files[0] || null); };
      inp.click();
    });
  }
  function valeurChamp(id) {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  // Chantier sélectionné sur la page principale (index.html)
  // index.html enregistre : localStorage 'chantierId' = id, 'chantier' = {id, nom, ...}
  let listeChantiers = [];

  function lireChantier() {
    // 1) Liste de la page Colisage si l'utilisateur l'a changée
    const sel = document.getElementById('chantier');
    let id = sel && sel.value ? sel.value : '';

    // 2) Sinon, chantier choisi sur la page principale
    if (!id) id = localStorage.getItem('chantierId') || '';

    // Fiche complète : d'abord dans chantiers.json, sinon dans la clé 'chantier'
    let fiche = listeChantiers.find(function (c) { return String(c.id) === String(id); });
    if (!fiche) {
      try { fiche = JSON.parse(localStorage.getItem('chantier') || 'null'); } catch (_) { fiche = null; }
    }
    if (fiche && fiche.nom) return fiche.nom;
    return id ? String(id) : '';
  }

  // --- 3. Envoi au flux Power Automate ---
  async function envoyer(blob, nom) {
    const chantier = lireChantier();
    if (!chantier && !confirm('Aucun chantier sélectionné. Envoyer quand même ?')) return;

    const btn = document.getElementById('btnEnvoyerColisage');
    btn.disabled = true;
    btn.textContent = '⏳ Envoi en cours…';
    try {
      const cfg = await fetch('config.json', { cache: 'no-store' }).then(function (r) { return r.json(); });
      if (!cfg.colisageFlowUrl) throw new Error('colisageFlowUrl absent de config.json');

      const payload = {
        conteneur: extraireConteneur(nom),
        chantier: chantier,
        operateur: valeurChamp('operateur'),
        nbEquipements: 0,
        nomFichier: nom,
        contenuBase64: await blobVersBase64(blob)
      };
      const rep = await fetch(cfg.colisageFlowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!rep.ok) throw new Error('HTTP ' + rep.status);
      alert('✅ Colisage « ' + nom + ' » envoyé par mail (chantier : ' + (chantier || 'non renseigné') + ').');
    } catch (e) {
      console.error(e);
      const f = new File([blob], nom, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: nom }); } catch (_) {}
      } else {
        alert('⚠️ Envoi impossible (' + e.message + '). Joins le fichier à un mail manuellement.');
      }
    } finally {
      btn.disabled = false;
      majBouton();
    }
  }

    async function initChantier() {
    const sel = document.getElementById('chantier');
    try {
      listeChantiers = await fetch('chantiers.json').then(function (r) { return r.json(); });
    } catch (e) { console.error('chantiers.json :', e); }
    if (!sel) return;

    // Mêmes valeurs que sur index.html : value = id, texte = nom
    sel.innerHTML = '<option value="">— Choisir le chantier —</option>';
    listeChantiers.forEach(function (c) {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nom;
      sel.appendChild(o);
    });

    // Pré-sélection = chantier de la page principale
    sel.value = localStorage.getItem('chantierId') || '';

    // Un changement ici met aussi à jour le chantier de la page principale
    sel.addEventListener('change', function () {
      localStorage.setItem('chantierId', sel.value);
      const c = listeChantiers.find(function (x) { return String(x.id) === sel.value; });
      localStorage.setItem('chantier', c ? JSON.stringify(c) : '');
    });
  }

  // --- 5. Le bouton ---
  function majBouton() {
    const btn = document.getElementById('btnEnvoyerColisage');
    if (!btn) return;
    btn.textContent = dernierFichier
      ? '📧 Envoyer le colisage (' + dernierFichier.nom + ')'
      : '📧 Envoyer le colisage';
  }
  function creerBouton() {
    let btn = document.getElementById('btnEnvoyerColisage');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btnEnvoyerColisage';
      btn.className = 'btn';
      document.body.appendChild(btn);
    }
    btn.type = 'button';
    majBouton();
    btn.addEventListener('click', async function () {
      if (dernierFichier) return envoyer(dernierFichier.blob, dernierFichier.nom);
      const f = await choisirFichier();
      if (f) envoyer(f, f.name);
    });
  }

  // --- 6. Demarrage ---
  function demarrer() {
    creerBouton();   // en premier : le bouton s'affiche meme si chantiers.json pose probleme
    initChantier();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();