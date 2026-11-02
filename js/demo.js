/* Demo mode (?demo=1): fake messages to preview the look without a live chat. */
WC.Demo = function (emit) {
  const users = [
    { name: 'Avuuna_Naliu', roles: { moderator: true } },
    { name: 'DuelosRPGbot', roles: { moderator: true } },
    { name: 'Jaindreytvv', roles: { broadcaster: true } },
    { name: 'Thrallmaster', roles: { subscriber: true } },
    { name: 'LeeroyJ', roles: {} },
    { name: 'SylvanasFan99', roles: { vip: true } },
    { name: 'GnomeEngineer', roles: { subscriber: true } },
    { name: 'Nightbot', roles: { moderator: true } }, // hidden by default filter
  ];
  const lines = [
    '¡Combate contra Jaindreytvv Enrage! (4 héroes). Pociones del panel activas',
    'gg, ese pull estuvo cerca',
    'alguien tiene el link del addon?',
    'LEEROOOOY JENKINS',
    '!discord',
    'buenas tardes chat',
    'that boss mechanic is wild',
    'ESO ES TODO',
  ];
  const kappa = { type: 'emote', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let n = 0;

  function next() {
    n++;
    const u = pick(users);
    const user = { id: u.name, login: u.name.toLowerCase(), name: u.name, color: '', roles: u.roles };
    let text = pick(lines);
    const g = WC.Emotes.names();
    if (g.length && Math.random() < 0.5) text += ' ' + pick(g);

    let kind = 'chat';
    const r = Math.random();
    if (r < 0.07) kind = 'action';
    else if (r < 0.12) kind = 'announcement';
    else if (r < 0.16) kind = 'cheer';

    if (r > 0.94) {
      const sys = `${u.name} subscribed at Tier 1. They've subscribed for ${1 + (n % 24)} months!`;
      emit({ id: 'd' + n, platform: 'demo', kind: 'system', isEvent: true, user, text: sys, fragments: [{ type: 'text', text: sys }] });
      return;
    }
    const frags = [{ type: 'text', text }];
    if (Math.random() < 0.2) frags.push({ type: 'text', text: ' ' }, kappa);
    emit({ id: 'd' + n, platform: 'demo', kind, user, text, fragments: frags, emoteScopes: [] });
  }

  for (let i = 0; i < 6; i++) next();
  setInterval(next, 1800);
};
