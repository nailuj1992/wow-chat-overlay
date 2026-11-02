/*
 * Overlay settings.
 *
 * Two ways to configure:
 *   1. Edit USER_CONFIG below (works with OBS "Local file" checkbox).
 *   2. Add URL parameters, e.g. index.html?twitch=mychannel&fade=60
 *      URL parameters win over USER_CONFIG. Use config.html to build the URL.
 */
window.WC = window.WC || {};

// ---- Edit here if you prefer not to use URL parameters ----
const USER_CONFIG = {
  // twitch: 'your_channel',
  // hide: 'nightbot,streamelements',
};

WC.DEFAULTS = {
  // Sources
  twitch: '',               // Twitch channel(s), comma separated
  youtube_key: '',          // YouTube Data API v3 key
  youtube_video: '',        // YouTube live video ID (cheapest on quota)
  youtube_channel: '',      // YouTube channel ID (UC...) - auto-finds current live, costs more quota
  youtube_interval: 8,      // Min seconds between YouTube polls

  // Filters
  hide: 'nightbot,streamelements,streamlabs,soundalerts,moobot,fossabot,wizebot,sery_bot,kofistreambot,botrixoficial,commanderroot,pokemoncommunitygame,blerp,frostytoolsdotcom,tangiabot,own3d,creatisbot',
  hide_commands: true,      // Hide messages starting with "!"
  show_commands: 's',       // Commands still shown, without the prefix ("!s hola" -> "hola"), e.g. TTS. Comma separated
  events: true,             // Show subs / raids / gifts as yellow system lines

  // Emotes
  emotes: '7tv,bttv,ffz',   // Third-party emote providers (Twitch/YouTube native always on)

  // Look
  lang: 'en',               // en | es  (channel labels: [Officer] vs [Oficial])
  names: 'platform',         // class = WoW class color per user | platform = user's Twitch/YouTube color | channel = same as line
  font_size: 14,
  font: '',                 // Override font family, e.g. "Friz Quadrata TT"
  bg: 0.7,                  // Background opacity 0..1
  opacity: 1,               // Whole chat opacity (text + background) 0..1
  width: 400,               // Chat width in px; 0 = fill the OBS source
  height: 250,              // Chat height in px; 0 = fill the OBS source
  tab: 'General',           // Tab label; empty = no tab
  max: 50,                  // Max messages on screen
  fade: 90,                 // Seconds until a message fades; 0 = never
  platform_icon: 'auto',    // auto (only when 2+ platforms) | 1 | 0

  // Which WoW chat channel each viewer role maps to.
  // Options: say, yell, whisper, guild, officer, party, partyLeader, raid, raidLeader, raidWarning, emote
  role_broadcaster: 'raidLeader',
  role_moderator: 'officer',
  role_vip: 'partyLeader',
  role_subscriber: 'guild',
  role_default: 'say',
  role_bot: 'yell',         // Users whose name ends in "bot" (e.g. DuelosRPGbot). Wins over other roles. Empty = off

  demo: false,              // Fake messages for previewing
};

WC.config = (function () {
  const cfg = Object.assign({}, WC.DEFAULTS, USER_CONFIG);
  const params = new URLSearchParams(location.search);
  if (params.has('channel') && !params.has('twitch')) params.set('twitch', params.get('channel'));

  for (const [key, raw] of params) {
    if (!(key in WC.DEFAULTS)) continue;
    const def = WC.DEFAULTS[key];
    if (typeof def === 'boolean') cfg[key] = !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
    else if (typeof def === 'number') cfg[key] = Number(raw);
    else cfg[key] = raw;
  }

  const list = (s) => String(s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  cfg.twitchChannels = list(cfg.twitch).map(c => c.replace(/^#/, ''));
  cfg.hiddenUsers = new Set(list(cfg.hide).map(u => u.replace(/^@/, '')));
  cfg.emoteProviders = list(cfg.emotes);
  cfg.shownCommands = new Set(list(cfg.show_commands).map(c => c.replace(/^!/, '')));
  return cfg;
})();
