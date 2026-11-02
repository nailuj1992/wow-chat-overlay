/*
 * Twitch chat via anonymous IRC over WebSocket (read-only, no login / token needed).
 */
WC.TwitchChat = (function () {
  const URL = 'wss://irc-ws.chat.twitch.tv:443';

  function unescapeTag(v) {
    return v.replace(/\\(.)/g, (_, c) => ({ s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' }[c] || c));
  }

  function parse(line) {
    const msg = { tags: {}, prefix: null, command: null, params: [] };
    if (line[0] === '@') {
      const sp = line.indexOf(' ');
      for (const kv of line.slice(1, sp).split(';')) {
        const eq = kv.indexOf('=');
        if (eq === -1) msg.tags[kv] = '';
        else msg.tags[kv.slice(0, eq)] = unescapeTag(kv.slice(eq + 1));
      }
      line = line.slice(sp + 1);
    }
    if (line[0] === ':') {
      const sp = line.indexOf(' ');
      msg.prefix = line.slice(1, sp);
      line = line.slice(sp + 1);
    }
    let trailing = null;
    const ti = line.indexOf(' :');
    if (ti !== -1) { trailing = line.slice(ti + 2); line = line.slice(0, ti); }
    const parts = line.split(' ').filter(Boolean);
    msg.command = parts.shift();
    msg.params = parts;
    if (trailing !== null) msg.params.push(trailing);
    return msg;
  }

  /** Split text into text/emote fragments using Twitch's `emotes` tag (positions are in code points). */
  function fragments(text, emotesTag) {
    if (!emotesTag) return [{ type: 'text', text }];
    const chars = Array.from(text);
    const ranges = [];
    for (const entry of emotesTag.split('/')) {
      const [id, positions] = entry.split(':');
      if (!positions) continue;
      for (const p of positions.split(',')) {
        const [s, e] = p.split('-').map(Number);
        ranges.push({ id, s, e });
      }
    }
    ranges.sort((a, b) => a.s - b.s);

    const out = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.s < cursor) continue;
      if (r.s > cursor) out.push({ type: 'text', text: chars.slice(cursor, r.s).join('') });
      out.push({
        type: 'emote',
        name: chars.slice(r.s, r.e + 1).join(''),
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${r.id}/default/dark/2.0`,
      });
      cursor = r.e + 1;
    }
    if (cursor < chars.length) out.push({ type: 'text', text: chars.slice(cursor).join('') });
    return out;
  }

  function roles(tags) {
    const badges = (tags.badges || '').split(',').map(b => b.split('/')[0]);
    return {
      broadcaster: badges.includes('broadcaster'),
      moderator: tags.mod === '1' || badges.includes('moderator'),
      vip: 'vip' in tags || badges.includes('vip'),
      subscriber: tags.subscriber === '1' || badges.includes('subscriber') || badges.includes('founder'),
    };
  }

  function user(tags, prefix) {
    const login = tags.login || (prefix ? prefix.split('!')[0] : '');
    return {
      id: tags['user-id'] || login,
      login,
      name: tags['display-name'] || login,
      color: tags.color || '',
      roles: roles(tags),
    };
  }

  class TwitchChat {
    /**
     * @param {string[]} channels
     * @param {{onMessage, onClear, onRoom, onStatus}} handlers
     */
    constructor(channels, handlers) {
      this.channels = channels;
      this.h = handlers;
      this.backoff = 1000;
      this.connect();
    }

    connect() {
      const ws = this.ws = new WebSocket(URL);
      ws.onopen = () => {
        this.backoff = 1000;
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
        for (const c of this.channels) ws.send('JOIN #' + c);
      };
      ws.onmessage = (ev) => {
        for (const line of ev.data.split('\r\n')) if (line) this.handle(parse(line));
      };
      ws.onclose = () => {
        this.h.onStatus && this.h.onStatus(`Twitch disconnected, retrying in ${this.backoff / 1000}s`);
        setTimeout(() => this.connect(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 30000);
      };
    }

    handle(msg) {
      const { tags, command, params } = msg;
      const scopes = tags['room-id'] ? ['tw:' + tags['room-id']] : [];

      switch (command) {
        case 'PING':
          this.ws.send('PONG :' + (params[0] || 'tmi.twitch.tv'));
          break;

        case 'RECONNECT':
          this.ws.close();
          break;

        case 'ROOMSTATE':
          if (tags['room-id']) this.h.onRoom && this.h.onRoom(tags['room-id'], params[0]);
          break;

        case 'JOIN':
          if (msg.prefix && msg.prefix.startsWith('justinfan')) {
            this.h.onStatus && this.h.onStatus(`Connected to Twitch ${params[0]}`);
          }
          break;

        case 'PRIVMSG': {
          let text = params[1] || '';
          let kind = 'chat';
          const action = text.match(/^\u0001ACTION (.*)\u0001$/);
          if (action) { text = action[1]; kind = 'action'; }
          else if (tags['msg-id'] === 'highlighted-message') kind = 'highlight';
          else if (tags.bits) kind = 'cheer';

          this.h.onMessage({
            id: tags.id,
            platform: 'twitch',
            kind,
            user: user(tags, msg.prefix),
            text,
            fragments: fragments(text, tags.emotes),
            emoteScopes: scopes,
          });
          break;
        }

        case 'USERNOTICE': {
          const u = user(tags, msg.prefix);
          const text = params[1] || '';
          if (tags['msg-id'] === 'announcement') {
            this.h.onMessage({
              id: tags.id, platform: 'twitch', kind: 'announcement', user: u, text,
              fragments: fragments(text, tags.emotes), emoteScopes: scopes,
            });
            break;
          }
          // Subs, resubs, gifts, raids...
          if (tags['system-msg']) {
            this.h.onMessage({
              id: tags.id + '-sys', platform: 'twitch', kind: 'system', user: u, isEvent: true,
              text: tags['system-msg'], fragments: [{ type: 'text', text: tags['system-msg'] }], emoteScopes: scopes,
            });
          }
          if (text) {
            this.h.onMessage({
              id: tags.id, platform: 'twitch', kind: 'chat', user: u, text,
              fragments: fragments(text, tags.emotes), emoteScopes: scopes,
            });
          }
          break;
        }

        case 'CLEARCHAT': // ban/timeout (with user) or /clear (without)
          this.h.onClear({ platform: 'twitch', userId: tags['target-user-id'] || null });
          break;

        case 'CLEARMSG':
          this.h.onClear({ platform: 'twitch', msgId: tags['target-msg-id'] });
          break;

        case 'NOTICE':
          console.warn('[twitch] NOTICE', params.join(' '));
          break;
      }
    }
  }

  TwitchChat.parse = parse;
  TwitchChat.fragments = fragments;
  return TwitchChat;
})();
