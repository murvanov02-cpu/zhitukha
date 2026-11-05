'use strict';
(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');

  const SAVE_KEY = 'zhitukha_save_v2';
  const OLD_SAVE_KEY = 'zhitukha_save_v1';
  const ECO = 2;          // версия экономики: 2 — реальные цены
  const ECO_SCALE = 500;  // во сколько раз выросли деньги при переходе на реальные цены
  const OFFLINE_CAP_H = 8;       // сколько реальных часов копится доход, пока игрок не в игре
  const RL_STEP = 104;           // ширина плитки рулетки + отступ
  const RL_WIN = 50;             // позиция выигрышной плитки в ленте

  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
  const ITEM = byId(ITEMS), JOB = byId(JOBS), CASE = byId(CASES), SKILL = byId(SKILLS);
  const GIG = byId(GIGS), BIZ = byId(BUSINESSES), EV = byId(EVENTS), MEET = byId(MEETS), FAVOR = byId(FAVORS);
  const QDEF = byId(DAILY_QUESTS.concat(WEEKLY_QUESTS));
  const rarIdx = r => RARITY_ORDER.indexOf(r);
  const $ = s => document.querySelector(s);
  const ic = (name, cls = '') => `<i class="ti ti-${name} ${cls}"></i>`;

  // ---------- сохранение ----------
  function newState() {
    return {
      money: START_MONEY, total: 0, eco: ECO,
      skills: { int: 0, cha: 0, fit: 0, biz: 0 },
      inv: {}, car: null, job: 'flyers',
      lastTick: Date.now(), cd: {}, opened: 0,  // cd: id кейса → когда открыт бесплатно
      pity: 0, fast: false, autoSell: false,
      study: { left: STUDY_BATCH, until: 0 },   // учёба: сколько уровней осталось в пачке и до какого времени перерыв
      gig: null,                  // идущая подработка: { id, until }
      tickets: {},                // бесплатные открытия: id кейса → сколько
      daily: null, weekly: null,  // задания: { key, list: [{ id, target, prog, claimed }], bonus }
      life: 0,                    // шаг «Жизненного пути»
      biz: {},                    // бизнесы: id → { m: станки, w: сотрудники, mk: реклама, mgr, inv: вложено }
      conn: {},                   // связи: id → { xp, last, cd: { встреча → до }, sp: когда была особая услуга }
      favor: null, nextFavor: Date.now() + 3 * 3600e3,
      event: null, nextEvent: Date.now() + 2 * 3600e3, lastEvent: '',
      deal: null, dealDay: '',    // сделка с олигархом: { amount, ret, until }
      taxFreeUntil: 0,
      promo: [],                  // хэши уже активированных промокодов
      badges: [],                 // значки игрока
    };
  }
  const newConn = xp => ({ xp, last: Date.now(), cd: {}, sp: 0 });

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return upgrade(JSON.parse(raw));
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old) return rescale(migrateV1(JSON.parse(old)));
    } catch (e) { /* битое сохранение — начинаем заново */ }
    return newState();
  }
  // Приводит сохранение любой прошлой версии к нынешней
  function upgrade(o) {
    const s = Object.assign(newState(), o);
    s.skills = Object.assign(newState().skills, s.skills);
    if (o.lastFree) s.cd.free = o.lastFree;
    // связи раньше хранились как уровень 1–3
    for (const [id, v] of Object.entries(s.conn)) {
      if (!ITEM[id]) delete s.conn[id];
      else if (typeof v === 'number') s.conn[id] = newConn(CONN_XP[Math.min(v, CONN_MAX_LV) - 1]);
    }
    if (s.job && !JOB[s.job]) s.job = 'flyers';
    if (s.event && !EV[s.event.id]) s.event = null;
    if (!s.study || typeof s.study.left !== 'number') s.study = { left: STUDY_BATCH, until: 0 };
    for (const k of ['rel', 'love', 'pref', 'course', 'lastFree', 'energy', 'taps']) delete s[k];
    for (const id of Object.keys(s.tickets)) if (!CASE[id]) delete s.tickets[id];
    return o.eco === ECO ? s : rescale(s);
  }
  // Старые машины заменены марками — их стоимость возвращается деньгами
  const V1_CAR_VALUES = { c_moped: 250, c_kopeyka: 350, c_hatch: 450, c_sedan: 1800, c_pickup: 2200,
    c_van: 6500, c_bike: 7500, c_sport: 28000, c_yacht: 33000, c_heli: 120000 };
  function migrateV1(o) {
    const s = newState();
    for (const k of ['money', 'total', 'job', 'lastTick', 'opened']) if (o[k] !== undefined) s[k] = o[k];
    s.skills = Object.assign(s.skills, o.skills);
    for (const [id, n] of Object.entries(o.inv || {})) {
      if (ITEM[id] && ITEM[id].cat === 'home') s.inv[id] = n;
      else if (V1_CAR_VALUES[id]) s.money += V1_CAR_VALUES[id] * n;
    }
    s.eco = 1;
    return s;
  }
  function rescale(s) {
    s.money *= ECO_SCALE;
    s.total *= ECO_SCALE;
    s.eco = ECO;
    return s;
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ }
  }

  let S = load();
  let tab = 'home';
  const sub = { cases: 'car', career: 'jobs', inv: 'car' };
  let spinning = false;

  // ---------- форматирование ----------
  function fmt(n) {
    n = Math.floor(n);
    const a = Math.abs(n);
    if (a < 1e4) return n.toLocaleString('ru-RU');
    for (const [v, s] of [[1e12, 'трлн'], [1e9, 'млрд'], [1e6, 'млн'], [1e3, 'тыс']]) {
      if (a >= v) {
        const x = n / v;
        return x.toFixed(x < 100 ? 1 : 0).replace(/\.0$/, '').replace('.', ',') + ' ' + s;
      }
    }
  }
  function fmtTime(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    if (h) return `${h} ч ${m} мин`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const hoursText = h => (h < 1 ? `${Math.max(1, Math.round(h * 60))} мин` : `${+h.toFixed(1)} ч`);
  const visual = it => (it.img ? `<img class="pic${it.cat === 'home' ? ' cover' : ''}" src="${it.img}" alt="" loading="lazy">` : it.icon);
  const rStyle = r => `--rc:${RARITIES[r].color};--rbg:${RARITIES[r].bg}`;
  const short = name => name.split(',')[0];

  // ---------- статус ----------
  function netWorth() {
    let v = S.money;
    for (const [id, n] of Object.entries(S.inv)) if (ITEM[id]) v += ITEM[id].value * n;
    for (const b of Object.values(S.biz)) v += b.inv;
    return v;
  }
  function rankIdx() {
    const nw = netWorth();
    let i = 0;
    while (i + 1 < RANKS.length && nw >= RANKS[i + 1].min) i++;
    return i;
  }
  function rankInfo() {
    const nw = netWorth(), i = rankIdx();
    const cur = RANKS[i], next = RANKS[i + 1];
    const pct = next ? Math.min(100, (nw - cur.min) / (next.min - cur.min) * 100) : 100;
    return { cur, next, nw, pct };
  }

  // ---------- связи и польза от профессии ----------
  function connLv(id) {
    const c = S.conn[id];
    if (!c) return 0;
    let lv = 1;
    while (lv < CONN_MAX_LV && c.xp >= CONN_XP[lv]) lv++;
    return lv;
  }
  // Сила бонуса: лучшее из связей (по уровню доверия) и текущей профессии
  function perk(name) {
    let v = 0;
    for (const id of Object.keys(S.conn)) {
      const it = ITEM[id];
      if (it && it.perk === name) v = Math.max(v, it.lv[connLv(id) - 1]);
    }
    const j = JOB[S.job];
    if (j && j.perk === name) v = Math.max(v, j.v);
    return v;
  }
  const perkText = (it, lv) => PERKS[it.perk].replace('{v}', it.lv[(lv || connLv(it.id) || 1) - 1]);
  const sellRate = () => SELL_RATE + perk('sellUp') / 100;
  const sellPrice = it => Math.round(it.value * sellRate());
  const bizSellRate = () => BIZ_SELL_RATE + perk('sellUp') / 100;
  const taxRate = () => (Date.now() < S.taxFreeUntil ? 0 : Math.max(0, BIZ_TAX - perk('taxCut') / 100));
  function bribeRisk(kind) {
    let r = BRIBE_RISK;
    if (kind === 'license') r *= 1 - perk('license') / 100;
    return Math.round(r * (1 - perk('safe') / 100));
  }
  const licenseCost = d => Math.round(d.license * (1 - perk('licenseCut') / 100));

  // ---------- экономика ----------
  const carBonus = () => (S.car && S.inv[S.car] ? ITEM[S.car].bonus : 0);
  function jobPay() {
    const j = JOB[S.job];
    if (!j || (j.needCar && !carBonus())) return 0;
    return j.pay * (1 + carBonus() / 100) * (1 + S.skills.int * 0.01);
  }
  function rent() {
    let r = 0;
    for (const [id, n] of Object.entries(S.inv)) {
      const it = ITEM[id];
      if (it && it.cat === 'home') r += it.bonus * n;
    }
    return r * (1 + S.skills.biz * 0.02 + perk('rentUp') / 100);
  }

  const frozen = id => !!(S.event && EV[S.event.id].freeze && S.event.biz === id);
  // Без управляющего: занят на работе — мало времени на бизнес, уволился — почти всё под контролем
  const ownerEff = () => Math.min(1, (S.job ? OWNER_EFF_EMPLOYED : OWNER_EFF_FREE) * (1 + perk('bizEff') / 100));
  function bizStats(id) {
    const d = BIZ[id], b = S.biz[id];
    const slots = Math.min(b.m, b.w);
    const cap = slots * d.perSlot;
    const demand = Math.round(d.demand * (1 + MKT_STEP * b.mk + perk('demandUp') / 100));
    const sold = Math.min(cap, demand);
    const eff = b.mgr ? 1 : ownerEff();
    const revenue = frozen(id) ? 0 : sold * d.margin * eff * (1 + perk('bizBoost') / 100);
    const wages = b.w * d.salary, mgr = b.mgr ? d.mgrSalary : 0;
    const pre = revenue - wages - d.rentCost - mgr;
    const tax = pre > 0 ? pre * taxRate() : 0;
    let neck = '';
    if (cap < demand) neck = b.m < b.w ? 'machines' : b.w < b.m ? 'staff' : 'both';
    else if (b.w > b.m || cap > demand * 1.15) neck = 'demand';
    return { slots, cap, demand, sold, eff, revenue, wages, mgr, rent: d.rentCost, tax, profit: pre - tax, neck };
  }
  const bizProfit = () => Object.keys(S.biz).reduce((a, id) => a + (BIZ[id] ? bizStats(id).profit : 0), 0);
  const machineCost = id => Math.round(BIZ[id].machineCost * Math.pow(MACHINE_GROWTH, S.biz[id].m - BIZ[id].start));
  const mktCost = id => Math.round(BIZ[id].mktCost * Math.pow(MKT_GROWTH, S.biz[id].mk));
  const hireCost = id => Math.round(BIZ[id].salary * HIRE_COST);
  function bizOpen(d) {
    if (rankIdx() < d.rank) return false;
    for (const [k, v] of Object.entries(d.req)) if (S.skills[k] < v) return false;
    return true;
  }

  // Доход в игровой месяц; в реальный час приходит MONTHS_PER_HOUR таких месяцев
  const incomeMonth = () => jobPay() + rent() + bizProfit();
  const casePrice = c => Math.round(c.price * (1 - (Math.min(S.skills.cha, 30) + perk('caseCheap')) / 100));
  const batchPrice = (c, n) => Math.round(casePrice(c) * n * (1 - (MULTI_DISCOUNT[n] || 0)));
  function meetsJob(j) {
    for (const [k, v] of Object.entries(j.req)) if (S.skills[k] < v) return false;
    return !j.needCar || !!carBonus();
  }
  // src: work — работа, аренда, бизнес, подработки (засчитывается в задания «Заработай»)
  function earn(v, src) {
    if (v <= 0) return;
    S.money += v;
    S.total += v;
    if (src === 'work') progress('earn', v);
  }
  function pay(v) {
    if (S.money < v) { toast('Не хватает ' + fmt(v - S.money) + ' ₽'); haptic('err'); return false; }
    S.money -= v;
    return true;
  }
  const monthsMoney = (months, min) => Math.max(min || 0, Math.round(Math.max(incomeMonth(), JOBS[0].pay) * months / 1000) * 1000);
  const gigPay = g => Math.round(g.pay * (1 + S.skills.fit * 0.05 + perk('gigUp') / 100));
  function gigOpen(g) {
    if (rankIdx() < g.rank || (g.needCar && !carBonus())) return false;
    for (const [k, v] of Object.entries(g.req || {})) if (S.skills[k] < v) return false;
    return true;
  }
  function countCat(cat) {
    let n = 0;
    for (const [id, k] of Object.entries(S.inv)) if (ITEM[id] && ITEM[id].cat === cat) n += k;
    return n;
  }

  // ---------- время ----------
  function catchUp() {
    const now = Date.now();
    const sec = Math.max(0, Math.min((now - S.lastTick) / 1000, OFFLINE_CAP_H * 3600));
    S.lastTick = now;
    const earned = incomeMonth() * MONTHS_PER_HOUR * sec / 3600;
    if (earned >= 0) earn(earned, 'work');
    else S.money = Math.max(0, S.money + earned);  // бизнес в минусе — убыток, но не ниже нуля
    // доверие тает, если долго не общаться (уровень не падает)
    for (const [id, c] of Object.entries(S.conn)) {
      if (now - c.last < DECAY_AFTER_H * 3600e3) continue;
      const floor = CONN_XP[connLv(id) - 1];
      c.xp = Math.max(floor, c.xp - DECAY_XP_PER_DAY * sec / 86400);
    }
    return { sec, earned };
  }
  function tick() {
    const away = (Date.now() - S.lastTick) / 1000;
    const r = catchUp();
    ensureQuests();
    maybeEvent();
    maybeFavor();
    if (away > 60 && r.earned >= 1) showOffline(r);
    updateLive();
  }

  // ---------- учёба ----------
  const studyRest = () => studyRestHours(Object.values(S.skills).reduce((a, b) => a + b, 0)) * (1 - perk('study') / 100);
  function studyReady() {
    if (S.study.left <= 0 && Date.now() >= S.study.until) S.study = { left: STUDY_BATCH, until: 0 };
    return S.study.left > 0;
  }

  // ---------- задания ----------
  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function weekStart(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }
  function pickQuests(pool, k) {
    const has = { conn: Object.keys(S.conn).length > 0, biz: Object.keys(S.biz).length > 0 };
    const avail = pool.filter(q => !q.need || has[q.need]).sort(() => Math.random() - 0.5);
    return avail.slice(0, k).map(q => ({ id: q.id, prog: 0, claimed: false, target: q.hours ? monthsMoney(q.hours) : q.n }));
  }
  function ensureQuests() {
    const now = new Date();
    let changed = false;
    const dk = dayKey(now), wk = dayKey(weekStart(now));
    if (!S.daily || S.daily.key !== dk || S.daily.list.some(q => !QDEF[q.id])) {
      S.daily = { key: dk, list: pickQuests(DAILY_QUESTS, QUESTS_PER_DAY), bonus: false };
      changed = true;
    }
    if (!S.weekly || S.weekly.key !== wk || S.weekly.list.some(q => !QDEF[q.id])) {
      S.weekly = { key: wk, list: pickQuests(WEEKLY_QUESTS, QUESTS_PER_WEEK), bonus: false };
      changed = true;
    }
    return changed;
  }
  function progress(ev, n = 1) {
    for (const set of [S.daily, S.weekly]) {
      if (!set) continue;
      for (const q of set.list) if (QDEF[q.id].ev === ev && q.prog < q.target) q.prog = Math.min(q.target, q.prog + n);
    }
  }
  const allClaimed = set => set.list.every(q => q.claimed);
  const giveTicket = id => { S.tickets[id] = (S.tickets[id] || 0) + 1; };
  const ticketName = id => `билет «${CASE[id].name}»`;

  // ---------- жизненный путь ----------
  function lifeDone(step) {
    switch (step.type) {
      case 'job': return !!JOB[S.job] && JOB[S.job].pay >= step.v;
      case 'car': return countCat('car') > 0;
      case 'skills': return Object.values(S.skills).reduce((a, b) => a + b, 0) >= step.v;
      case 'home': return countCat('home') >= step.v;
      case 'rank': return rankIdx() >= step.v;
      case 'carRarity': return Object.keys(S.inv).some(id => ITEM[id] && ITEM[id].cat === 'car' && rarIdx(ITEM[id].rarity) >= step.v);
      case 'biz': return Object.keys(S.biz).length >= step.v;
      case 'bizProfit': return bizProfit() >= step.v;
      case 'conn': return Object.keys(S.conn).length >= step.v;
      case 'connLv': return Object.keys(S.conn).some(id => connLv(id) >= step.v);
    }
    return false;
  }
  const rewardText = r => (r.money ? `+${fmt(r.money)} ₽` : ticketName(r.ticket));
  function profileClaimable() {
    const life = LIFE_PATH[S.life];
    if (life && lifeDone(life)) return true;
    for (const set of [S.daily, S.weekly]) {
      if (!set) continue;
      if (set.list.some(q => !q.claimed && q.prog >= q.target)) return true;
      if (!set.bonus && allClaimed(set)) return true;
    }
    return false;
  }

  // ---------- события ----------
  function eventCost(e, biz) {
    const base = e.bizHours ? Math.max(0, biz ? bizStats(biz).profit : bizProfit()) * e.bizHours : Math.max(incomeMonth(), 0) * e.hours;
    return Math.round(Math.max(e.min, base) * (e.fine ? 1 - perk('fineCut') / 100 : 1) / 1000) * 1000;
  }
  function eventOk(e) {
    const has = { car: !!carBonus(), home: countCat('home') > 0, biz: Object.keys(S.biz).length > 0 };
    if (e.need && !has[e.need]) return false;
    if (e.minRank && rankIdx() < e.minRank) return false;
    if (e.conn && !S.conn[e.conn]) return false;
    return true;
  }
  function maybeEvent() {
    if (S.event || Date.now() < S.nextEvent) return;
    const [a, b] = EVENT_EVERY_H;
    S.nextEvent = Date.now() + (a + Math.random() * (b - a)) * 3600e3;
    // Сначала решаем, приятное событие или нет, и не повторяем прошлое
    const good = Math.random() * 100 < EVENT_GOOD_CHANCE;
    let pool = EVENTS.filter(e => eventOk(e) && !!e.good === good && e.id !== S.lastEvent);
    if (!pool.length) pool = EVENTS.filter(e => eventOk(e) && e.id !== S.lastEvent);
    if (!pool.length) return;
    startEvent(pool[Math.floor(Math.random() * pool.length)]);
  }
  function startEvent(e) {
    const owned = Object.keys(S.biz);
    const biz = e.need === 'biz' ? owned[Math.floor(Math.random() * owned.length)] : null;
    S.lastEvent = e.id;
    S.event = e.good
      ? { id: e.id, biz, reward: Math.round(Math.max(30e3, (biz ? Math.max(bizStats(biz).profit, incomeMonth() / 3) : incomeMonth()) * e.reward) / 1000) * 1000 }
      : { id: e.id, biz, cost: eventCost(e, biz) };
    save();
    render();
    showEvent();
  }
  const evText = ev => EV[ev.id].text.replace('{biz}', ev.biz ? BIZ[ev.biz].name : 'бизнес');
  // Кто решает событие бесплатно: профессия или связь
  function evHelper(e) {
    const j = JOB[S.job];
    if (j && (j.solves || []).includes(e.id)) return { kind: 'job', label: `Ты же ${j.name.toLowerCase()} — решишь сам` };
    if (e.via && S.conn[e.via]) return { kind: 'conn', label: `Позвонить: ${ITEM[e.via].name}` };
    return null;
  }
  function showEvent() {
    const ev = S.event;
    if (!ev) return;
    const e = EV[ev.id];
    if (e.good) {
      showModal(`<h3>${e.icon} ${e.title}</h3><p>${evText(ev)}</p><div class="big">+${fmt(ev.reward)} ₽</div>
        <button class="btn full" data-action="event-solve" data-id="good">Забрать</button>`);
      return;
    }
    const bribe = Math.round(ev.cost / BRIBE_DIVISOR), risk = bribeRisk();
    const via = evHelper(e);
    const solvers = JOBS.filter(j => (j.solves || []).includes(e.id)).map(j => j.name.toLowerCase());
    const hint = [e.via ? `связь «${ITEM[e.via].name}»` : '', solvers.length ? `профессия ${solvers.join(' или ')}` : ''].filter(Boolean).join(' или ');
    showModal(`<h3>${e.icon} ${e.title}</h3><p>${evText(ev)}</p>
      <div class="choice">
        ${via ? `<button class="btn btn-green" data-action="event-solve" data-id="via">${via.label}<span class="btn-top">бесплатно и без риска</span></button>` : ''}
        <button class="btn ${via ? 'btn-ghost' : ''}" data-action="event-solve" data-id="official">Официально · ${fmt(ev.cost)} ₽<span class="btn-top">без риска</span></button>
        <button class="btn btn-line" data-action="event-solve" data-id="bribe">«Договориться» · ${fmt(bribe)} ₽<span class="btn-top">риск ${risk}% — тогда штраф ${fmt(ev.cost * BRIBE_FINE)} ₽</span></button>
        <button class="btn btn-ghost" data-action="close">Решу позже${e.freeze ? ` · «${BIZ[ev.biz].name}» опечатан` : ''}</button>
      </div>
      ${!via && hint ? `<p class="small" style="margin:12px 0 0">Бесплатно решил бы: ${hint}.</p>` : ''}`);
  }
  function solveEvent(how) {
    const ev = S.event;
    if (!ev) return;
    const e = EV[ev.id];
    let msg = '';
    if (how === 'good') { earn(ev.reward); msg = `+${fmt(ev.reward)} ₽`; }
    else if (how === 'via') { const h = evHelper(e); if (!h) return; msg = h.kind === 'job' ? 'Решил своими полномочиями' : 'Решено по-дружески'; }
    else if (how === 'official') { if (!pay(ev.cost)) return; msg = 'Оплачено официально'; }
    else if (how === 'bribe') {
      if (!pay(Math.round(ev.cost / BRIBE_DIVISOR))) return;
      if (Math.random() * 100 < bribeRisk()) {
        S.money = Math.max(0, S.money - ev.cost * BRIBE_FINE);
        S.event = null;
        save(); render();
        showModal(`<h3>🚨 Попался</h3><p>Пришлось заплатить ещё ${fmt(ev.cost * BRIBE_FINE)} ₽ штрафа. Прокурор снижает риск, а нужная связь решает такие вопросы бесплатно.</p>
          <button class="btn full" data-action="close">Урок усвоен</button>`);
        haptic('err');
        return;
      }
      msg = '«Договорились»';
    }
    S.event = null;
    closeModal();
    haptic('ok'); toast(`${e.icon} ${msg}`);
    save(); render();
  }

  // ---------- связи: встречи, просьбы, услуги ----------
  const meetCost = (id, m) => Math.round(m.cost * RARITIES[ITEM[id].rarity].mult * (1 - perk('meetCheap') / 100));
  function addXp(id, xp) {
    const c = S.conn[id], before = connLv(id);
    c.xp = Math.min(CONN_XP[CONN_MAX_LV - 1], c.xp + xp);
    c.last = Date.now();
    const after = connLv(id);
    if (after > before) { toast(`${ITEM[id].icon} Доверие ${after}: ${perkText(ITEM[id], after)}`); haptic('ok'); }
  }
  function favorCost(f) {
    if (!f.cost) return 0;
    if (f.cost.salary) return BIZ[S.favor.biz].salary * f.cost.salary;
    return monthsMoney(f.cost.hours, f.cost.min);
  }
  function maybeFavor() {
    const now = Date.now();
    if (S.favor && now > S.favor.until) {
      const id = S.favor.conn;
      if (S.conn[id]) S.conn[id].xp = Math.max(CONN_XP[connLv(id) - 1], S.conn[id].xp - FAVOR_FAIL_XP);
      if (ITEM[id]) toast(`${ITEM[id].icon} ${short(ITEM[id].name)} обиделся: просьба осталась без ответа`);
      S.favor = null;
    }
    const ids = Object.keys(S.conn);
    if (S.favor || now < S.nextFavor || !ids.length) return;
    const [a, b] = FAVOR_EVERY_H;
    S.nextFavor = now + (a + Math.random() * (b - a)) * 3600e3;
    const has = { car: !!carBonus(), biz: Object.keys(S.biz).length > 0 };
    const pool = FAVORS.filter(f => !f.need || has[f.need]);
    const f = pool[Math.floor(Math.random() * pool.length)];
    const owned = Object.keys(S.biz);
    S.favor = { id: f.id, conn: ids[Math.floor(Math.random() * ids.length)], until: now + FAVOR_TTL_H * 3600e3,
      biz: f.need === 'biz' ? owned[Math.floor(Math.random() * owned.length)] : null };
    save();
    render();
  }
  const favorText = fv => FAVOR[fv.id].text.replace('{name}', ITEM[fv.conn].name).replace('{biz}', fv.biz ? BIZ[fv.biz].name : '');
  function specialAmount(it) {
    const sp = it.special;
    if (sp.type === 'cash') return monthsMoney(sp.hours, 50e3);
    if (sp.type === 'tender') return Math.round(Math.max(bizProfit(), incomeMonth() / 2, 50e3) * sp.hours / 1000) * 1000;
    return 0;
  }
  function specialText(it) {
    const amt = specialAmount(it);
    const base = SPECIALS[it.special.type].replace('{h}', it.special.hours);
    return amt ? `${base.split(':')[0]}: +${fmt(amt)} ₽` : base;
  }
  const specialLeft = id => Math.max(0, (S.conn[id].sp || 0) + SPECIAL_CD_H * 3600e3 - Date.now());

  // ---------- промокоды ----------
  const normCode = c => c.trim().toUpperCase().replace(/\s+/g, '');
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function rewardList(r) {
    return [r.money ? `+${fmt(r.money)} ₽` : '',
      ...Object.entries(r.tickets || {}).map(([id, n]) => `${ticketName(id)}${n > 1 ? ' ×' + n : ''}`),
      r.badge ? `значок «${BADGES[r.badge].name}»` : ''].filter(Boolean).join(', ');
  }
  async function redeem(raw) {
    const code = normCode(raw || '');
    if (!code) { toast('Введи промокод'); return; }
    if (!(window.crypto && crypto.subtle)) { toast('Промокоды не работают в этом браузере'); return; }
    const hash = await sha256(code);
    const p = PROMO_CODES.find(x => x.hash === hash);
    if (!p) { toast('Такого промокода нет'); haptic('err'); return; }
    if (S.promo.includes(hash)) { toast('Этот промокод уже активирован'); haptic('err'); return; }
    if (p.until && new Date() > new Date(p.until + 'T23:59:59')) { toast('Срок действия промокода истёк'); haptic('err'); return; }
    S.promo.push(hash);
    const r = p.reward;
    if (r.money) earn(r.money);
    for (const [id, n] of Object.entries(r.tickets || {})) for (let i = 0; i < n; i++) giveTicket(id);
    if (r.badge && !S.badges.includes(r.badge)) S.badges.push(r.badge);
    save(); render(); showName();
    showModal(`<div class="drop"><div class="drop-icon" style="--rbg:var(--gold-bg)">${ic('gift', 'gold')}</div>
      <div class="drop-name">Промокод активирован</div><div class="small muted">${p.label || ''}</div>
      <div class="drop-bonus">${rewardList(r)}</div>
      <button class="btn full" style="margin-top:12px" data-action="close">Отлично</button></div>`);
    haptic('ok');
  }
  const badgeIcons = () => S.badges.filter(b => BADGES[b]).map(b => `<i class="ti ti-${BADGES[b].icon} gold" title="${BADGES[b].name}"></i>`).join(' ');

  // ---------- сделка с олигархом ----------
  const dealMax = () => Math.min(S.money, monthsMoney(DEAL_INCOME_H, 50e3));

  // ---------- кейсы ----------
  function poolOf(c) {
    return ITEMS.filter(i => c.cats.includes(i.cat) && (!c.tag || (i.t || []).includes(c.tag)));
  }
  // real = настоящий дроп (учитывает и двигает гарантию), иначе — заполнитель ленты рулетки
  function rollItem(c, real) {
    const pool = poolOf(c);
    let rars = RARITY_ORDER.filter(r => c.w[r] > 0 && pool.some(i => i.rarity === r));
    if (real && S.pity >= PITY - 1) {
      const hi = rars.filter(r => rarIdx(r) >= 2);
      if (hi.length) rars = hi;
    }
    let x = Math.random() * rars.reduce((a, r) => a + c.w[r], 0);
    let rar = rars[rars.length - 1];
    for (const r of rars) { if ((x -= c.w[r]) < 0) { rar = r; break; } }
    if (real) S.pity = rarIdx(rar) >= 2 ? 0 : S.pity + 1;
    const list = pool.filter(i => i.rarity === rar);
    return list[Math.floor(Math.random() * list.length)];
  }
  const cdLeft = c => Math.max(0, (S.cd[c.id] || 0) + c.cooldown - Date.now());
  const caseSection = c => (c.cats.includes('conn') ? 'conn' : c.cats.length > 1 ? 'free' : c.cats[0]);

  function openCase(id, n, byTicket) {
    if (spinning) return;
    const c = CASE[id];
    if (byTicket) {
      if (!S.tickets[id]) return;
      S.tickets[id]--;
      n = 1;
    } else if (c.cooldown) {
      const left = cdLeft(c);
      if (left > 0) { toast('Бесплатно через ' + fmtTime(left)); return; }
      S.cd[c.id] = Date.now();
      n = 1;
    } else if (!pay(batchPrice(c, n))) {
      return;
    }
    closeModal();
    const results = [];
    for (let i = 0; i < n; i++) results.push(addItem(rollItem(c, true)));
    S.opened += n;
    progress('open', n);
    if (c.cooldown && !byTicket) progress(c.id === 'free' ? 'free' : 'conn_free');
    save();
    render();
    if (n > 1) showMulti(c, results);
    else if (S.fast) showDrop(results[0]);
    else playRoulette(c, results[0]);
  }

  // Кладёт выпавшее; возвращает, что с ним случилось
  function addItem(it) {
    if (it.cat === 'conn') {
      if (!S.conn[it.id]) { S.conn[it.id] = newConn(0); return { it, isNew: true }; }
      if (S.conn[it.id].xp >= CONN_XP[CONN_MAX_LV - 1]) {
        const v = monthsMoney(2, 50e3);
        earn(v);
        return { it, gift: v };
      }
      const before = connLv(it.id);
      S.conn[it.id].xp = Math.min(CONN_XP[CONN_MAX_LV - 1], S.conn[it.id].xp + DUP_CONN_XP);
      S.conn[it.id].last = Date.now();
      return { it, xp: DUP_CONN_XP, lvUp: connLv(it.id) > before };
    }
    const had = S.inv[it.id] || 0;
    if (had && S.autoSell && it.rarity === 'common') {
      earn(sellPrice(it));
      return { it, sold: true };
    }
    S.inv[it.id] = had + 1;
    if (it.cat === 'car' && (!carBonus() || it.bonus > ITEM[S.car].bonus)) S.car = it.id;
    return { it, isNew: !had };
  }
  function bestCar() {
    let best = null;
    for (const id of Object.keys(S.inv)) {
      const it = ITEM[id];
      if (it && it.cat === 'car' && (!best || it.bonus > best.bonus)) best = it;
    }
    return best ? best.id : null;
  }
  function sell(id) {
    const it = ITEM[id];
    if (!it || !S.inv[id]) return;
    S.inv[id]--;
    earn(sellPrice(it));
    if (!S.inv[id]) {
      delete S.inv[id];
      if (S.car === id) S.car = bestCar();
    }
    haptic('light');
    toast(`Продано: ${it.name} +${fmt(sellPrice(it))} ₽`);
    save();
    render();
  }

  function tileHTML(it, extra = '', cls = '', style = '') {
    return `<div class="tile ${cls}" style="${rStyle(it.rarity)};${style}">
      <div class="tile-icon">${visual(it)}</div><div class="tile-name">${it.name}</div>${extra}</div>`;
  }

  function playRoulette(c, res) {
    spinning = true;
    const strip = $('#rl-strip'), box = $('#rl-window');
    const items = Array.from({ length: RL_WIN + 6 }, (_, i) => (i === RL_WIN ? res.it : rollItem(c, false)));
    strip.innerHTML = items.map(i => tileHTML(i)).join('');
    $('#rl-title').textContent = c.name;
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0)';
    $('#roulette').classList.remove('hidden');
    let done = false, raf = 0, lastIdx = -1;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      $('#roulette').classList.add('hidden');
      spinning = false;
      showDrop(res);
    };
    const follow = () => {
      const m = new DOMMatrix(getComputedStyle(strip).transform);
      const idx = Math.floor((-m.m41 + box.clientWidth / 2) / RL_STEP);
      if (idx !== lastIdx) { lastIdx = idx; haptic('tick'); }
      raf = requestAnimationFrame(follow);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const x = RL_WIN * RL_STEP + 48 - box.clientWidth / 2 + (Math.random() - 0.5) * 70;
      strip.style.transition = 'transform 5.5s cubic-bezier(.1,.75,.15,1)';
      strip.style.transform = `translateX(${-x}px)`;
      raf = requestAnimationFrame(follow);
    }));
    strip.addEventListener('transitionend', () => setTimeout(finish, 350), { once: true });
    $('#rl-skip').onclick = finish;
  }

  // ---------- окна и уведомления ----------
  function showModal(html, sheet) {
    $('#modal-body').innerHTML = html;
    $('#modal').classList.toggle('sheet-mode', !!sheet);
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); }
  const sheetHead = title => `<div class="sheet-head"><h3>${title}</h3><button class="icon-btn" data-action="close" aria-label="Закрыть">${ic('x')}</button></div>`;

  let toastTimer = 0;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function haptic(kind) {
    const h = tg && tg.HapticFeedback;
    if (!h || !inTelegram) return;
    if (kind === 'tick') h.selectionChanged();
    else if (kind === 'ok') h.notificationOccurred('success');
    else if (kind === 'err') h.notificationOccurred('error');
    else h.impactOccurred(kind);
  }
  function askConfirm(text, cb) {
    if (inTelegram && tg.showConfirm) tg.showConfirm(text, ok => ok && cb());
    else if (confirm(text)) cb();
  }

  function bonusText(it) {
    if (it.cat === 'conn') return perkText(it);
    if (it.cat === 'car') return `+${it.bonus}% к зарплате`;
    return `+${fmt(it.bonus)} ₽/мес аренды`;
  }
  function resultNote(res) {
    if (res.sold) return `продано +${fmt(sellPrice(res.it))}`;
    if (res.xp) return `+${res.xp} доверия`;
    if (res.gift) return `+${fmt(res.gift)} ₽`;
    if (res.isNew) return 'НОВОЕ';
    return '';
  }
  function showDrop(res) {
    const it = res.it, r = RARITIES[it.rarity];
    let sub, actions;
    if (it.cat === 'conn') {
      sub = res.isNew ? '<b class="new">Новая связь</b>'
        : res.gift ? `Доверие уже полное · <b class="new">подарок ${fmt(res.gift)} ₽</b>`
        : `Старый знакомый · <b class="new">+${res.xp} доверия${res.lvUp ? ', новый уровень!' : ''}</b>`;
      actions = `<button class="btn btn-ghost grow" data-action="close" data-goto="conn">К связям</button><button class="btn grow" data-action="close">Отлично</button>`;
    } else {
      const n = S.inv[it.id] || 0;
      sub = res.sold ? `Повторка · <b class="new">продано за ${fmt(sellPrice(it))} ₽</b>`
        : res.isNew ? '<b class="new">Новое в коллекции</b>' : `У тебя ×${n}`;
      actions = `${!res.sold && n ? `<button class="btn btn-ghost grow" data-action="sell-drop" data-id="${it.id}">Продать ${fmt(sellPrice(it))} ₽</button>` : ''}
        <button class="btn grow" data-action="close">Забрать</button>`;
    }
    showModal(`<div class="drop" style="${rStyle(it.rarity)}">
      <div class="drop-rarity">${r.name}</div>
      <div class="drop-icon">${visual(it)}</div>
      <div class="drop-name">${it.name}</div>
      <div class="small muted">${sub}</div>
      <div class="drop-bonus">${bonusText(it)}</div>
      <div class="small muted drop-price">${it.value ? `Рыночная цена: ${fmt(it.value)} ₽` : '&nbsp;'}</div>
      <div class="row">${actions}</div></div>`);
    haptic(rarIdx(it.rarity) >= 2 ? 'ok' : 'medium');
  }
  function showMulti(c, results) {
    const sorted = results.slice().sort((a, b) => rarIdx(a.it.rarity) - rarIdx(b.it.rarity));
    const step = S.fast ? 0 : 0.12;
    const tiles = sorted.map((res, i) => {
      const note = resultNote(res);
      return tileHTML(res.it, note ? `<div class="tile-note">${note}</div>` : '',
        'reveal' + (rarIdx(res.it.rarity) >= 3 ? ' shine' : ''), `--d:${(i * step).toFixed(2)}s`);
    }).join('');
    const best = sorted[sorted.length - 1].it;
    const soldSum = results.filter(r => r.sold).reduce((a, r) => a + sellPrice(r.it), 0);
    showModal(`<h3>${c.name} ×${results.length}</h3>
      <div class="tiles mb">${tiles}</div>
      <p class="small">Лучшее: <b style="color:${RARITIES[best.rarity].color}">${best.name}</b>${soldSum ? ` · автопродажа +${fmt(soldSum)} ₽` : ''}</p>
      <button class="btn full" data-action="close">Забрать всё</button>`);
    setTimeout(() => haptic(rarIdx(best.rarity) >= 2 ? 'ok' : 'medium'), sorted.length * step * 1000);
  }
  function showOffline({ sec, earned }) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    const months = Math.round(sec / 3600 * MONTHS_PER_HOUR);
    showModal(`<h3>С возвращением 👋</h3>
      <p>Тебя не было ${h ? h + ' ч ' : ''}${m} мин — в игре прошло ${months ? months + ' мес.' : 'несколько недель'}. Работа, аренда и бизнес принесли:</p>
      <div class="big">+${fmt(earned)} ₽</div>
      <p class="small">Доход копится максимум ${OFFLINE_CAP_H} часов — заходи почаще.</p>
      <button class="btn full" data-action="close">Забрать</button>`);
  }
  function showPeek(id) {
    const c = CASE[id], pool = poolOf(c);
    const rars = RARITY_ORDER.filter(x => c.w[x] > 0 && pool.some(i => i.rarity === x));
    const tw = rars.reduce((a, x) => a + c.w[x], 0);
    const tiles = rars.slice().reverse().flatMap(r => {
      const list = pool.filter(i => i.rarity === r);
      return list.map(i => tileHTML(i, `<div class="tile-note muted">${+(c.w[r] / tw * 100 / list.length).toFixed(2)}%${i.value ? ` · ${fmt(i.value)}` : ''}</div>`));
    });
    showModal(`${sheetHead(c.name + ': что внутри')}<div class="tiles">${tiles.join('')}</div>
      <button class="btn btn-ghost full" style="margin-top:12px" data-action="case" data-id="${id}">${ic('arrow-left')} Назад</button>`, true);
  }

  // ---------- профиль: статус, задания, путь, настройки ----------
  function questRows(set, kind) {
    return set.list.map((q, i) => {
      const d = QDEF[q.id];
      const text = d.text.replace('{X}', fmt(q.target) + ' ₽');
      const done = q.prog >= q.target;
      const reward = kind === 'daily' ? `+${fmt(monthsMoney(DAILY_REWARD.hours, DAILY_REWARD.min))} ₽` : ticketName(WEEKLY_TICKETS[i % WEEKLY_TICKETS.length]);
      const right = q.claimed ? `<span class="tag">${ic('check')}</span>`
        : done ? `<button class="btn btn-green btn-sm" data-action="claim-q" data-id="${kind}:${i}">Забрать</button>`
        : `<span class="small muted">${d.ev === 'earn' ? fmt(q.prog) : q.prog}/${d.ev === 'earn' ? fmt(q.target) : q.target}</span>`;
      return `<div class="quest ${q.claimed ? 'claimed' : ''}"><div class="grow"><div class="q-text">${text}</div>
        <div class="bar thin"><i style="width:${Math.min(100, q.prog / q.target * 100)}%"></i></div>
        <div class="reward">${reward}</div></div>${right}</div>`;
    }).join('');
  }
  function questBonus(set, kind) {
    const label = kind === 'daily' ? `+${fmt(monthsMoney(DAILY_BONUS.hours, DAILY_BONUS.min))} ₽ и ${ticketName(DAILY_BONUS.ticket)}` : ticketName(WEEKLY_BONUS.ticket);
    const right = set.bonus ? `<span class="tag">${ic('check')}</span>`
      : allClaimed(set) ? `<button class="btn btn-sm" data-action="claim-bonus" data-id="${kind}">Забрать</button>`
      : `<span class="tag lock">${ic('lock')}</span>`;
    return `<div class="quest"><div class="grow"><div class="q-text">${ic('trophy', 'gold')} Все задания ${kind === 'daily' ? 'дня' : 'недели'}</div>
      <div class="reward">${label}</div></div>${right}</div>`;
  }
  function lifeCard() {
    const step = LIFE_PATH[S.life];
    if (!step) return `<div class="card accent"><div class="label">${ic('route')} Жизненный путь</div><b>Все цели пройдены. Ты легенда!</b></div>`;
    const done = lifeDone(step);
    return `<div class="card accent ${done ? 'ok' : ''}">
      <div class="label">${ic('route')} Цель ${S.life + 1} из ${LIFE_PATH.length}</div>
      <div class="row"><div class="grow"><div class="big-text">${step.text}</div><div class="reward">${rewardText(step.reward)}</div></div>
      ${done ? '<button class="btn btn-green btn-sm" data-action="claim-life">Забрать</button>' : '<span class="tag lock">в процессе</span>'}</div></div>`;
  }
  function showProfile() {
    ensureQuests();
    const r = rankInfo();
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setHours(24, 0, 0, 0);
    const nextWeek = weekStart(now); nextWeek.setDate(nextWeek.getDate() + 7);
    const left = ms => { const h = Math.floor(ms / 3600e3); return h >= 24 ? `${Math.floor(h / 24)} дн ${h % 24} ч` : `${h} ч ${Math.floor(ms % 3600e3 / 60e3)} мин`; };
    showModal(`${sheetHead('Профиль')}
      <div class="card"><div class="row"><div class="ava">${$('#ava').textContent}</div>
        <div class="grow"><div class="big-text">${r.cur.icon} ${r.cur.name}</div>
          ${S.badges.length ? `<div class="small gold">${S.badges.filter(b => BADGES[b]).map(b => `${ic(BADGES[b].icon)} ${BADGES[b].name}`).join(' · ')}</div>` : ''}
          <div class="bar"><i style="width:${r.pct}%"></i></div>
          <div class="small muted">${r.next ? `До «${r.next.name}»: ${fmt(r.next.min - r.nw)} ₽ состояния` : 'Вершина пищевой цепи'}</div></div></div></div>
      ${lifeCard()}
      <div class="section">Задания дня · обновятся через ${left(tomorrow - now)}</div>
      <div class="card quests">${questRows(S.daily, 'daily')}${questBonus(S.daily, 'daily')}</div>
      <div class="section">Задания недели · ещё ${left(nextWeek - now)}</div>
      <div class="card quests">${questRows(S.weekly, 'weekly')}${questBonus(S.weekly, 'weekly')}</div>
      <div class="section">Промокод</div>
      <div class="card"><div class="row"><input id="promo-input" class="input grow" placeholder="Введи промокод" autocomplete="off" autocapitalize="characters">
        <button class="btn btn-sm" data-action="promo">Активировать</button></div></div>
      <div class="section">Статистика</div>
      <div class="card">
        <div class="kv"><span>Состояние</span><b>${fmt(r.nw)} ₽</b></div>
        <div class="kv"><span>Заработано за всё время</span><b>${fmt(S.total)} ₽</b></div>
        <div class="kv"><span>Открыто кейсов</span><b>${S.opened}</b></div>
        <div class="kv"><span>Коллекция</span><b>${Object.keys(S.inv).filter(id => ITEM[id]).length} из ${ITEMS.filter(i => i.cat !== 'conn').length}</b></div>
      </div>
      <div class="section">Настройки</div>
      <div class="card">
        <label class="toggle"><input type="checkbox" data-toggle="fast" ${S.fast ? 'checked' : ''}><i></i>Быстрое открытие кейсов</label>
        <label class="toggle"><input type="checkbox" data-toggle="autoSell" ${S.autoSell ? 'checked' : ''}><i></i>Продавать обычные повторки</label>
      </div>
      <div class="row"><button class="btn btn-ghost btn-sm grow" data-action="credits">${ic('camera')} Авторы фото</button>
        <button class="btn btn-danger btn-sm grow" data-action="reset">Начать заново</button></div>
      ${DEBUG ? debugPanel() : ''}`, true);
  }

  // ---------- тестовая панель: только при адресе с ?debug ----------
  const DEBUG = /[?&]debug/.test(location.search);
  function debugPanel() {
    const evBtn = e => `<button class="btn btn-sm ${e.good ? 'btn-green' : 'btn-ghost'}" data-action="dbg-event" data-id="${e.id}"
      ${eventOk(e) ? '' : 'disabled'}>${e.icon} ${e.title}</button>`;
    return `<div class="section">Тест (видно только с ?debug)</div>
      <div class="card"><div class="label">События (серые — нет нужного имущества)</div>
        <div class="row" style="flex-wrap:wrap;gap:6px">${EVENTS.map(evBtn).join('')}</div>
        <div class="label" style="margin-top:12px">Деньги и прочее</div>
        <div class="row" style="flex-wrap:wrap;gap:6px">
          ${[1e6, 100e6, 1e9].map(v => `<button class="btn btn-sm btn-ghost" data-action="dbg-money" data-id="${v}">+${fmt(v)}</button>`).join('')}
          <button class="btn btn-sm btn-ghost" data-action="dbg-favor">Просьба связи</button>
          <button class="btn btn-sm btn-ghost" data-action="dbg-free">Сбросить таймеры</button></div>
        <div class="label" style="margin-top:12px">Новый промокод</div>
        <div class="row"><input id="dbg-code" class="input grow" placeholder="Например, VASYA2025" autocomplete="off">
          <button class="btn btn-sm btn-ghost" data-action="dbg-hash">Хэш</button></div>
        <div class="small muted" id="dbg-hash-out" style="margin-top:8px;word-break:break-all;user-select:text;-webkit-user-select:text">
          Строку отсюда вставь в PROMO_CODES в js/data.js и поменяй награду.</div></div>`;
  }

  // ---------- главная ----------
  function renderHome() {
    const car = carBonus() && ITEM[S.car];
    const homes = Object.keys(S.inv).filter(id => ITEM[id] && ITEM[id].cat === 'home').sort((a, b) => ITEM[b].value - ITEM[a].value);
    const job = JOB[S.job], pay = jobPay();
    const nBiz = Object.keys(S.biz).length, bp = bizProfit();
    const nConn = Object.keys(S.conn).length;
    const ev = S.event && EV[S.event.id];
    const life = LIFE_PATH[S.life], lifeOk = life && lifeDone(life);
    const studyLine = studyReady() ? `учёба: доступно ${S.study.left} ур.` : `учёба: перерыв <span data-timer="${S.study.until}">${fmtTime(S.study.until - Date.now())}</span>`;
    const gigLine = S.gig ? (Date.now() >= S.gig.until ? ' · подработка готова' : ` · подработка <span data-timer="${S.gig.until}">${fmtTime(S.gig.until - Date.now())}</span>`) : '';
    const row = (go, icon, title, subline, cls = 'muted') => `<button class="card tap" ${go}><div class="list-row"><div class="ico-box">${ic(icon)}</div>
      <div class="grow"><div class="val">${title}</div><div class="small ${cls}">${subline}</div></div><span class="chev">${ic('chevron-right')}</span></div></button>`;
    return `
      ${ev ? `<button class="card tap ${ev.good ? 'accent' : 'danger'}" data-action="event-show"><div class="list-row">
          <div class="ico-box" style="font-size:22px">${ev.icon}</div>
          <div class="grow"><div class="big-text">${ev.title}</div>
          <div class="small muted">${ev.good ? 'Забери награду' : 'Требует решения'}${S.event.biz ? ' · ' + BIZ[S.event.biz].name : ''}</div></div>
          <span class="chev">${ic('chevron-right')}</span></div></button>` : ''}
      ${life ? `<button class="card tap accent ${lifeOk ? 'ok' : ''}" data-action="${lifeOk ? 'claim-life' : 'profile'}">
        <div class="label">${ic('route')} Следующая цель</div>
        <div class="row"><div class="grow"><div class="big-text">${life.text}</div><div class="reward">${rewardText(life.reward)}</div></div>
        ${lifeOk ? '<span class="btn btn-green btn-sm">Забрать</span>' : `<span class="chev">${ic('chevron-right')}</span>`}</div></button>` : ''}
      <div class="grid2">
        <button class="tile-card" data-action="inv" data-id="car">
          <div class="ph">${car ? visual(car) : ic('car')}</div>
          <div class="body"><div class="label">Гараж · ${countCat('car')}</div>
            <div class="val ellipsis">${car ? car.name : 'Пешком'}</div>
            <div class="small ${car ? 'good' : 'muted'}">${car ? `+${car.bonus}% к зарплате` : 'машины — в кейсах'}</div></div></button>
        <button class="tile-card" data-action="inv" data-id="home">
          <div class="ph">${homes.length ? `<img class="cover" src="${ITEM[homes[0]].img}" alt="">` : ic('home')}</div>
          <div class="body"><div class="label">Жильё · ${countCat('home')}</div>
            <div class="val ellipsis">${homes.length ? ITEM[homes[0]].name : 'Нет жилья'}</div>
            <div class="small ${homes.length ? 'good' : 'muted'}">${homes.length ? `+${fmt(rent())} ₽/мес` : 'жильё — в кейсах'}</div></div></button>
      </div>
      ${row('data-goto="career"', 'briefcase', job ? job.name : 'Предприниматель',
        `${pay ? `<span class="good">${fmt(pay)} ₽/мес</span> · ` : ''}${studyLine}${gigLine}`)}
      ${row('data-goto="biz"', 'building-factory-2', nBiz ? `Бизнес · ${nBiz}` : 'Свой бизнес',
        nBiz ? `${bp >= 0 ? '+' : ''}${fmt(bp)} ₽/мес` : 'от ларька с шаурмой до IT-холдинга', nBiz ? (bp < 0 ? 'bad' : 'good') : 'muted')}
      ${row('data-goto="conn"', 'users', nConn ? `Связи · ${nConn}` : 'Связи',
        S.favor ? 'Тебя кое о чём просят' : nConn ? 'полезные люди решают проблемы' : 'открой «Знакомство дня»', S.favor ? 'gold' : 'muted')}
      <p class="small muted" style="text-align:center;margin-top:6px">${ic('clock')} 1 реальный час = ${MONTHS_PER_HOUR} игровых месяцев</p>`;
  }

  // ---------- имущество (открывается с главной) ----------
  function renderInv() {
    const cat = sub.inv;
    const list = Object.keys(S.inv).map(id => ITEM[id]).filter(it => it && it.cat === cat)
      .sort((a, b) => rarIdx(b.rarity) - rarIdx(a.rarity) || b.value - a.value);
    const rows = list.map(it => {
      const n = S.inv[it.id];
      const equip = cat === 'home' ? '' : S.car === it.id ? '<span class="tag">За рулём</span>'
        : `<button class="btn btn-sm btn-line" data-action="equip" data-id="${it.id}">Сесть</button>`;
      return `<div class="inv-item" style="${rStyle(it.rarity)}">
        <div class="inv-icon">${visual(it)}${n > 1 ? `<b class="cnt">×${n}</b>` : ''}</div>
        <div class="grow"><div class="inv-name">${it.name}</div>
          <div class="small" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</div>
          <div class="small muted">${bonusText(it)}${cat === 'home' && n > 1 ? ' × ' + n : ''} · ${fmt(it.value)} ₽</div></div>
        <div class="inv-actions">${equip}<button class="btn btn-sm btn-ghost" data-action="sell" data-id="${it.id}">Продать ${fmt(sellPrice(it))}</button></div></div>`;
    }).join('');
    return `<button class="back" data-goto="home">${ic('chevron-left')} Главная</button>
      <div class="seg">
        <button class="${cat === 'car' ? 'active' : ''}" data-sub="inv:car">Гараж · ${countCat('car')}</button>
        <button class="${cat === 'home' ? 'active' : ''}" data-sub="inv:home">Жильё · ${countCat('home')}</button></div>
      <p class="hint">${cat === 'car' ? 'Машина, на которой ездишь, прибавляет к зарплате.' : 'Всё жильё сдаётся и приносит аренду.'} Собрано ${list.length} из ${ITEMS.filter(i => i.cat === cat).length}.</p>
      ${rows || `<div class="empty">${ic(cat === 'car' ? 'car' : 'home')}Пока пусто<br><br><button class="btn btn-sm" data-goto="cases" data-sub="cases:${cat}">К кейсам</button></div>`}`;
  }

  // ---------- кейсы ----------
  const coverHTML = c => (c.cover ? `<img src="${c.cover}" alt="" loading="lazy">` : c.icon);
  function caseTile(c) {
    const tickets = S.tickets[c.id] || 0;
    return `<button class="case-tile" data-action="case" data-id="${c.id}">
      ${tickets ? `<span class="case-badge">${ic('ticket')} ×${tickets}</span>` : ''}
      <div class="case-cover">${coverHTML(c)}</div>
      <div class="body"><div class="case-name ellipsis">${c.name}</div><div class="case-price">${fmt(casePrice(c))} ₽</div></div></button>`;
  }
  function freeCaseCard(c) {
    const left = cdLeft(c);
    return `<div class="card free-case"><div class="case-cover">${coverHTML(c)}</div>
      <div class="grow"><div class="case-name">${c.name}</div><div class="small muted">${c.desc}</div></div>
      <button class="btn btn-sm ${left ? 'btn-ghost' : 'btn-green'}" data-cdcase="${c.id}" data-action="open" data-id="${c.id}" data-n="1" ${left ? 'disabled' : ''}>${left ? fmtTime(left) : 'Бесплатно'}</button></div>`;
  }
  function renderCases() {
    const sec = sub.cases;
    const list = CASES.filter(c => caseSection(c) === sec && !c.cooldown);
    const main = list.filter(c => !c.tag), themed = list.filter(c => c.tag);
    const dot = c => (!cdLeft(c) ? ' <span class="dotty">•</span>' : '');
    return `<div class="seg">
        <button class="${sec === 'car' ? 'active' : ''}" data-sub="cases:car">Авто${dot(CASE.free)}</button>
        <button class="${sec === 'home' ? 'active' : ''}" data-sub="cases:home">Жильё</button>
        <button class="${sec === 'conn' ? 'active' : ''}" data-sub="cases:conn">Связи${dot(CASE.conn_free)}</button></div>
      <p class="pity mb">${ic('target')} Эпик или выше не позже чем через ${PITY - S.pity} шт.${S.skills.cha ? ` · скидка ${Math.min(S.skills.cha, 30)}%` : ''}</p>
      ${freeCaseCard(sec === 'conn' ? CASE.conn_free : CASE.free)}
      ${main.length ? `<div class="section">По цене</div><div class="case-grid">${main.map(caseTile).join('')}</div>` : ''}
      ${themed.length ? `<div class="section">Тематические</div><div class="case-grid">${themed.map(caseTile).join('')}</div>` : ''}`;
  }
  function showCase(id) {
    const c = CASE[id], pool = poolOf(c);
    const rars = RARITY_ORDER.filter(r => c.w[r] > 0 && pool.some(i => i.rarity === r));
    const tw = rars.reduce((a, r) => a + c.w[r], 0);
    const bar = rars.map(r => `<i style="width:${c.w[r] / tw * 100}%;background:${RARITIES[r].color}"></i>`).join('');
    const legend = rars.map(r => `<span style="color:${RARITIES[r].color}">${RARITIES[r].name} ${+(c.w[r] / tw * 100).toFixed(1)}%</span>`).join('');
    const tickets = S.tickets[id] || 0;
    showModal(`${sheetHead(c.name)}
      <div class="case-tile" style="margin-bottom:12px"><div class="case-cover" style="height:140px">${coverHTML(c)}</div></div>
      <p>${c.desc}. Внутри ${pool.length} предметов.</p>
      <div class="chance-bar">${bar}</div><div class="chance-legend">${legend}</div>
      ${tickets ? `<button class="btn full" style="margin-top:12px" data-action="ticket" data-id="${id}">${ic('ticket')} Открыть по билету · осталось ${tickets}</button>` : ''}
      <div class="open-row">${MULTI_OPEN.map(n => `<button class="btn ${n > 1 ? 'btn-ghost' : ''}" data-action="open" data-id="${id}" data-n="${n}">
        <span class="btn-top">×${n}${MULTI_DISCOUNT[n] ? ` <s>−${MULTI_DISCOUNT[n] * 100}%</s>` : ''}</span>${fmt(batchPrice(c, n))} ₽</button>`).join('')}</div>
      <button class="btn btn-ghost full" style="margin-top:8px" data-action="peek" data-id="${id}">${ic('list-search')} Что внутри</button>`, true);
  }

  // ---------- карьера ----------
  function renderCareer() {
    const v = sub.career;
    const gigReady = S.gig && Date.now() >= S.gig.until;
    return `<div class="seg">
        <button class="${v === 'jobs' ? 'active' : ''}" data-sub="career:jobs">Работа</button>
        <button class="${v === 'skills' ? 'active' : ''}" data-sub="career:skills">Учёба${studyReady() ? ' <span class="dotty">•</span>' : ''}</button>
        <button class="${v === 'gigs' ? 'active' : ''}" data-sub="career:gigs">Подработки${gigReady ? ' <span class="dotty">•</span>' : ''}</button></div>
      ${v === 'jobs' ? renderJobs() : v === 'skills' ? renderSkills() : renderGigs()}`;
  }
  const reqTags = (req, extra = []) => Object.entries(req || {})
    .map(([k, v]) => `<span class="req ${S.skills[k] >= v ? 'ok' : 'no'}">${SKILL[k].name} ${v}</span>`).concat(extra).join('');
  function jobCard(j) {
    const cur = S.job === j.id, ok = meetsJob(j);
    const bonus = [j.perk ? PERKS[j.perk].replace('{v}', j.v) : '', ...(j.solves || []).map(id => `${EV[id].title.toLowerCase()} — бесплатно`)].filter(Boolean).join(' · ');
    const reqs = reqTags(j.req, j.needCar ? [`<span class="req ${carBonus() ? 'ok' : 'no'}">своя машина</span>`] : []);
    const action = cur ? '<span class="tag">Работаешь</span>'
      : ok ? `<button class="btn btn-sm" data-action="job" data-id="${j.id}">Устроиться</button>` : `<span class="tag lock">${ic('lock')}</span>`;
    return `<div class="card job ${cur ? 'current' : ''} ${ok || cur ? '' : 'locked'}">
      <div class="job-ico">${j.icon}</div>
      <div class="grow"><div class="job-name">${j.name}</div><div class="job-pay">${fmt(j.pay)} ₽/мес</div>
        ${bonus ? `<div class="perk">${ic('star')} ${bonus}</div>` : ''}${!ok && !cur && reqs ? `<div class="reqs">${reqs}</div>` : ''}</div>
      ${action}</div>`;
  }
  function renderJobs() {
    const open = JOBS.filter(j => S.job === j.id || meetsJob(j)).reverse();
    const locked = JOBS.filter(j => S.job !== j.id && !meetsJob(j));
    const focus = Object.keys(S.biz).length ? `<div class="card small">${S.job
      ? `Пока работаешь, бизнес без управляющего идёт на ${Math.round(OWNER_EFF_EMPLOYED * 100)}%.<br>
         <button class="btn btn-sm btn-line" style="margin-top:8px" data-action="quit">Уволиться и заняться бизнесом</button>`
      : `Ты занимаешься только бизнесом: без управляющего он идёт на ${Math.round(OWNER_EFF_FREE * 100)}%. Работа даст зарплату и пользу профессии.`}</div>` : '';
    // Ближайшая закрытая профессия: меньше всего не хватает уровней навыков
    const miss = j => Object.entries(j.req).reduce((a, [k, v]) => a + Math.max(0, v - S.skills[k]), 0);
    const near = locked.slice().sort((x, y) => miss(x) - miss(y))[0];
    return `<p class="hint">Кроме зарплаты каждая профессия даёт свою пользу ${ic('star', 'gold')} — пока ты на ней работаешь.</p>
      ${focus}
      ${locked.length ? `<details class="card more-card"><summary class="row"><span class="ico-box">${ic('lock')}</span>
        <span class="grow"><span class="val">Ещё ${locked.length} профессий закрыто</span><br>
        <span class="small muted">Нужны навыки — качай их в «Учёбе». Ближе всего: ${near.name}</span></span><span class="chev">${ic('chevron-down')}</span></summary>
        <div style="margin-top:10px">${locked.map(jobCard).join('')}</div></details>` : ''}
      ${open.map(jobCard).join('')}`;
  }
  function renderSkills() {
    const ready = studyReady(), rest = studyRest();
    const skIcon = { int: 'brain', cha: 'message-circle', fit: 'barbell', biz: 'chart-line' };
    return `<div class="card ${ready ? 'accent' : ''}">
        ${ready ? `<div class="big-text">Можно пройти ещё ${S.study.left} ${S.study.left === 1 ? 'уровень' : 'уровня'}</div>
          <div class="small muted">Потом перерыв ${hoursText(rest)}. Чем выше навыки, тем дольше перерыв.</div>`
        : `<div class="big-text">Перерыв в учёбе</div><div class="small muted">Новые уровни через <span data-timer="${S.study.until}">${fmtTime(S.study.until - Date.now())}</span></div>`}
      </div>
      ${SKILLS.map(s => {
        const lvl = S.skills[s.id], max = lvl >= SKILL_MAX, cost = skillCost(lvl);
        return `<div class="card job"><div class="ico-box">${ic(skIcon[s.id])}</div>
          <div class="grow"><div class="job-name">${s.name} <span class="gold">${lvl}</span><span class="muted small">/${SKILL_MAX}</span></div>
            <div class="small muted">${s.desc}</div><div class="bar"><i style="width:${lvl / SKILL_MAX * 100}%"></i></div></div>
          ${max ? '<span class="tag">MAX</span>'
            : `<button class="btn btn-sm btn-col" data-action="skill" data-id="${s.id}" ${!ready || S.money < cost ? 'disabled' : ''}>+1<span class="btn-top">${fmt(cost)} ₽</span></button>`}
        </div>`;
      }).join('')}`;
  }
  function renderGigs() {
    const g = S.gig;
    let active = '';
    if (g) {
      const d = GIG[g.id], ready = Date.now() >= g.until;
      active = `<div class="card accent ${ready ? 'ok' : ''}"><div class="row"><div class="job-ico">${d.icon}</div>
        <div class="grow"><div class="job-name">${d.name}</div><div class="job-pay">+${fmt(gigPay(d))} ₽</div></div>
        ${ready ? '<button class="btn btn-green btn-sm" data-action="gig-claim">Забрать</button>'
          : `<span class="tag gold" data-timer="${g.until}">${fmtTime(g.until - Date.now())}</span>`}</div></div>`;
    }
    const card = d => {
      const ok = gigOpen(d);
      const reqs = reqTags(d.req, [d.rank ? `<span class="req ${rankIdx() >= d.rank ? 'ok' : 'no'}">${RANKS[d.rank].name}</span>` : '',
        d.needCar ? `<span class="req ${carBonus() ? 'ok' : 'no'}">своя машина</span>` : ''].filter(Boolean));
      return `<div class="card job ${ok ? '' : 'locked'}"><div class="job-ico">${d.icon}</div>
        <div class="grow"><div class="job-name">${d.name}</div><div class="job-pay">+${fmt(gigPay(d))} ₽ · ${hoursText(d.h)}</div>
          ${!ok ? `<div class="reqs">${reqs}</div>` : ''}</div>
        ${ok ? `<button class="btn btn-sm" data-action="gig" data-id="${d.id}" ${g ? 'disabled' : ''}>Начать</button>` : `<span class="tag lock">${ic('lock')}</span>`}</div>`;
    };
    const open = GIGS.filter(gigOpen), locked = GIGS.filter(d => !gigOpen(d));
    return `<p class="hint">Разовые задания: запусти и вернись за деньгами. Одна за раз, основной работе не мешает.</p>
      ${active}${open.slice().reverse().map(card).join('')}
      ${locked.length ? `<details class="more"><summary>${ic('lock')} Закрытые · ${locked.length}</summary>${locked.map(card).join('')}</details>` : ''}`;
  }

  // ---------- бизнес ----------
  function renderBiz() {
    const owned = BUSINESSES.filter(d => S.biz[d.id]);
    const total = bizProfit();
    const cards = owned.map(d => {
      const b = S.biz[d.id], st = bizStats(d.id);
      const neck = {
        machines: `Не хватает станков: ${b.w - b.m > 0 ? `${b.w - b.m} сотр. простаивают` : 'спрос выше производства'}`,
        staff: `Не хватает людей: ${b.m - b.w > 0 ? `${b.m - b.w} станк. простаивают` : 'спрос выше производства'}`,
        both: 'Спрос выше производства: добавь станок и сотрудника',
        demand: b.w > b.m ? `Лишние сотрудники: ${b.w - b.m} без станка` : 'Производишь больше, чем покупают: нужна реклама',
      }[st.neck];
      const full = b.m >= d.slots, fullW = b.w >= d.slots, fullMk = b.mk >= MKT_MAX;
      return `<div class="card ${frozen(d.id) ? 'danger' : ''}">
        <div class="biz-head"><div class="ico-box" style="font-size:22px">${d.icon}</div>
          <div class="grow"><div class="job-name">${d.name}</div>
            <div class="small muted">${frozen(d.id) ? '🔒 Опечатан' : b.mgr ? 'С управляющим: 100%' : `Без управляющего: ${Math.round(st.eff * 100)}%`}</div></div>
          <div class="biz-profit ${st.profit < 0 ? 'bad' : ''}">${st.profit >= 0 ? '+' : ''}${fmt(st.profit)}<div class="small muted">₽/мес</div></div></div>
        <div class="biz-grid">
          <div><span class="small muted">Производство</span><b>${fmt(st.cap)}</b></div>
          <div><span class="small muted">Спрос</span><b>${fmt(st.demand)}</b></div>
          <div><span class="small muted">Продано</span><b>${fmt(st.sold)}</b></div></div>
        <div class="small ${neck ? 'gold' : 'good'}" style="margin-bottom:10px">${neck ? ic('alert-triangle') + ' ' + neck : ic('check') + ' Производство и спрос в балансе'}</div>
        <div class="acts">
          <button class="act" data-action="biz-machine" data-id="${d.id}" ${full ? 'disabled' : ''}>${ic('settings-2')}
            <span class="act-name">${d.machine}</span><span class="act-sub">${b.m}/${d.slots}</span><span class="act-cost">${full ? 'макс.' : fmt(machineCost(d.id))}</span></button>
          <button class="act" data-action="biz-hire" data-id="${d.id}" ${fullW ? 'disabled' : ''}>${ic('user-plus')}
            <span class="act-name">${d.worker}</span><span class="act-sub">${b.w}/${d.slots} · ${fmt(d.salary)}/мес</span><span class="act-cost">${fullW ? 'макс.' : 'найм ' + fmt(hireCost(d.id))}</span></button>
          <button class="act" data-action="biz-mkt" data-id="${d.id}" ${fullMk ? 'disabled' : ''}>${ic('speakerphone')}
            <span class="act-name">Реклама</span><span class="act-sub">ур. ${b.mk}/${MKT_MAX}</span><span class="act-cost">${fullMk ? 'макс.' : fmt(mktCost(d.id))}</span></button></div>
        <details class="more"><summary>${ic('receipt')} Доходы, расходы и управление</summary>
          <div class="kv small"><span>Выручка</span><b>${fmt(st.revenue)}</b></div>
          <div class="kv small"><span>Зарплаты (${b.w} × ${fmt(d.salary)})</span><b>−${fmt(st.wages)}</b></div>
          <div class="kv small"><span>Аренда помещения</span><b>−${fmt(st.rent)}</b></div>
          ${b.mgr ? `<div class="kv small"><span>Управляющий</span><b>−${fmt(st.mgr)}</b></div>` : ''}
          <div class="kv small"><span>Налог ${Math.round(taxRate() * 100)}%</span><b>−${fmt(st.tax)}</b></div>
          <div class="kv small"><span>Вложено</span><b>${fmt(b.inv)}</b></div>
          <div class="row" style="margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-sm ${b.mgr ? 'btn-ghost' : 'btn-line'}" data-action="biz-mgr" data-id="${d.id}">${b.mgr ? 'Уволить управляющего' : `Нанять управляющего · ${fmt(d.mgrSalary)}/мес`}</button>
            ${b.w > 0 ? `<button class="btn btn-sm btn-ghost" data-action="biz-fire" data-id="${d.id}">Уволить сотрудника</button>` : ''}
            <button class="btn btn-sm btn-danger" data-action="biz-sell" data-id="${d.id}">Продать за ${fmt(b.inv * bizSellRate())}</button></div>
        </details></div>`;
    }).join('');
    const rest = BUSINESSES.filter(d => !S.biz[d.id]);
    const shop = rest.map(d => {
      const open = bizOpen(d);
      const reqs = reqTags(d.req, [`<span class="req ${rankIdx() >= d.rank ? 'ok' : 'no'}">${RANKS[d.rank].name}</span>`]);
      return `<div class="card job ${open ? '' : 'locked'}"><div class="ico-box" style="font-size:22px">${d.icon}</div>
        <div class="grow"><div class="job-name">${d.name}</div>
          <div class="small muted">${fmt(d.price)} ₽ + лицензии ${fmt(licenseCost(d))} ₽ · до ${d.slots} мест</div>
          ${open ? '' : `<div class="reqs">${reqs}</div>`}</div>
        ${open ? `<button class="btn btn-sm" data-action="biz-buy" data-id="${d.id}">Открыть</button>` : `<span class="tag lock">${ic('lock')}</span>`}</div>`;
    }).join('');
    return `<div class="title">Бизнес</div>
      ${owned.length ? `<div class="card"><div class="kv"><span>Прибыль всех бизнесов</span><b class="${total < 0 ? 'bad' : 'good'}">${fmt(total)} ₽/мес</b></div>
        <div class="small muted" style="margin-top:6px">Без управляющего бизнес работает на ${Math.round(ownerEff() * 100)}% — ${S.job ? 'ты занят на работе' : 'ты занят только бизнесом'}.</div></div>${cards}`
        : '<p class="hint">Прибыль = продажи × наценка − зарплаты − аренда − налог. Каждому рабочему месту нужны станок и сотрудник, а продаётся не больше, чем есть спроса.</p>'}
      ${rest.length ? `<details class="more" ${owned.length ? '' : 'open'}><summary>${ic('plus')} Открыть новый бизнес</summary>${shop}</details>` : ''}`;
  }

  // ---------- связи ----------
  const stars = lv => `<span class="stars">${'★'.repeat(lv)}<span class="off">${'★'.repeat(CONN_MAX_LV - lv)}</span></span>`;
  const lvPct = id => {
    const lv = connLv(id), c = S.conn[id];
    return lv >= CONN_MAX_LV ? 100 : (c.xp - CONN_XP[lv - 1]) / (CONN_XP[lv] - CONN_XP[lv - 1]) * 100;
  };
  function renderConn() {
    const ids = Object.keys(S.conn).filter(id => ITEM[id]).sort((a, b) => rarIdx(ITEM[b].rarity) - rarIdx(ITEM[a].rarity) || connLv(b) - connLv(a));
    const fv = S.favor;
    let favor = '';
    if (fv) {
      const f = FAVOR[fv.id], cost = favorCost(f);
      favor = `<div class="card accent"><div class="label">${ic('hand-finger')} Просьба · ещё <span data-timer="${fv.until}">${fmtTime(fv.until - Date.now())}</span></div>
        <div class="big-text" style="margin-bottom:4px">${ITEM[fv.conn].icon} ${favorText(fv)}</div>
        <div class="small muted mb">Поможешь — +${f.xp} доверия. Откажешь — −${FAVOR_FAIL_XP}.</div>
        <div class="row"><button class="btn btn-sm grow" data-action="favor-yes">${cost ? `Помочь · ${fmt(cost)} ₽` : 'Помочь'}</button>
          <button class="btn btn-sm btn-ghost" data-action="favor-no">Отказать</button></div></div>`;
    }
    let deal = '';
    if (perk('deal')) {
      const d = S.deal, used = S.dealDay === dayKey(new Date());
      deal = `<div class="card"><div class="label">${ic('briefcase')} Сделка с олигархом</div>
        <div class="small muted mb">Вложи до ${DEAL_INCOME_H} мес. своего дохода — через ${DEAL_HOURS} ч вернётся +${perk('deal')}%. Раз в сутки.</div>
        ${d ? (Date.now() >= d.until ? `<button class="btn btn-green full" data-action="deal-claim">Забрать ${fmt(d.ret)} ₽</button>`
            : `<div class="row"><span class="grow small">${fmt(d.amount)} → ${fmt(d.ret)} ₽</span><span class="tag gold" data-timer="${d.until}">${fmtTime(d.until - Date.now())}</span></div>`)
          : used ? '<span class="tag lock">Завтра будет новая сделка</span>'
          : `<button class="btn full" data-action="deal" ${dealMax() <= 0 ? 'disabled' : ''}>Вложить ${fmt(dealMax())} ₽</button>`}</div>`;
    }
    const rows = ids.map(id => {
      const it = ITEM[id], lv = connLv(id);
      const spReady = lv >= CONN_MAX_LV && !specialLeft(id);
      return `<button class="card tap" data-action="conn" data-id="${id}"><div class="list-row">
        <div class="ico-box" style="font-size:22px;background:${RARITIES[it.rarity].bg}">${it.icon}</div>
        <div class="grow"><div class="row"><span class="val grow ellipsis">${it.name}</span>${stars(lv)}</div>
          <div class="bar thin"><i style="width:${lvPct(id)}%"></i></div>
          <div class="small ${spReady ? 'gold' : 'muted'} ellipsis">${spReady ? 'Особая услуга готова' : perkText(it)}</div></div></div></button>`;
    }).join('');
    return `<div class="title">Связи</div>
      ${freeCaseCard(CASE.conn_free)}
      ${favor}${deal}
      ${rows ? `<div class="section">Твои связи · ${ids.length}</div>${rows}`
        : `<div class="empty">${ic('users')}Полезные люди решают проблемы и дают бонусы.<br>Начни со «Знакомства дня».</div>`}
      <p class="hint" style="margin-top:10px">Доверие растёт от встреч и выполненных просьб. На ${CONN_MAX_LV} ★ открывается особая услуга. Если долго не общаться, доверие понемногу тает.</p>
      <button class="btn btn-ghost full" data-goto="cases" data-sub="cases:conn">${ic('box')} Больше связей — в кейсах</button>`;
  }
  function showConn(id) {
    const it = ITEM[id], c = S.conn[id], lv = connLv(id), now = Date.now();
    const toNext = lv < CONN_MAX_LV ? `${Math.ceil(CONN_XP[lv] - c.xp)} доверия до ${lv + 1} ★` : 'Полное доверие';
    const meets = MEETS.map(m => {
      const until = c.cd[m.id] || 0, wait = until > now;
      return `<button class="act" data-action="meet" data-id="${id}:${m.id}" ${wait ? 'disabled' : ''}>${ic(m.icon.replace('ti-', ''))}
        <span class="act-name">${m.name}</span><span class="act-sub">+${Math.round(m.xp * (1 + perk('trustUp') / 100))} доверия</span>
        <span class="act-cost">${wait ? fmtTime(until - now) : fmt(meetCost(id, m)) + ' ₽'}</span></button>`;
    }).join('');
    const spLeft = specialLeft(id);
    const canUse = it.special.type !== 'closeEvent' || (S.event && !EV[S.event.id].good);
    showModal(`${sheetHead('')}
      <div class="conn-hero" style="${rStyle(it.rarity)}"><div class="face">${it.icon}</div>
        <div class="big-text">${it.name}</div><div class="small" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</div>
        <div style="margin-top:6px">${stars(lv)}</div></div>
      <div class="bar"><i style="width:${lvPct(id)}%"></i></div><div class="small muted mb">${toNext}</div>
      <div class="card"><div class="label">Сейчас даёт</div><div class="good">${perkText(it, lv)}</div>
        ${lv < CONN_MAX_LV ? `<div class="small muted" style="margin-top:4px">На ${lv + 1} ★: ${perkText(it, lv + 1)}</div>` : ''}</div>
      <div class="card ${lv >= CONN_MAX_LV ? 'accent' : ''}"><div class="label">${ic('sparkles')} Особая услуга · раз в сутки</div>
        <div>${specialText(it)}</div>
        ${lv < CONN_MAX_LV ? `<div class="small muted" style="margin-top:4px">Откроется на ${CONN_MAX_LV} ★</div>`
          : spLeft ? `<div class="small muted" style="margin-top:6px">Снова через ${fmtTime(spLeft)}</div>`
          : `<button class="btn btn-sm full" style="margin-top:8px" data-action="special" data-id="${id}" ${canUse ? '' : 'disabled'}>${canUse ? 'Воспользоваться' : 'Сейчас нет проблем'}</button>`}</div>
      <div class="section">Встречи</div><div class="acts">${meets}</div>`, true);
  }

  const VIEWS = { home: renderHome, inv: renderInv, cases: renderCases, career: renderCareer, biz: renderBiz, conn: renderConn };
  function render() {
    $('#view').innerHTML = VIEWS[tab]();
    const navTab = tab === 'inv' ? 'home' : tab;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === navTab));
    updateLive();
  }

  // То, что меняется каждую секунду, обновляем точечно
  function updateLive() {
    $('#money').textContent = fmt(S.money);
    const im = incomeMonth();
    $('#inc').textContent = (im >= 0 ? '+' : '') + fmt(im);
    $('#prank').textContent = rankInfo().cur.icon + ' ' + rankInfo().cur.name;
    const now = Date.now();
    document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = fmtTime(+el.dataset.timer - now); });
    document.querySelectorAll('[data-cdcase]').forEach(b => {
      const left = cdLeft(CASE[b.dataset.cdcase]);
      b.disabled = left > 0;
      b.classList.toggle('btn-green', !left);
      b.classList.toggle('btn-ghost', !!left);
      b.textContent = left ? fmtTime(left) : 'Бесплатно';
    });
    $('#ava').classList.toggle('dot', profileClaimable());
    $('.nav [data-tab="cases"]').classList.toggle('dot', !cdLeft(CASE.free));
    $('.nav [data-tab="career"]').classList.toggle('dot', !!(S.gig && now >= S.gig.until) || (studyReady() && S.money >= Math.min(...Object.values(S.skills).map(skillCost))));
    $('.nav [data-tab="conn"]').classList.toggle('dot', !cdLeft(CASE.conn_free) || !!S.favor || !!(S.deal && now >= S.deal.until));
    // закончился перерыв в учёбе или подработка — перерисовать карьеру
    if (tab === 'career' && ((S.study.left <= 0 && now >= S.study.until) ||
        (S.gig && now >= S.gig.until && sub.career === 'gigs' && !$('[data-action="gig-claim"]')))) render();
  }

  // Улучшение бизнеса: засчитывается в задания и показывает, как изменилась прибыль
  function bizUp(id, fn) {
    if (!S.biz[id]) return;
    const before = bizStats(id).profit;
    if (fn() === false) return;
    const diff = bizStats(id).profit - before;
    progress('bizup');
    haptic('medium');
    toast(`Прибыль: ${diff >= 0 ? '+' : ''}${fmt(diff)} ₽/мес`);
    save();
    render();
  }

  // ---------- действия ----------
  const ACTIONS = {
    profile: () => showProfile(),
    case: id => showCase(id),
    open: (id, el) => openCase(id, +el.dataset.n || 1),
    ticket: id => openCase(id, 1, true),
    peek: id => showPeek(id),
    close: (id, el) => {
      closeModal();
      if (el.dataset.goto) { tab = el.dataset.goto; render(); }
    },
    inv: id => { sub.inv = id; tab = 'inv'; render(); window.scrollTo(0, 0); },
    'sell-drop': id => { closeModal(); sell(id); },
    sell: id => sell(id),
    equip: id => { S.car = id; haptic('light'); save(); render(); },
    job: id => {
      if (!meetsJob(JOB[id])) return;
      S.job = id;
      haptic('ok'); toast('Ты устроился: ' + JOB[id].name);
      save(); render();
    },
    quit: () => askConfirm(`Уволиться? Зарплаты и пользы профессии не будет, зато бизнес без управляющего пойдёт на ${Math.round(OWNER_EFF_FREE * 100)}%.`, () => {
      S.job = null;
      haptic('medium'); toast('Теперь ты предприниматель');
      save(); render();
    }),
    skill: id => {
      const lvl = S.skills[id];
      if (!studyReady() || lvl >= SKILL_MAX || !pay(skillCost(lvl))) return;
      S.skills[id]++;
      S.study.left--;
      progress('skill');
      if (S.study.left <= 0) S.study.until = Date.now() + studyRest() * 3600e3;
      haptic('medium'); toast(`${SKILL[id].name}: уровень ${S.skills[id]}${S.study.left <= 0 ? ' · перерыв ' + hoursText(studyRest()) : ''}`);
      save(); render();
    },
    gig: id => {
      const d = GIG[id];
      if (S.gig || !gigOpen(d)) return;
      S.gig = { id, until: Date.now() + d.h * 3600e3 };
      haptic('medium'); toast(`${d.icon} Подработка начата`);
      save(); render();
    },
    'gig-claim': () => {
      if (!S.gig || Date.now() < S.gig.until) return;
      const v = gigPay(GIG[S.gig.id]);
      S.gig = null;
      earn(v, 'work');
      progress('gig');
      haptic('ok'); toast(`Подработка: +${fmt(v)} ₽`);
      save(); render();
    },
    'claim-q': key => {
      const [kind, i] = key.split(':');
      const set = kind === 'daily' ? S.daily : S.weekly, q = set.list[+i];
      if (!q || q.claimed || q.prog < q.target) return;
      q.claimed = true;
      if (kind === 'daily') {
        const v = monthsMoney(DAILY_REWARD.hours, DAILY_REWARD.min);
        earn(v);
        toast(`Задание выполнено: +${fmt(v)} ₽`);
      } else {
        const t = WEEKLY_TICKETS[+i % WEEKLY_TICKETS.length];
        giveTicket(t);
        toast(`Получен ${ticketName(t)}`);
      }
      haptic('ok'); save(); render(); showProfile();
    },
    'claim-bonus': kind => {
      const set = kind === 'daily' ? S.daily : S.weekly;
      if (set.bonus || !allClaimed(set)) return;
      set.bonus = true;
      if (kind === 'daily') {
        const v = monthsMoney(DAILY_BONUS.hours, DAILY_BONUS.min);
        earn(v);
        giveTicket(DAILY_BONUS.ticket);
        progress('daily_all');
        toast(`+${fmt(v)} ₽ и ${ticketName(DAILY_BONUS.ticket)}`);
      } else {
        giveTicket(WEEKLY_BONUS.ticket);
        toast(`Получен ${ticketName(WEEKLY_BONUS.ticket)}`);
      }
      haptic('ok'); save(); render(); showProfile();
    },
    'claim-life': () => {
      const step = LIFE_PATH[S.life];
      if (!step || !lifeDone(step)) return;
      if (step.reward.money) earn(step.reward.money);
      if (step.reward.ticket) giveTicket(step.reward.ticket);
      S.life++;
      haptic('ok'); toast(`Цель достигнута: ${rewardText(step.reward)}`);
      save(); render();
      if (!$('#modal').classList.contains('hidden')) showProfile();
    },
    'biz-buy': id => {
      const d = BIZ[id];
      if (S.biz[id] || !bizOpen(d)) return;
      const lic = licenseCost(d), bribe = Math.round(lic / BRIBE_DIVISOR), risk = bribeRisk('license');
      showModal(`<h3>${d.icon} ${d.name}</h3>
        <p>Помещение и запуск: <b>${fmt(d.price)} ₽</b>. Осталось оформить лицензии и разрешения.</p>
        <div class="choice">
          <button class="btn" data-action="biz-buy-go" data-id="${id}:official">Официально · ${fmt(d.price + lic)} ₽<span class="btn-top">дорого, зато чисто</span></button>
          <button class="btn btn-line" data-action="biz-buy-go" data-id="${id}:bribe">«Договориться» · ${fmt(d.price + bribe)} ₽<span class="btn-top">риск ${risk}% — штраф ${fmt(lic * BRIBE_FINE)} ₽</span></button>
          <button class="btn btn-ghost" data-action="close">Отмена</button></div>`);
    },
    'biz-buy-go': key => {
      const [id, how] = key.split(':'), d = BIZ[id];
      if (S.biz[id] || !bizOpen(d)) return;
      const lic = licenseCost(d);
      if (!pay(d.price + (how === 'bribe' ? Math.round(lic / BRIBE_DIVISOR) : lic))) return;
      closeModal();
      S.biz[id] = { m: d.start, w: d.start, mk: 0, mgr: false, inv: d.price };
      if (how === 'bribe' && Math.random() * 100 < bribeRisk('license')) {
        S.money = Math.max(0, S.money - lic * BRIBE_FINE);
        showModal(`<h3>🚨 Попался</h3><p>Взятку за лицензию заметили. Бизнес оформили, но пришлось заплатить штраф ${fmt(lic * BRIBE_FINE)} ₽.</p>
          <button class="btn full" data-action="close">Эх…</button>`);
        haptic('err');
      } else {
        haptic('ok'); toast(`${d.icon} Открыт бизнес: ${d.name}`);
      }
      save(); render();
    },
    'biz-machine': id => bizUp(id, () => {
      const b = S.biz[id], c = machineCost(id);
      if (b.m >= BIZ[id].slots || !pay(c)) return false;
      b.m++; b.inv += c;
    }),
    'biz-hire': id => bizUp(id, () => {
      const b = S.biz[id];
      if (b.w >= BIZ[id].slots || !pay(hireCost(id))) return false;
      b.w++;
    }),
    'biz-fire': id => { const b = S.biz[id]; if (!b || b.w <= 0) return; b.w--; haptic('light'); save(); render(); },
    'biz-mkt': id => bizUp(id, () => {
      const b = S.biz[id], c = mktCost(id);
      if (b.mk >= MKT_MAX || !pay(c)) return false;
      b.mk++; b.inv += c;
    }),
    'biz-mgr': id => {
      const b = S.biz[id];
      if (!b) return;
      if (b.mgr) { b.mgr = false; haptic('light'); save(); render(); return; }
      bizUp(id, () => { if (!pay(hireCost(id) * 2)) return false; b.mgr = true; });
    },
    'biz-sell': id => {
      const b = S.biz[id], d = BIZ[id];
      if (!b) return;
      askConfirm(`Продать «${d.name}» за ${fmt(b.inv * bizSellRate())} ₽?`, () => {
        earn(b.inv * bizSellRate());
        delete S.biz[id];
        haptic('medium'); toast(`Бизнес продан: ${d.name}`);
        save(); render();
      });
    },
    'event-show': () => showEvent(),
    'event-solve': how => solveEvent(how),
    conn: id => showConn(id),
    meet: key => {
      const [id, mid] = key.split(':'), m = MEET[mid], c = S.conn[id];
      if (!c || (c.cd[mid] || 0) > Date.now() || !pay(meetCost(id, m))) return;
      c.cd[mid] = Date.now() + m.cd;
      addXp(id, Math.round(m.xp * (1 + perk('trustUp') / 100)));
      progress('meet');
      haptic('light'); save(); render(); showConn(id);
    },
    special: id => {
      const it = ITEM[id];
      if (connLv(id) < CONN_MAX_LV || specialLeft(id)) return;
      const sp = it.special;
      if (sp.type === 'closeEvent') {
        if (!S.event || EV[S.event.id].good) return;
        toast(`${it.icon} ${it.name} закрыл вопрос «${EV[S.event.id].title}»`);
        S.event = null;
      } else if (sp.type === 'taxHoliday') {
        S.taxFreeUntil = Date.now() + sp.hours * 3600e3;
        toast(`${it.icon} Налоговые каникулы на ${sp.hours} ч`);
      } else {
        const v = specialAmount(it);
        earn(v);
        toast(`${it.icon} +${fmt(v)} ₽`);
      }
      S.conn[id].sp = Date.now();
      S.conn[id].last = Date.now();
      haptic('ok'); save(); render(); showConn(id);
    },
    'favor-yes': () => {
      const fv = S.favor;
      if (!fv) return;
      const f = FAVOR[fv.id];
      if (!pay(favorCost(f))) return;
      S.favor = null;
      addXp(fv.conn, f.xp);
      progress('favor');
      haptic('ok'); toast(`${ITEM[fv.conn].icon} ${short(ITEM[fv.conn].name)} запомнит это: +${f.xp} доверия`);
      save(); render();
    },
    'favor-no': () => {
      const fv = S.favor;
      if (!fv) return;
      const c = S.conn[fv.conn];
      if (c) c.xp = Math.max(CONN_XP[connLv(fv.conn) - 1], c.xp - FAVOR_FAIL_XP);
      S.favor = null;
      haptic('light'); toast('Отказал. Доверие немного упало');
      save(); render();
    },
    deal: () => {
      const v = dealMax();
      if (!perk('deal') || S.deal || S.dealDay === dayKey(new Date()) || v <= 0 || !pay(v)) return;
      S.deal = { amount: v, ret: Math.round(v * (1 + perk('deal') / 100)), until: Date.now() + DEAL_HOURS * 3600e3 };
      S.dealDay = dayKey(new Date());
      haptic('ok'); toast(`Вложено ${fmt(v)} ₽`); save(); render();
    },
    'deal-claim': () => {
      if (!S.deal || Date.now() < S.deal.until) return;
      const r = S.deal.ret;
      S.deal = null;
      earn(r);
      haptic('ok'); toast(`Сделка закрыта: +${fmt(r)} ₽`); save(); render();
    },
    'dbg-event': id => { if (!DEBUG || !eventOk(EV[id])) return; S.event = null; closeModal(); startEvent(EV[id]); },
    'dbg-money': v => { if (!DEBUG) return; S.money += +v; save(); render(); showProfile(); toast(`+${fmt(+v)} ₽`); },
    'dbg-favor': () => {
      if (!DEBUG) return;
      if (!Object.keys(S.conn).length) { toast('Сначала нужна хотя бы одна связь'); return; }
      S.favor = null; S.nextFavor = 0; maybeFavor(); closeModal(); tab = 'conn'; render();
    },
    'dbg-free': () => {
      if (!DEBUG) return;
      S.cd = {}; S.study = { left: STUDY_BATCH, until: 0 }; if (S.gig) S.gig.until = 0;
      for (const c of Object.values(S.conn)) { c.cd = {}; c.sp = 0; }
      save(); render(); showProfile(); toast('Таймеры сброшены');
    },
    promo: () => redeem(($('#promo-input') || {}).value),
    'dbg-hash': async () => {
      if (!DEBUG) return;
      const code = normCode(($('#dbg-code') || {}).value || '');
      if (!code) { toast('Введи код'); return; }
      const h = await sha256(code);
      $('#dbg-hash-out').textContent = `{ hash: '${h}', label: '${code}', reward: { money: 1e6 } },`;
    },
    credits: () => showModal(`${sheetHead('Авторы фото')}
      <p class="small">Фотографии с Wikimedia Commons: фон удалён, размер уменьшен.</p>
      ${ITEMS.concat(CASES).filter(i => i.credit).map(i => `<div class="kv small"><span>${i.name}</span><b>${i.credit}</b></div>`).join('')}`, true),
    reset: () => askConfirm('Точно начать заново? Весь прогресс пропадёт.', () => {
      S = newState(); ensureQuests(); save(); tab = 'home'; closeModal(); render();
    }),
  };

  document.addEventListener('click', e => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const t = e.target.closest('[data-tab],[data-goto],[data-action],[data-sub]');
    if (!t || t.disabled) return;
    if (t.dataset.action) { ACTIONS[t.dataset.action](t.dataset.id, t); return; }
    if (t.dataset.sub) { const [k, v] = t.dataset.sub.split(':'); sub[k] = v; }
    if (t.dataset.tab || t.dataset.goto) {
      tab = t.dataset.tab || t.dataset.goto;
      haptic('light');
      window.scrollTo(0, 0);
    }
    render();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'promo-input') redeem(e.target.value);
  });
  document.addEventListener('change', e => {
    const key = e.target.dataset.toggle;
    if (!key) return;
    S[key] = e.target.checked;
    haptic('light');
    save();
  });

  // ---------- старт ----------
  if (tg) {
    tg.ready();
    tg.expand();
    if (inTelegram) {
      tg.setHeaderColor && tg.setHeaderColor('#111214');
      tg.setBackgroundColor && tg.setBackgroundColor('#111214');
      tg.disableVerticalSwipes && tg.disableVerticalSwipes();
    }
  }
  const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  const name = (user && user.first_name) || 'Игрок';
  function showName() { $('#pname').innerHTML = `${name.replace(/[<>&]/g, '')} ${badgeIcons()}`; }
  showName();
  $('#ava').textContent = name[0].toUpperCase();

  const away = (Date.now() - S.lastTick) / 1000;
  const first = catchUp();
  ensureQuests();
  render();
  if (S.event) showEvent();
  else maybeEvent();
  if (away > 60 && first.earned >= 1 && !S.event) showOffline(first);

  setInterval(tick, 1000);
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else tick(); });
  window.addEventListener('pagehide', save);
})();
