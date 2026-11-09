// B3 읽힘 집계. 항목이 화면 가운데를 지났는지, 시연을 만졌는지, 얼마나 봤는지만 b3-stats 워커로 보낸다.
// 쿠키와 저장소를 쓰지 않는다. load는 페이지를 열 때마다 새로 뽑아서 다른 방문과 이어지지 않는다.
(() => {
  if (navigator.webdriver || !window.IntersectionObserver) return;
  const me = document.currentScript, page = me && me.dataset.p;
  if (!page) return;
  const END = 'https://b3-stats.oceanworks.workers.dev/e';
  const load = (Math.random().toString(36).slice(2) + '0000000000').slice(0, 10);
  const dev = matchMedia('(pointer: coarse)').matches ? 'm' : 'd';
  const ref = (() => {
    try {
      if (!document.referrer) return 'none';
      const u = new URL(document.referrer);
      if (u.host === location.host) return 'in';
      if (/dcinside/.test(u.host)) return 'dc';
      if (/slack/.test(u.host)) return 'slack';
      return 'other';
    } catch (e) { return 'other'; }
  })();

  const q = [['open', '', '', 1]];
  const now = () => performance.now();
  const on = new Map(), acc = new Map(), band = new Set();
  let vis0 = document.hidden ? null : now(), visAcc = 0;

  const stop = id => { const s = on.get(id); if (s != null) { acc.set(id, (acc.get(id) || 0) + now() - s); on.delete(id); } };
  const flushTime = () => {
    const t = now();
    for (const [id, s] of on) { acc.set(id, (acc.get(id) || 0) + t - s); on.set(id, t); }
    for (const [id, ms] of acc) if (ms >= 500) { q.push(['dwell', id, '', Math.round(ms / 100) / 10]); acc.delete(id); }
    if (vis0 != null) { visAcc += t - vis0; vis0 = t; }
    if (visAcc >= 500) { q.push(['time', '', '', Math.round(visAcc / 100) / 10]); visAcc = 0; }
  };
  const send = () => {
    flushTime();
    while (q.length) {
      const body = JSON.stringify({ p: page, l: load, d: dev, r: ref, e: q.splice(0, 60) });
      try {
        if (!(navigator.sendBeacon && navigator.sendBeacon(END, new Blob([body], { type: 'text/plain' }))))
          fetch(END, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      } catch (e) {}
    }
  };

  // 항목: 화면 가운데 10% 띠를 지나면 읽힘(reach), 띠 안에 있던 시간이 머문 초(dwell)
  const arts = [...document.querySelectorAll('article.term[id]')];
  const seen = new Set();
  const io = new IntersectionObserver(es => {
    for (const e of es) {
      const id = e.target.id;
      if (e.isIntersecting) {
        band.add(id);
        if (!seen.has(id)) { seen.add(id); q.push(['reach', id, '', arts.indexOf(e.target) + 1]); }
        if (!document.hidden && !on.has(id)) on.set(id, now());
      } else { band.delete(id); stop(id); }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  arts.forEach(a => io.observe(a));

  // 시연 조작: 한 번 열 때 항목과 조작 종류마다 한 번만 센다
  const used = new Set();
  const ctl = (el, kind) => {
    const a = el.closest('article.term[id]');
    if (!a) return;
    const k = a.id + '|' + kind;
    if (used.has(k)) return;
    used.add(k);
    q.push(['ctl', a.id, kind, 1]);
    if (q.length >= 20) send();
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    ctl(b, b.dataset.tog ? 'tog:' + b.dataset.tog : (['play', 'step', 'slow', 'copy-say'].find(c => b.classList.contains(c)) || 'btn'));
  }, true);
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.type === 'range') ctl(t, t.dataset.sl ? 'sl:' + t.dataset.sl : 'seek');
  }, true);

  // 모음집(hub): 어느 글로 넘어갔는지. 항목은 링크 주소에서 뽑는다(light, pixel-glossary:anim ...)
  if (page === 'hub') document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const u = new URL(a.href, location.href);
    const segs = u.pathname.replace(/\.html$/, '').split('/').filter(Boolean);
    if (u.host === location.host && segs[0] === 'b3') segs.shift();
    const item = (segs.join(':') || u.host).toLowerCase().replace(/[^a-z0-9_:-]/g, '').slice(0, 24);
    q.push(['ctl', item, a.classList.contains('main') ? 'go' : 'go:sub', 1]);
    send();
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { send(); band.forEach(stop); vis0 = null; }
    else { vis0 = now(); band.forEach(id => { if (!on.has(id)) on.set(id, now()); }); }
  });
  addEventListener('pagehide', send);
  setInterval(() => { if (!document.hidden) send(); }, 30000);
})();
