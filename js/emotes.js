/*
 * Third-party emotes: 7TV, BetterTTV, FrankerFaceZ.
 * Native Twitch emotes come with each message and are handled by the Twitch provider.
 *
 * Emotes are stored per "scope": 'global', 'tw:<twitch room id>', 'yt:<youtube channel id>'.
 * Channel emotes win over global ones; within a scope 7TV > BTTV > FFZ.
 */
WC.Emotes = (function () {
  const scopes = new Map();          // scope -> Map(name -> {name, url, zw})
  const ORDER = ['7tv', 'bttv', 'ffz'];
  const REFRESH_MS = 10 * 60 * 1000; // pick up newly added channel emotes

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status + ' ' + url);
    return res.json();
  }

  function fixUrl(u) { return u && u.startsWith('//') ? 'https:' + u : u; }

  // --- 7TV ---
  function from7tv(list) {
    const out = [];
    for (const e of list || []) {
      const host = e.data && e.data.host;
      if (!host) continue;
      // Zero-width ("overlay") emotes sit on top of the previous emote
      const zw = ((e.flags || 0) & 1) === 1 || ((e.data.flags || 0) & 256) === 256;
      out.push({ name: e.name, url: fixUrl(host.url) + '/2x.webp', zw });
    }
    return out;
  }

  // --- FFZ ---
  function fromFfzSets(sets, only) {
    const out = [];
    for (const [id, set] of Object.entries(sets || {})) {
      if (only && !only.includes(Number(id))) continue;
      for (const e of set.emoticons || []) {
        const url = e.urls['2'] || e.urls['1'];
        if (url) out.push({ name: e.name, url: fixUrl(url), zw: false });
      }
    }
    return out;
  }

  const fromBttv = (list) => (list || []).map(e => ({
    name: e.code, url: `https://cdn.betterttv.net/emote/${e.id}/2x`, zw: false,
  }));

  const LOADERS = {
    global: {
      '7tv': async () => from7tv((await getJson('https://7tv.io/v3/emote-sets/global')).emotes),
      bttv: async () => fromBttv(await getJson('https://api.betterttv.net/3/cached/emotes/global')),
      ffz: async () => {
        const d = await getJson('https://api.frankerfacez.com/v1/set/global');
        return fromFfzSets(d.sets, d.default_sets);
      },
    },
    twitch: {
      '7tv': async (id) => from7tv(((await getJson(`https://7tv.io/v3/users/twitch/${id}`)).emote_set || {}).emotes),
      bttv: async (id) => {
        const d = await getJson(`https://api.betterttv.net/3/cached/users/twitch/${id}`);
        return fromBttv([...(d.channelEmotes || []), ...(d.sharedEmotes || [])]);
      },
      ffz: async (id) => fromFfzSets((await getJson(`https://api.frankerfacez.com/v1/room/id/${id}`)).sets),
    },
    youtube: {
      '7tv': async (id) => from7tv(((await getJson(`https://7tv.io/v3/users/youtube/${id}`)).emote_set || {}).emotes),
    },
  };

  async function loadScope(scope, kind, id) {
    const enabled = ORDER.filter(p => WC.config.emoteProviders.includes(p) && LOADERS[kind][p]);
    const results = await Promise.all(enabled.map(p =>
      LOADERS[kind][p](id).catch(err => { console.warn(`[emotes] ${p} ${scope}:`, err.message); return []; })
    ));
    const map = new Map();
    results.forEach(list => list.forEach(e => { if (!map.has(e.name)) map.set(e.name, e); }));
    scopes.set(scope, map);
    console.log(`[emotes] ${scope}: ${map.size} emotes`);
    return map;
  }

  const timers = new Map();
  function watch(scope, kind, id) {
    if (timers.has(scope)) return Promise.resolve(scopes.get(scope));
    timers.set(scope, setInterval(() => loadScope(scope, kind, id), REFRESH_MS));
    return loadScope(scope, kind, id);
  }

  return {
    loadGlobal: () => watch('global', 'global'),
    loadTwitch: (roomId) => watch('tw:' + roomId, 'twitch', roomId),
    loadYouTube: (channelId) => watch('yt:' + channelId, 'youtube', channelId),

    /** Find an emote by word, checking the given scopes first, then global. */
    lookup(word, scopeList) {
      for (const s of scopeList || []) {
        const m = scopes.get(s);
        if (m && m.has(word)) return m.get(word);
      }
      const g = scopes.get('global');
      return g ? g.get(word) : undefined;
    },

    /** All loaded emote names (used by demo mode). */
    names(scope = 'global') {
      const m = scopes.get(scope);
      return m ? [...m.keys()] : [];
    },
  };
})();
