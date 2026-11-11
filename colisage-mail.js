// colisage-mail.js : envoi du fichier Excel de colisage par mail via Power Automate

async function envoyerColisageParMail(wb, nomFichier, infos) {
  const cfg = await fetch('config.json', { cache: 'no-store' }).then(r => r.json());
  if (!cfg.colisageFlowUrl) {
    alert("URL du flux colisage non configurée dans config.json");
    return false;
  }

  const payload = {
    conteneur: infos.conteneur || '',
    chantier: infos.chantier || '',
    operateur: infos.operateur || '',
    nbEquipements: infos.nbEquipements || 0,
    nomFichier: nomFichier,
    contenuBase64: XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
  };

  try {
    const rep = await fetch(cfg.colisageFlowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    alert('✅ Colisage ' + payload.conteneur + ' envoyé par mail.');
    return true;
  } catch (e) {
    console.error(e);
    // Secours (pas de réseau sur site, flux en erreur…) : partage manuel du fichier
    await partagerColisage(wb, nomFichier);
    return false;
  }
}

// Secours : ouvre le menu de partage du téléphone (Outlook, Teams…) avec le fichier joint,
// ou télécharge simplement le fichier sur PC.
async function partagerColisage(wb, nomFichier) {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fichier = new File([data], nomFichier, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    await navigator.share({ files: [fichier], title: nomFichier });
  } else {
    XLSX.writeFile(wb, nomFichier);
    alert("⚠️ Envoi automatique impossible : le fichier a été téléchargé, joins-le à un mail manuellement.");
  }
}

envoyerColisageParMail(wb, nomFichier, {
  conteneur: codeConteneur,          // variable qui contient le code SAP scanné du conteneur
  chantier: chantierCourant,         // si disponible
  operateur: nomOperateur,           // si disponible
  nbEquipements: listeEquipements.length
});

// --- Interception automatique du téléchargement Excel généré par colisage.js ---
(function () {
  const blobsParUrl = new Map();

  // 1. Mémorise chaque fichier (Blob) transformé en lien de téléchargement
  const createOriginal = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = createOriginal.call(URL, obj);
    if (obj instanceof Blob) blobsParUrl.set(url, obj);
    return url;
  };

  // 2. Au moment du "clic" de téléchargement, si c'est un fichier Excel/CSV → envoi au flux
  const clickOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      const nom = this.download;
      const blob = blobsParUrl.get(this.href);
      if (nom && blob && /\.(xlsx|xls|csv)$/i.test(nom)) {
        envoyerColisageParMail(blob, nom, { conteneur: extraireConteneur(nom) });
      }
    } catch (e) {
      console.error('Interception colisage :', e);
    }
    return clickOriginal.apply(this, arguments); // le téléchargement normal continue
  };

  // Déduit le code conteneur à partir du nom du fichier (ex. "Colisage_WEEU051701-0_2026-11-10.xlsx")
  function extraireConteneur(nom) {
    const morceaux = nom.replace(/\.(xlsx|xls|csv)$/i, '').split('_');
    return morceaux.length > 1 ? morceaux[1] : morceaux[0];
  }
})();