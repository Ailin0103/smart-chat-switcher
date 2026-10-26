(async () => {
  const {settings = SCR.defaults} = await chrome.storage.local.get('settings');
  document.querySelector('#enabled').checked = settings.enabled;
  document.querySelector('#count').textContent = settings.projects.filter(p => p.active && SCR.safeURL(p.url)).length + ' active destinations configured';
  document.querySelector('#enabled').onchange = async e => {
    try {
      const latest = (await chrome.storage.local.get('settings')).settings || SCR.defaults;
      await chrome.storage.local.set({settings: {...latest, enabled: e.target.checked}});
      document.querySelector('#status').textContent = e.target.checked ? 'Routing enabled.' : 'Routing paused.';
    } catch (error) {document.querySelector('#status').textContent = error.message;}
  };
  document.querySelector('#settings').onclick = () => chrome.runtime.openOptionsPage();
})();
