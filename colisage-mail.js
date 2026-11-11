// colisage-mail.js : bouton "Envoyer le colisage" → Power Automate (archivage + mail)
(function () {
  let dernierFichier = null; // { blob, nom }

  // --- 1. Mémoriser le dernier fichier Excel/CSV téléchargé par colisage.js ---
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
        dernierFichier = { blob, nom };
        majBouton();
      }
    } catch (e) { console.error('Colisage mail :', e); }
    return clickOriginal.apply(this, arguments);
  };

  // --- 2. Outils ---
  function blobVersBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  function extraireConteneur(nom) {
    const m = nom.replace(/\.(xlsx|xls|csv)$/i, '').split('_');
    return m.length > 1 ? m[1] : m[0];
  }
  function choisirFichier() {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.xlsx,.xls,.csv';
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
  }

  // --- 3. Envoi au flux Power Automate ---
  async function envoyer(blob, nom) {
    const btn = document.getElementById('btnEnvoyerColisage');
    btn.disabled = true;
    btn.textContent = '⏳ Envoi en cours…';
    try {
      const cfg = await fetch('config.json', { cache: 'no-store' }).then(r => r.json());
      if (!cfg.colisageFlowUrl) throw new Error('colisageFlowUrl absent de config.json');

      const operateur = (document.getElementById('operateur') || {}).value || '';
      const payload = {
        conteneur: extraireConteneur(nom),
        chantier: '',
        operateur: operateur,
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
      alert('✅ Colisage « ' + nom + ' » envoyé par mail.');
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

  // --- 4. Le bouton ---
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
    btn.addEventListener('click', async () => {
      if (dernierFichier) return envoyer(dernierFichier.blob, dernierFichier.nom);
      const f = await choisirFichier();
      if (f) envoyer(f, f.name);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', creerBouton);
  else creerBouton();
})();