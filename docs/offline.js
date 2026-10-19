(() => {
  const container = document.createElement('div');
  container.className = 'offline-tools';
  const status = document.createElement('span');
  status.className = 'offline-status';
  status.setAttribute('role', 'status');
  const install = document.createElement('button');
  install.type = 'button';
  install.textContent = 'Install on phone';
  install.setAttribute('aria-expanded', 'false');
  const help = document.createElement('p');
  help.hidden = true;
  help.id = 'install-help';
  help.textContent = 'On iPhone or iPad: open this site in Safari, tap Share, then Add to Home Screen. On Android: open the browser menu and choose Install app or Add to Home screen. Your plan stays in the browser where you created it; use a snapshot to move it if needed.';
  install.setAttribute('aria-controls', help.id);
  container.append(status, document.createTextNode(' '), install, help);
  (document.querySelector('.privacy') || document.querySelector('footer')).after(container);
  let ready = false;
  let prompt;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const render = () => {
    status.textContent = !navigator.onLine
      ? (ready ? 'Offline · Your saved program and notes are available.' : 'Offline · Reconnect once to prepare offline access.')
      : (ready ? 'Ready for offline use' : 'Preparing offline access…');
    install.hidden = !!standalone();
  };
  addEventListener('online', render);
  addEventListener('offline', render);
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; });
  addEventListener('appinstalled', () => { prompt = null; install.hidden = true; help.hidden = true; });
  install.addEventListener('click', async () => {
    if (prompt) {
      const current = prompt;
      prompt = null;
      await current.prompt();
      await current.userChoice;
    } else {
      help.hidden = !help.hidden;
      install.setAttribute('aria-expanded', String(!help.hidden));
    }
  });
  render();
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'Offline access is unavailable in this browser.';
    return;
  }
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    const offerUpdate = () => {
      if (!registration.waiting || container.querySelector('[data-update]')) return;
      const update = document.createElement('button');
      update.type = 'button';
      update.dataset.update = 'true';
      update.textContent = 'Update app';
      update.addEventListener('click', () => {
        // Reload only on explicit action, after users have finished typing notes.
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        registration.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
      });
      container.append(document.createTextNode(' '), update);
    };
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', offerUpdate);
    });
    return navigator.serviceWorker.ready;
  }).then(() => { ready = true; render(); }).catch(() => {
    status.textContent = 'Offline setup could not finish. Reopen while online to retry.';
  });
})();
