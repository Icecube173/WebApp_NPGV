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

    // Chantier : 1) liste de la page Colisage si remplie, 2) sinon chantier mémorisé par la page principale
  function lireChantier() {
    const champ = valeurChamp('chantier');
    if (champ) return champ;

    const cles = Object.keys(localStorage).filter(function (k) { return /chantier/i.test(k); });
    // ignore la clé de la liste Colisage et les listes complètes de chantiers
    for (const k of cles) {
      if (k === 'colisageChantier') continue;
      const brut = localStorage.getItem(k);
      if (!brut) continue;
      try {
        const v = JSON.parse(brut);
        if (typeof v === 'string' && v) return v;
        if (v && !Array.isArray(v) && typeof v === 'object') {
          const code = v.code || v.numero || v.nom || v.libelle || v.id;
          if (code) return String(code);
        }
      } catch (_) {
        return brut.trim();   // valeur simple non JSON, ex. WEF-25-ETV-MTN-SLB2
      }
    }
    return localStorage.getItem('colisageChantier') || '';
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

  // --- 4. Liste des chantiers (chantiers.json) + memorisation du choix ---
  async function initChantier() {
    const sel = document.getElementById('chantier');
    if (!sel) return;
    try {
      const data = await fetch('chantiers.json').then(function (r) { return r.json(); });
      const liste = Array.isArray(data) ? data : (data.chantiers || Object.values(data));
      liste.forEach(function (c) {
        const val = typeof c === 'string'
          ? c
          : (c.code || c.numero || c.nom || c.libelle || c.id || JSON.stringify(c));
        const txt = typeof c === 'string' ? c : (c.libelle || c.nom || val);
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = txt;
        sel.appendChild(opt);
      });
    } catch (e) { console.error('chantiers.json :', e); }
    sel.value = '';
    sel.value = lireChantier();
    sel.addEventListener('change', function () { localStorage.setItem('colisageChantier', sel.value); });
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