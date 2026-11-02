/* Wires config, providers, filters and the chat log together. */
(function () {
  const cfg = WC.config;
  const log = document.getElementById('log');
  const root = document.documentElement;

  // ---- Look ----
  root.style.setProperty('--font-size', cfg.font_size + 'px');
  root.style.setProperty('--bg-alpha', String(cfg.bg));
  const frame = document.getElementById('frame');
  frame.style.opacity = String(Math.min(1, Math.max(0, cfg.opacity)));
  if (cfg.width > 0) frame.style.width = cfg.width + 'px';
  if (cfg.height > 0) frame.style.height = cfg.height + 'px';
  if (cfg.font) root.style.setProperty('--font', `"${cfg.font}", "Arial Narrow", "Roboto Condensed", Arial, sans-serif`);
  if (cfg.tab) document.getElementById('tab-label').textContent = cfg.tab;
  else document.getElementById('tab').classList.add('hidden');

  const hasYouTube = !!(cfg.youtube_key && (cfg.youtube_video || cfg.youtube_channel));
  const platformCount = (cfg.twitchChannels.length ? 1 : 0) + (hasYouTube ? 1 : 0);
  WC.showPlatform = cfg.platform_icon === 'auto' ? platformCount > 1 : ['1', 'true', 'yes'].includes(String(cfg.platform_icon));

  // ---- Filters ----
  function isHidden(m) {
    if (m.kind === 'status') return false;
    if (m.isEvent && !cfg.events) return true;
    const u = m.user || {};
    const names = [u.login, u.name].filter(Boolean).map(s => s.toLowerCase());
    if (names.some(n => cfg.hiddenUsers.has(n))) return true;
    if (cfg.hide_commands && /^\s*!/.test(m.text || '')) return true;
    return false;
  }

  // ---- Log ----
  function add(m) {
    if (isHidden(m)) return;
    const el = WC.render(m);
    log.append(el);
    while (log.children.length > cfg.max) log.firstElementChild.remove();
    if (cfg.fade > 0) {
      setTimeout(() => {
        el.classList.add('fade');
        setTimeout(() => el.remove(), 2100);
      }, cfg.fade * 1000);
    }
  }

  function clear({ platform, userId, msgId }) {
    let sel;
    if (msgId) sel = `[data-msgid="${CSS.escape(platform + ':' + msgId)}"]`;
    else if (userId) sel = `[data-user="${CSS.escape(platform + ':' + userId)}"]`;
    else sel = `.msg[data-msgid^="${CSS.escape(platform + ':')}"]`;
    log.querySelectorAll(sel).forEach(el => el.remove());
  }

  function status(text) {
    console.log('[status]', text);
    // Status lines are only shown briefly so they don't clutter the stream
    const el = WC.render({ kind: 'status', fragments: [{ type: 'text', text }] });
    log.append(el);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 2100); }, 5000);
  }

  WC.addMessage = add;
  const handlers = { onMessage: add, onClear: clear, onStatus: status, onRoom: (id) => WC.Emotes.loadTwitch(id) };

  // ---- Start ----
  WC.Emotes.loadGlobal().then(() => {
    if (cfg.demo) WC.Demo(add);
  });

  if (cfg.twitchChannels.length) new WC.TwitchChat(cfg.twitchChannels, handlers);

  if (hasYouTube) {
    new WC.YouTubeChat({
      key: cfg.youtube_key,
      videoId: cfg.youtube_video,
      channelId: cfg.youtube_channel,
      interval: Math.max(2, cfg.youtube_interval),
    }, handlers);
  }

  if (!platformCount && !cfg.demo) {
    status('No chat source configured. Add ?twitch=yourchannel to the URL (or open config.html).');
  }
})();
