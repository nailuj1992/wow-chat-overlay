# WoW Chat Overlay

World of Warcraft–style chat for OBS. Twitch + YouTube, with Twitch, 7TV, BetterTTV and FrankerFaceZ emotes. No server, no login, no build step.

**Live:** https://nailuj1992.github.io/wow-chat-overlay/ · **Setup page:** https://nailuj1992.github.io/wow-chat-overlay/config.html

## Quick start (hosted)

1. Open the [setup page](https://nailuj1992.github.io/wow-chat-overlay/config.html), type your Twitch channel, tweak the look. The preview shows demo messages.
2. Click **Copy URL**.
3. OBS → Sources → **+** → **Browser** → uncheck **Local file** → paste the URL. Set the source size to at least the chat size (default 400×250).

The URL looks like:

```
https://nailuj1992.github.io/wow-chat-overlay/index.html?twitch=mychannel
```

## Running locally

Clone the repo and either:

- OBS Browser Source with the `file:///…/index.html?twitch=mychannel` URL (uncheck **Local file**), or
- check **Local file**, pick `index.html`, and put your settings in `USER_CONFIG` at the top of `js/config.js` (don't commit them).

## Deployment

GitHub Pages serves the `dev` branch root. Every merge into `dev` goes live in 1–2 minutes; refresh the OBS source to pick it up (Properties → **Refresh cache of current page**).

## Contributing

- `dev` is the only branch: default, protected, deployed.
- **No direct pushes to `dev`.** Create a branch (`feat/…`, `fix/…`, `docs/…`), push it and open a PR into `dev`.
- **Never commit secrets.** No `.env` files, no API keys in `js/config.js`. The YouTube API key goes only in your private OBS URL.
- See [AGENTS.md](AGENTS.md) for architecture and code rules.

## How viewers map to WoW channels

| Viewer             | Shows as                         | Color      |
|--------------------|----------------------------------|------------|
| Broadcaster        | `[Raid Leader] [Name]: msg`      | orange-red |
| Moderator          | `[Officer] [Name]: msg`          | green      |
| VIP                | `[Party Leader] [Name]: msg`     | light blue |
| Subscriber/member  | `[Guild] [Name]: msg`            | green      |
| Everyone else      | `[Name] says: msg`               | white      |
| `/me`              | `Name dances`                    | orange     |
| Cheer (bits)       | `[Name] yells: msg`              | red        |
| Announcement / highlighted / Super Chat | `[Raid Warning] [Name]: msg` | red, bold |
| Subs, raids, gifts | system line                      | yellow     |

Names get a WoW class color (stable per user). Change mapping with `role_*` settings.

## Settings (URL parameters)

| Param | Default | What |
|---|---|---|
| `twitch` | – | Channel(s), comma separated |
| `hide` | common bots | Users to hide, comma separated (Nightbot, StreamElements, SoundAlerts, Streamlabs, Moobot, Fossabot…) |
| `hide_commands` | `1` | Hide messages starting with `!` |
| `events` | `1` | Show subs/raids/gifts |
| `emotes` | `7tv,bttv,ffz` | Third-party emote providers |
| `lang` | `en` | `en` or `es` labels (`[Oficial]`, `dice:`…) |
| `names` | `platform` | Name colors: `class` (WoW class colors), `platform` (Twitch/YouTube colors), `channel` (same as line) |
| `font_size` | `14` | px |
| `font` | – | Font override (e.g. `Friz Quadrata TT` if installed) |
| `bg` | `0.7` | Background opacity 0–1 |
| `opacity` | `1` | Whole chat opacity (text + background) 0–1 |
| `width` | `400` | Chat width in px; `0` = fill the OBS source |
| `height` | `250` | Chat height in px; `0` = fill the OBS source (chat sits at the bottom-left) |
| `tab` | `General` | Tab label, empty to hide |
| `max` | `50` | Max lines |
| `fade` | `90` | Seconds until a line fades, `0` = never |
| `platform_icon` | `auto` | TW/YT badge: `auto`, `1`, `0` |
| `role_broadcaster` / `role_moderator` / `role_vip` / `role_subscriber` / `role_default` | see above | `say, yell, whisper, emote, guild, officer, party, partyLeader, raid, raidLeader, raidWarning` |
| `demo` | `0` | Fake messages for testing |

Deleted messages, timeouts, bans and `/clear` remove lines from the overlay too.

## YouTube

Needs a free **YouTube Data API v3** key (Google Cloud Console → APIs & Services → enable "YouTube Data API v3" → Credentials → API key).

- `youtube_key=AIza...`
- `youtube_video=VIDEO_ID` (cheapest), or `youtube_channel=UC...` (finds your live automatically, costs more quota)
- `youtube_interval=8` seconds between polls

**Quota:** free tier is 10,000 units/day; each poll costs ~5 units, so 8s ≈ 4–5 h of stream per day. Raise the interval for longer streams. Finding the live by channel costs 100 units per try.

Keep the URL private: it contains your API key. Restrict the key to the YouTube Data API in Google Cloud.

YouTube custom channel emojis show as `:name:` text (the API doesn't expose images). 7TV emotes linked to your YouTube channel do work.

## Adding another platform (Kick, etc.)

Create `js/providers/<platform>.js` that calls `handlers.onMessage(msg)` with the shape documented at the top of `js/render.js`, then start it in `js/main.js`. Rendering, filters, emotes and fading are shared.

## Files

```
index.html          overlay (OBS loads this)
config.html         URL builder with live preview
css/wow.css         look
js/config.js        defaults + URL parsing
js/emotes.js        7TV / BTTV / FFZ
js/render.js        WoW line formatting, colors, labels
js/providers/       twitch.js, youtube.js
js/demo.js          fake messages
js/main.js          wiring, filters, fading
```
