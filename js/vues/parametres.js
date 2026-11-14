// Paramètres : infos du site, ouverture des commandes, sauvegardes
import { parametres, enregistrer, mode, exporterTout, importerSauvegarde, importerCatalogueSite, reinitialiserDemo, deconnexion, liste, utilisateurCourant, messageErreur } from '../store.js';
import * as brouillon from '../brouillon.js';
import { $, esc, isoJour, toast, confirmer, champ, interrupteur, telecharger, BTN } from '../ui.js';

export default {
  render(el) {
    const p = parametres();
    // Saisie en cours : la garder si l'écran est redessiné ou l'appli rouverte
    const ancien = $('#form-infos', el);
    const b = brouillon.lire();
    const enCours = brouillon.estActif('parametres') && ancien ? brouillon.champsDe(ancien) : (b?.type === 'parametres' ? b.champs : null);
    const nbProduits = liste('produits').length;
    el.innerHTML = `
      <h1 class="hidden lg:block font-display text-3xl mb-6">Paramètres</h1>
      <div class="grid lg:grid-cols-2 gap-5 items-start">
        <form id="form-infos" class="bg-white rounded-2xl border border-brand-200 p-5 space-y-4" novalidate>
          <div><h2 class="font-semibold text-lg">Infos affichées sur le site</h2><p class="text-sm text-brand-600">Téléphone, e-mail, adresse et horaires de la page Contact.</p></div>
          <div class="grid sm:grid-cols-2 gap-3">
            ${champ({ id: 'pa-telephone', label: 'Téléphone', type: 'tel', valeur: p.telephone })}
            ${champ({ id: 'pa-email', label: 'E-mail', type: 'email', valeur: p.email, aide: 'Laisser vide pour le masquer.' })}
          </div>
          ${champ({ id: 'pa-adresse', label: 'Adresse de retrait', valeur: p.adresse })}
          <div class="grid sm:grid-cols-2 gap-3">
            ${champ({ id: 'pa-horairesSemaine', label: 'Horaires (semaine)', valeur: p.horairesSemaine })}
            ${champ({ id: 'pa-horairesDimanche', label: 'Horaires (dimanche)', valeur: p.horairesDimanche })}
          </div>
          ${champ({ id: 'pa-creneaux', label: 'Créneaux de retrait proposés (un par ligne)', type: 'textarea', valeur: p.creneaux, attrs: 'rows="4"' })}
          <div class="border-t border-brand-100 pt-3">
            ${interrupteur({ id: 'pa-ouvertes', label: 'Commandes ouvertes sur le site', coche: p.commandesOuvertes !== false, aide: 'Désactivez pendant les vacances ou quand le carnet est plein.' })}
            <div id="bloc-fermeture" class="${p.commandesOuvertes !== false ? 'hidden' : ''} mt-2">${champ({ id: 'pa-messageFermeture', label: 'Message affiché aux clients', valeur: p.messageFermeture })}</div>
          </div>
          <button type="submit" class="${BTN.principal} w-full">Enregistrer les infos</button>
        </form>

        <div class="space-y-5">
          <section class="bg-white rounded-2xl border border-brand-200 p-5 space-y-3">
            <h2 class="font-semibold text-lg">Catalogue</h2>
            <p class="text-sm text-brand-600">${nbProduits} gâteau${nbProduits > 1 ? 'x' : ''} dans le catalogue. L'import ajoute ou remet à jour les gâteaux d'origine du site (tartes, entremets, gâteaux, grands classiques), sans toucher aux autres.</p>
            <button type="button" data-pa="importer" class="${BTN.secondaire} w-full"><i class="fa-solid fa-file-import"></i> Importer le catalogue d'origine du site</button>
          </section>

          <section class="bg-white rounded-2xl border border-brand-200 p-5 space-y-3">
            <h2 class="font-semibold text-lg">Sauvegarde</h2>
            <p class="text-sm text-brand-600">Téléchargez de temps en temps une copie de toutes les données (commandes, produits, recettes, stock).</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <button type="button" data-pa="exporter" class="${BTN.sombre} flex-1"><i class="fa-solid fa-download"></i> Télécharger une sauvegarde</button>
              <label class="${BTN.secondaire} flex-1 cursor-pointer"><i class="fa-solid fa-upload"></i> Restaurer<input type="file" id="pa-restaurer" accept=".json,application/json" class="sr-only"></label>
            </div>
          </section>

          <section class="bg-white rounded-2xl border border-brand-200 p-5 space-y-3">
            <h2 class="font-semibold text-lg">Compte</h2>
            ${mode === 'demo' ? `<p class="text-sm text-amber-900 bg-amber-50 rounded-xl p-3">Mode démo : Firebase n'est pas encore configuré (voir GUIDE-FIREBASE.md dans le dépôt). Les données d'exemple restent sur cet appareil.</p>
              <button type="button" data-pa="reinit" class="${BTN.secondaire} w-full"><i class="fa-solid fa-rotate"></i> Remettre les données d'exemple à zéro</button>`
              : `<p class="text-sm text-brand-600">Connecté avec <strong class="text-brand-900 break-all">${esc(utilisateurCourant())}</strong>. Les données sont synchronisées entre le téléphone et l'ordinateur.</p>`}
            <button type="button" data-pa="deconnexion" class="${BTN.danger} w-full"><i class="fa-solid fa-right-from-bracket"></i> Se déconnecter</button>
          </section>
        </div>
      </div>`;

    $('#pa-ouvertes', el).onchange = e => $('#bloc-fermeture', el).classList.toggle('hidden', e.target.checked);
    const formInfos = $('#form-infos', el);
    const suivreSaisie = () => brouillon.demarrer({ type: 'parametres', racine: formInfos });
    if (enCours) { brouillon.appliquerChamps(formInfos, enCours); suivreSaisie(); }
    else { const premier = () => { formInfos.removeEventListener('input', premier); formInfos.removeEventListener('change', premier); suivreSaisie(); }; formInfos.addEventListener('input', premier); formInfos.addEventListener('change', premier); }
    $('#form-infos', el).onsubmit = async e => {
      e.preventDefault();
      const v = id => $('#pa-' + id, el).value.trim();
      try { await enregistrer('parametres', 'infos', {
        telephone: v('telephone'), email: v('email'), adresse: v('adresse'), horairesSemaine: v('horairesSemaine'), horairesDimanche: v('horairesDimanche'),
        creneaux: v('creneaux'), commandesOuvertes: $('#pa-ouvertes', el).checked, messageFermeture: v('messageFermeture')
      });
      brouillon.terminer(); toast('Infos enregistrées, le site est à jour'); } catch (err) { toast(messageErreur(err), 'erreur'); }
    };
    $('#pa-restaurer', el).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!await confirmer('Restaurer cette sauvegarde ? Les éléments du fichier remplaceront ceux qui ont le même identifiant.', { bouton: 'Restaurer' })) { e.target.value = ''; return; }
      try { const n = await importerSauvegarde(await f.text()); toast(`${n} éléments restaurés`); }
      catch (err) { toast('Fichier illisible : ' + err.message, 'erreur'); }
      e.target.value = '';
    };
    el.onclick = async e => {
      const a = e.target.closest('[data-pa]'); if (!a) return;
      if (a.dataset.pa === 'exporter') { telecharger(exporterTout(), `sauvegarde-juste-une-part-${isoJour()}.json`); toast('Sauvegarde téléchargée'); }
      if (a.dataset.pa === 'importer' && await confirmer('Importer les gâteaux d\'origine du site ? Ceux qui existent déjà avec le même identifiant seront remis à leur version initiale.', { bouton: 'Importer' })) {
        const texte = a.innerHTML; a.disabled = true; a.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Import en cours…';
        try { const r = await importerCatalogueSite(); toast(r === 'attente' ? 'Catalogue enregistré sur l\'appareil, synchronisation en cours…' : 'Catalogue d\'origine importé'); }
        catch (err) { toast(messageErreur(err), 'erreur'); }
        finally { a.disabled = false; a.innerHTML = texte; }
      }
      if (a.dataset.pa === 'reinit' && await confirmer('Effacer les modifications de la démo et revenir aux données d\'exemple ?', { bouton: 'Remettre à zéro', danger: true })) { reinitialiserDemo(); toast('Données d\'exemple restaurées'); }
      if (a.dataset.pa === 'deconnexion') await deconnexion();
    };
  }
};
