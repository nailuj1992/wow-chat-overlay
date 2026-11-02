/*
 * Turns a normalized chat message into a WoW-style chat line.
 *
 * Every provider (Twitch, YouTube, ...) emits messages in this shape:
 * {
 *   id:        'unique id' (used for deletions),
 *   platform:  'twitch' | 'youtube' | ...,
 *   kind:      'chat' | 'action' | 'cheer' | 'highlight' | 'announcement' | 'superchat' | 'system',
 *   user:      { id, login, name, color, roles: { broadcaster, moderator, vip, subscriber } },
 *   fragments: [ { type: 'text', text } | { type: 'emote', name, url } ],
 *   emoteScopes: ['tw:12345']   // which channel's 7TV/BTTV/FFZ emotes apply
 * }
 */
(function () {
  // Official WoW chat colors
  const CHANNELS = {
    say:         { color: '#FFFFFF', style: 'verb' },
    yell:        { color: '#FF4040', style: 'verb' },
    whisper:     { color: '#FF80FF', style: 'verb' },
    emote:       { color: '#FF8040', style: 'emote' },
    guild:       { color: '#40FF40', style: 'label' },
    officer:     { color: '#40C040', style: 'label' },
    party:       { color: '#AAAAFF', style: 'label' },
    partyLeader: { color: '#77C8FF', style: 'label' },
    raid:        { color: '#FF7F00', style: 'label' },
    raidLeader:  { color: '#FF4809', style: 'label' },
    raidWarning: { color: '#FF4800', style: 'label' },
    system:      { color: '#FFFF00', style: 'plain' },
    status:      { color: '#888888', style: 'plain' },
  };

  const LANG = {
    en: {
      say: 'says', yell: 'yells', whisper: 'whispers',
      guild: 'Guild', officer: 'Officer', party: 'Party', partyLeader: 'Party Leader',
      raid: 'Raid', raidLeader: 'Raid Leader', raidWarning: 'Raid Warning',
    },
    es: {
      say: 'dice', yell: 'grita', whisper: 'susurra',
      guild: 'Hermandad', officer: 'Oficial', party: 'Grupo', partyLeader: 'Líder de grupo',
      raid: 'Banda', raidLeader: 'Líder de banda', raidWarning: 'Aviso de banda',
    },
  };

  // WoW class colors, used to give each viewer a stable "class"
  const CLASS_COLORS = [
    '#C69B6D', // Warrior
    '#F48CBA', // Paladin
    '#AAD372', // Hunter
    '#FFF468', // Rogue
    '#FFFFFF', // Priest
    '#C41E3A', // Death Knight
    '#0070DD', // Shaman
    '#3FC7EB', // Mage
    '#8788EE', // Warlock
    '#00FF98', // Monk
    '#FF7C0A', // Druid
    '#A330C9', // Demon Hunter
    '#33937F', // Evoker
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function classColor(key) { return CLASS_COLORS[hash(String(key).toLowerCase()) % CLASS_COLORS.length]; }

  function pickChannel(m) {
    const cfg = WC.config;
    if (m.kind === 'system') return 'system';
    if (m.kind === 'status') return 'status';
    if (m.kind === 'action') return 'emote';
    if (m.kind === 'announcement' || m.kind === 'highlight' || m.kind === 'superchat') return 'raidWarning';
    if (m.kind === 'cheer') return 'yell';
    const r = (m.user && m.user.roles) || {};
    let ch = cfg.role_default;
    if (r.broadcaster) ch = cfg.role_broadcaster;
    else if (r.moderator) ch = cfg.role_moderator;
    else if (r.vip) ch = cfg.role_vip;
    else if (r.subscriber) ch = cfg.role_subscriber;
    return CHANNELS[ch] ? ch : 'say';
  }

  // Twitch's default palette for users who never picked a color
  const TWITCH_DEFAULTS = [
    '#FF0000', '#0000FF', '#00FF00', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57',
    '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F',
  ];

  // YouTube has no per-user colors; use the same role colors YouTube's own chat uses
  const YOUTUBE_ROLES = { broadcaster: '#FFD600', moderator: '#5E84F1', subscriber: '#2BA640', default: '#CCCCCC' };

  /** Lighten colors that would be unreadable on a dark background (e.g. pure #0000FF). */
  function readable(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    let [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum >= 90) return '#' + m[1];
    const k = Math.min(0.6, (90 - lum) / 120); // mix toward white
    [r, g, b] = [r, g, b].map(c => Math.round(c + (255 - c) * k));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  function platformColor(m) {
    const u = m.user;
    if (u.color) return readable(u.color);
    if (m.platform === 'youtube') {
      const r = u.roles || {};
      return YOUTUBE_ROLES[r.broadcaster ? 'broadcaster' : r.moderator ? 'moderator' : r.subscriber ? 'subscriber' : 'default'];
    }
    const login = (u.login || u.name || '').toLowerCase();
    if (!login) return '#FFFFFF';
    return readable(TWITCH_DEFAULTS[(login.charCodeAt(0) + login.charCodeAt(login.length - 1)) % TWITCH_DEFAULTS.length]);
  }

  function nameColor(m, lineColor) {
    const mode = WC.config.names;
    if (mode === 'channel') return lineColor;
    if (mode === 'platform') return platformColor(m);
    return classColor(m.user.login || m.user.name);
  }

  function emoteImg(e, extraClass) {
    const img = document.createElement('img');
    img.className = 'emote' + (extraClass ? ' ' + extraClass : '');
    img.src = e.url;
    img.alt = e.name;
    img.title = e.name;
    return img;
  }

  /** Appends fragments to `parent`, expanding 7TV/BTTV/FFZ emotes inside text. */
  function appendFragments(parent, fragments, scopes) {
    let lastEmote = null; // element a zero-width emote can stack onto

    const pushEmote = (e) => {
      if (e.zw && lastEmote) {
        let stack = lastEmote;
        if (!stack.classList.contains('emote-stack')) {
          stack = document.createElement('span');
          stack.className = 'emote-stack';
          lastEmote.replaceWith(stack);
          stack.append(lastEmote);
        }
        stack.append(emoteImg(e, 'zw'));
        lastEmote = stack;
      } else {
        const img = emoteImg(e);
        parent.append(img);
        lastEmote = img;
      }
    };

    for (const f of fragments) {
      if (f.type === 'emote') { pushEmote(f); continue; }
      // Split on whitespace, keep the whitespace pieces
      for (const part of f.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { parent.append(document.createTextNode(part)); continue; }
        const e = WC.Emotes.lookup(part, scopes);
        if (e) pushEmote(e);
        else { parent.append(document.createTextNode(part)); lastEmote = null; }
      }
    }
  }

  function platformBadge(platform) {
    const b = document.createElement('span');
    b.className = 'platform ' + platform;
    b.textContent = { twitch: 'TW', youtube: 'YT', demo: 'DEMO' }[platform] || platform.slice(0, 2).toUpperCase();
    return b;
  }

  WC.render = function (m) {
    const t = LANG[WC.config.lang] || LANG.en;
    const ch = pickChannel(m);
    const def = CHANNELS[ch];

    const el = document.createElement('div');
    el.className = 'msg ch-' + ch;
    el.style.setProperty('--c', def.color);
    if (m.id) el.dataset.msgid = m.platform + ':' + m.id;
    if (m.user && m.user.id) el.dataset.user = m.platform + ':' + m.user.id;

    if (WC.showPlatform && m.platform && ch !== 'status') el.append(platformBadge(m.platform));

    if (def.style !== 'plain' && m.user) {
      const name = document.createElement('span');
      name.className = 'name';
      name.style.setProperty('--name', nameColor(m, def.color));

      if (def.style === 'label') {
        el.append(`[${t[ch]}] `);
        name.textContent = `[${m.user.name}]`;
        el.append(name, ': ');
      } else if (def.style === 'verb') {
        name.textContent = `[${m.user.name}]`;
        el.append(name, ` ${t[ch]}: `);
      } else { // emote: "Name dances with joy"
        name.textContent = m.user.name;
        el.append(name, ' ');
      }
    }

    appendFragments(el, m.fragments || [], m.emoteScopes);
    return el;
  };

  WC.CHANNELS = CHANNELS;
})();
