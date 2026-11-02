/*
 * YouTube live chat via the YouTube Data API v3 (needs an API key).
 *
 * Quota: the free daily quota is 10,000 units. Each chat poll costs ~5 units,
 * so an 8s interval allows roughly 4-5 hours of streaming per day.
 * Finding the live video from a channel ID costs 100 units per lookup,
 * so giving the video ID directly is cheaper.
 */
WC.YouTubeChat = (function () {
  const API = 'https://www.googleapis.com/youtube/v3';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  class YouTubeChat {
    /**
     * @param {{key, videoId, channelId, interval}} opts
     * @param {{onMessage, onClear, onStatus}} handlers
     */
    constructor(opts, handlers) {
      this.o = opts;
      this.h = handlers;
      this.run();
    }

    async api(path, params) {
      const qs = new URLSearchParams(Object.assign({ key: this.o.key }, params));
      const res = await fetch(`${API}/${path}?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = (data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || res.status;
        const err = new Error(`YouTube API ${path}: ${reason}`);
        err.reason = reason;
        throw err;
      }
      return data;
    }

    async findLiveChatId() {
      let videoId = this.o.videoId;
      if (!videoId && this.o.channelId) {
        const s = await this.api('search', {
          part: 'id', channelId: this.o.channelId, eventType: 'live', type: 'video', maxResults: 1,
        });
        videoId = s.items && s.items[0] && s.items[0].id.videoId;
      }
      if (!videoId) return null;
      const v = await this.api('videos', { part: 'liveStreamingDetails,snippet', id: videoId });
      const item = v.items && v.items[0];
      if (item && item.snippet && !this.o.channelId) this.o.channelId = item.snippet.channelId;
      return item && item.liveStreamingDetails && item.liveStreamingDetails.activeLiveChatId;
    }

    async run() {
      while (true) {
        let chatId = null;
        try { chatId = await this.findLiveChatId(); }
        catch (e) { console.warn('[youtube]', e.message); }

        if (!chatId) {
          this.status('YouTube: no live stream found, retrying in 2 min');
          await sleep(120000);
          continue;
        }
        // 7TV emotes linked to the YouTube channel, if any
        if (this.o.channelId) {
          this.scopes = ['yt:' + this.o.channelId];
          WC.Emotes.loadYouTube(this.o.channelId);
        }
        this.status('Connected to YouTube chat');
        await this.poll(chatId);
      }
    }

    async poll(chatId) {
      let pageToken = undefined;
      let first = true;
      while (true) {
        let data;
        try {
          data = await this.api('liveChat/messages', {
            liveChatId: chatId, part: 'snippet,authorDetails', maxResults: 200,
            ...(pageToken ? { pageToken } : {}),
          });
        } catch (e) {
          console.warn('[youtube]', e.message);
          if (e.reason === 'liveChatEnded' || e.reason === 'liveChatNotFound' || e.reason === 'liveChatDisabled') return;
          if (e.reason === 'quotaExceeded' || e.reason === 'rateLimitExceeded') {
            this.status('YouTube quota exceeded, pausing 10 min');
            await sleep(600000);
          } else {
            await sleep(15000);
          }
          continue;
        }

        if (data.offlineAt) return;
        pageToken = data.nextPageToken;
        // Skip the backlog that comes with the first page
        if (!first) for (const item of data.items || []) this.handleItem(item);
        first = false;

        const wait = Math.max(data.pollingIntervalMillis || 0, this.o.interval * 1000);
        await sleep(wait);
      }
    }

    handleItem(item) {
      const s = item.snippet || {};
      const a = item.authorDetails || {};
      const u = {
        id: a.channelId,
        login: a.displayName,
        name: a.displayName,
        color: '',
        roles: {
          broadcaster: !!a.isChatOwner,
          moderator: !!a.isChatModerator,
          vip: false,
          subscriber: !!a.isChatSponsor,
        },
      };
      const base = { id: item.id, platform: 'youtube', user: u, emoteScopes: this.scopes || [] };
      const textMsg = (kind, text, extra) => this.h.onMessage(Object.assign({}, base, {
        kind, text, fragments: [{ type: 'text', text }],
      }, extra || {}));

      switch (s.type) {
        case 'textMessageEvent':
          textMsg('chat', s.displayMessage || (s.textMessageDetails && s.textMessageDetails.messageText) || '');
          break;
        case 'superChatEvent': {
          const d = s.superChatDetails || {};
          textMsg('superchat', `${d.amountDisplayString}${d.userComment ? ' - ' + d.userComment : ''}`);
          break;
        }
        case 'superStickerEvent': {
          const d = s.superStickerDetails || {};
          textMsg('superchat', `${d.amountDisplayString} (Super Sticker)`);
          break;
        }
        case 'newSponsorEvent':
        case 'memberMilestoneChatEvent':
        case 'membershipGiftingEvent':
        case 'giftMembershipReceivedEvent':
          textMsg('system', s.displayMessage || `${u.name} became a member!`, { isEvent: true });
          break;
        case 'messageDeletedEvent':
          this.h.onClear({ platform: 'youtube', msgId: s.messageDeletedDetails && s.messageDeletedDetails.deletedMessageId });
          break;
        case 'userBannedEvent': {
          const b = s.userBannedDetails && s.userBannedDetails.bannedUserDetails;
          if (b) this.h.onClear({ platform: 'youtube', userId: b.channelId });
          break;
        }
      }
    }

    status(text) { this.h.onStatus && this.h.onStatus(text); }
  }

  return YouTubeChat;
})();
