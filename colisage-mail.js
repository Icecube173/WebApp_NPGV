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