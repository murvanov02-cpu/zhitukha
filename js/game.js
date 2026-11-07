'use strict';
(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');

  const SAVE_KEY = 'zhitukha_save_v2';
  const OLD_SAVE_KEY = 'zhitukha_save_v1';
  const ECO = 2;          // версия экономики: 2 — реальные цены
  const ECO_SCALE = 500;  // во сколько раз выросли деньги при переходе на реальные цены
  const OFFLINE_CAP_H = 6;       // сколько реальных часов копится доход, пока игрок не в игре
  const OFFLINE_RATE = 0.5;      // без игрока доход идёт вполовину — играть выгоднее, чем просто заходить
  const OFFLINE_AFTER_S = 60;    // перерыв дольше этого — уже «вне игры»
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
      inv: {}, got: {}, bizV: 61, p97: {}, car: null, job: 'flyers',
      lastTick: Date.now(), cd: {}, opened: 0,  // cd: id кейса → когда открыт бесплатно
      pity: 0, fast: false, autoSell: false,
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
      garage: {},                 // гонки: id машины → { tank: делений, ts: с какого момента копится, wear: износ %, broken }
      raceCar: null, pool: { n: RACE_POOL, ts: Date.now() }, raceWins: 0,
      plates: [], plateSeq: 0,    // номера: { id, a, d, b, r: регион, rar, v: стоимость, car: на какой машине }
      plateReg: 'msk',            // выбранный регион в наборах номеров
      conn2: true,                // доверие уже по новым порогам
      coll: {},                   // полученные награды коллекций: id → true
      tut: 0,                     // шаг обучения (-1 — пройдено или пропущено)
      incHour: false,             // доход в шапке: false — в игровой месяц, true — в реальный час
      msgSeen: [],                // какие личные сообщения уже показаны
      news: UPDATE_NOTES.id,      // (старое) последнее окно «Что нового»
      newsSeen: UPDATE_NOTES.items.map(i => i[3]),   // какие новости уже показаны: каждая — один раз; новичкам старые не показываем
      lastReport: 0,              // когда последний раз отправляли данные в таблицу учёта
      pid: '',                    // личный ID игрока: выдаётся сам, случайный, не меняется даже при «Начать заново"
      tune2: true,                // тюнинг уже по новым ценам (см. upgrade)
      lvl: 1, xp: 0,              // уровень игрока и опыт внутри уровня
      sil: null,                  // служба: { s: структура, r: звание, xp, since, roofs: [id бизнесов], mission, nextMission, nextCheck, osb }
      jailed: 0,                  // сколько раз сидел
      rep: 0,                     // репутация (−100 взяточник … +100 честный), не сгорает при увольнении
      silBan: 0,                  // до какого момента нельзя снова поступить на службу
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
    const n = newState();
    n.pid = makePid();
    return n;
  }
  // Личный ID: ZH- и 6 случайных символов (без похожих O/0, I/1). Выдаётся автоматически при первом запуске.
  function makePid() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6);
    (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.random() * 256; });
    return 'ZH-' + Array.from(b, x => A[x % A.length]).join('');
  }
  // Приводит сохранение любой прошлой версии к нынешней
  function upgrade(o) {
    const s = Object.assign(newState(), o);
    s.skills = Object.assign(newState().skills, s.skills);
    if (o.lastFree) s.cd.free = o.lastFree;
    // связи раньше хранились как уровень 1–3
    for (const [id, v] of Object.entries(s.conn)) {
      if (!ITEM[id]) delete s.conn[id];
      else if (typeof v === 'number') s.conn[id] = newConn(cxp(id, Math.min(v, CONN_MAX_LV) - 1));
    }
    if (s.job && !JOB[s.job]) s.job = 'flyers';
    if (s.event && !EV[s.event.id]) s.event = null;
    // бизнес раньше хранил станки, сотрудников и рекламу отдельно — переводим в места + клиентов
    for (const [id, b] of Object.entries(s.biz)) {
      if (!BIZ[id]) { delete s.biz[id]; continue; }
      if (b.slots === undefined) {
        const d = BIZ[id], slots = Math.max(d.s0, Math.min(d.sMax, Math.min(b.m || 0, b.w || 0)));
        s.biz[id] = { slots, ads: slots - d.s0, mgr: !!b.mgr, inv: b.inv || d.price };
      }
    }
    if (!s.pool) s.pool = { n: RACE_POOL, ts: Date.now() };
    if (s.sil && s.sil.rep === undefined) { s.sil.rep = 0; s.sil.nextCheck = 0; }
    if (s.sil && s.sil.rep !== undefined && o.rep === undefined) s.rep = s.sil.rep;   // v30: репутация стала общей
    if (s.sil && !s.sil.rankAt) s.sil.rankAt = s.sil.since;
    // v49: у каждого спецзадания свой откат; штурм старого образца (с таймером) отменяем
    if (!o.got) { s.got = {}; for (const k of Object.keys(s.inv || {})) s.got[k] = 1; for (const k of Object.keys(s.conn || {})) s.got[k] = 1; }   // v53: галочка в кейсе = когда-либо выпадало
    if (!Array.isArray(o.newsSeen)) {   // v58: новости считаются по одной — то, что игрок уже видел в окнах v55–v58, не повторяем
      const had = { v55: ['roofs', 'bizcap', 'equal', 'misc'], v56: ['roofs', 'bizcap', 'housing', 'equal', 'misc'], v58: ['roofs', 'bizcap', 'housing', 'equal', 'misc', 'chase', 'raid', 'bizrank'] }[o.news] || [];
      s.newsSeen = o.news === undefined ? [] : had;
    }
    // v61: у каждого бизнеса своё число мест и новые цены — лишние места срезаем, переплату против новых цен возвращаем деньгами
    if (!o.bizV || o.bizV < 61) {
      for (const [id, b] of Object.entries(s.biz)) {
        const d = BIZ[id];
        if (!d) continue;
        b.slots = Math.min(Math.max(b.slots || d.s0, d.s0), d.sMax);
        b.ads = Math.min(b.ads || 0, d.sMax - d.s0);
        let inv = d.price;
        for (let k = 0; k < b.slots - d.s0; k++) inv += d.eco * BIZ_SLOT_COST * Math.pow(BIZ_GROWTH, k);
        for (let k = 0; k < b.ads; k++) inv += d.eco * BIZ_AD_COST * Math.pow(BIZ_GROWTH, k);
        inv = Math.round(inv);
        if ((b.inv || 0) > inv) s.money += b.inv - inv;
        b.inv = inv;
      }
      s.bizV = 61;
    }
    // v65: свой госномер 97 — один раз за игру в каждом ведомстве. Уже выкупленный 97-й засчитываем по серии и даём ему цену коллекционера
    if (!o.p97) {
      s.p97 = {};
      const bySer = { 'АМР': 'mvd', 'ЕКХ': 'fsb', 'РМР': 'spn' };
      for (const p of s.plates || []) {
        const st = bySer[(p.a || '') + (p.b || '')];
        if (p.svc || p.r !== '97' || !st || s.p97[st]) continue;
        s.p97[st] = true;
        p.collect = Math.round((PLATE_97_COLLECT[0] + Math.random() * (PLATE_97_COLLECT[1] - PLATE_97_COLLECT[0])) / 1e6) * 1e6;
      }
      // номер 97 на нынешней служебной генерала — в серию своего ведомства и с ценой коллекционера
      const st = s.sil && STRUCTURES.find(x => x.id === s.sil.s);
      for (const p of s.plates || []) if (st && p.svc && p.r === '97' && !s.p97[st.id]) {
        p.a = st.series[0]; p.b = st.series.slice(1);
        p.collect = Math.round((PLATE_97_COLLECT[0] + Math.random() * (PLATE_97_COLLECT[1] - PLATE_97_COLLECT[0])) / 1e6) * 1e6;
      }
    }
    if (o.tut === -1 && o.tutPaid === undefined) s.tutPaid = true;   // подарок за обучение — один раз, даже если пройти заново
    if (s.sil && s.sil.spec && ((s.sil.spec.t === 'raid' && s.sil.spec.v !== 3) || (s.sil.spec.t === 'court' && s.sil.spec.v !== 2))) s.sil.spec = null;   // v68: штурм и суд переделаны
    if (o.news === undefined) s.news = '';   // старым игрокам — показать «Что нового»
    // v51: мусорные иномарки убраны из игры — возвращаем их рыночную цену; билеты «Битых тачек» — в «Гаражный кооператив»
    for (const id of ['c_matiz', 'c_lanos']) {
      if (!s.inv || !s.inv[id]) continue;
      s.money += { c_matiz: 250e3, c_lanos: 300e3 }[id] * s.inv[id];
      delete s.inv[id]; if (s.garage) delete s.garage[id];
      for (const p of s.plates || []) if (p.car === id) p.car = null;
      if (s.car === id) s.car = null;
      if (s.raceCar === id) s.raceCar = null;
    }
    // v52: «Битые тачки» и «Гаражный кооператив» ушли в «Авторынок и гаражи», «Уличные гонщики» — в «Автосалон»
    for (const [from, to] of [['car_junk', 'car_used'], ['car_garage', 'car_used'], ['car_street', 'car_new']])
      if (s.tickets && s.tickets[from]) { s.tickets[to] = (s.tickets[to] || 0) + s.tickets[from]; delete s.tickets[from]; }
    // v50: «списал — жди нового звания» заменено автобазой: новая служебная через SVC_REISSUE_H ч
    if (s.sil && s.sil.wroteOff) { s.sil.reissueAt = Date.now() + SVC_REISSUE_H * 3600e3; delete s.sil.wroteOff; }
    if (s.sil && !s.sil.specCd) { s.sil.specCd = {}; delete s.sil.nextSpec; delete s.sil.specType; }
    if (s.sil && s.sil.spec && s.sil.spec.t === 'raid' && s.sil.spec.v !== 2) s.sil.spec = null;
    if (s.lvl > LEVEL_MAX) { s.lvl = LEVEL_MAX; s.xp = 0; }
    // v41: перерыв после увольнения стал 20 минут — старые «сутки» сокращаем (бан после суда, он дольше суток, не трогаем)
    const banLeft = (s.silBan || 0) - Date.now();
    if (banLeft > SERVICE_COOLDOWN_H * 3600e3 && banLeft <= 24 * 3600e3) s.silBan = Date.now() + SERVICE_COOLDOWN_H * 3600e3;
    // v31: пороги доверия выросли — пересчитываем, сохраняя уровень и долю до следующего
    if (!o.conn2) {
      const OLD = [0, 100, 250, 500, 1000];
      for (const [id, c] of Object.entries(s.conn)) {
        if (!ITEM[id] || typeof c !== 'object') continue;
        let lv = 1;
        while (lv < 5 && c.xp >= OLD[lv]) lv++;
        const frac = lv >= 5 ? 0 : (c.xp - OLD[lv - 1]) / (OLD[lv] - OLD[lv - 1]);
        c.xp = cxp(id, lv - 1) + (lv >= 5 ? 0 : frac * (cxp(id, lv) - cxp(id, lv - 1)));
      }
      s.conn2 = true;
    }
    // v31: управляющий стал выбором из пяти; старый «просто управляющий» — это «Управляющий»
    for (const b of Object.values(s.biz)) if (b.mgr === true) b.mgr = 3; else if (!b.mgr) b.mgr = 0;
    if (o.tut === undefined) s.tut = -1;   // старые игроки обучение не проходят
    if (!s.pid) s.pid = makePid();
    // v25: уровни появились позже — засчитываем прошлые кейсы, победы и курсы (без наград за уровни)
    if (o.lvl === undefined) {
      let xp = (o.opened || 0) * XP_CASE.cheap + (o.raceWins || 0) * RACE_LEVELS[1].xp * 2
        + Object.values(s.skills).reduce((a, b) => a + b, 0) * XP_FOR.skill;
      s.lvl = 1;
      while (s.lvl < LEVEL_MAX && xp >= levelNeed(s.lvl)) { xp -= levelNeed(s.lvl); s.lvl++; }
      s.xp = xp;
    }
    // v18: тюнинг подешевел в 2,5 раза — возвращаем переплату тем, кто тюнинговал раньше
    if (!o.tune2) {
      for (const g of Object.values(s.garage)) if (g.tuneInv) { s.money += g.tuneInv * 0.6; g.tuneInv *= 0.4; }
      s.tune2 = true;
    }
    for (const g of Object.values(s.garage)) if (g.tank === undefined) { g.tank = TANK_RACES; g.ts = Date.now(); delete g.fuel; delete g.ft; }
    for (const k of ['rel', 'love', 'pref', 'course', 'lastFree', 'energy', 'taps', 'study', 'raceDay', 'races']) delete s[k];
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
    S.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ }
    cloudSaveSoon();
  }

  // ---------- синхронизация между устройствами (облако Telegram) ----------
  // CloudStorage привязан к аккаунту Telegram и боту: тот же прогресс на телефоне и компьютере.
  // Значение ключа — до 4096 символов, поэтому сохранение режется на куски s0, s1, … и мета-ключ meta = { n, at }.
  const cloud = tg && tg.CloudStorage && inTelegram ? tg.CloudStorage : null;
  const CHUNK = 4000;
  let cloudTimer = 0;
  function cloudSaveSoon(now) {
    if (!cloud) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudSave, now ? 0 : 15000);
  }
  function cloudSave() {
    const data = JSON.stringify(S), n = Math.ceil(data.length / CHUNK);
    let left = n;
    for (let i = 0; i < n; i++) {
      cloud.setItem('s' + i, data.slice(i * CHUNK, (i + 1) * CHUNK), () => {
        if (--left === 0) cloud.setItem('meta', JSON.stringify({ n, at: S.savedAt }));
      });
    }
  }
  // При запуске: если в облаке сохранение новее локального — берём его
  function cloudLoad() {
    if (!cloud) return;
    cloud.getItem('meta', (err, raw) => {
      if (err || !raw) { cloudSaveSoon(true); return; }
      let meta; try { meta = JSON.parse(raw); } catch (e) { return; }
      if (!meta.n || meta.at <= (S.savedAt || 0)) { if (meta.at < (S.savedAt || 0)) cloudSaveSoon(true); return; }
      cloud.getItems(Array.from({ length: meta.n }, (_, i) => 's' + i), (e2, vals) => {
        if (e2 || !vals) return;
        try {
          const o = JSON.parse(Array.from({ length: meta.n }, (_, i) => vals['s' + i] || '').join(''));
          S = upgrade(o);
          catchUp(); ensureQuests();
          try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ничего */ }
          closeModal(); render();
          toast('Прогресс загружен с другого устройства');
        } catch (e) { /* битые данные в облаке — оставляем локальное */ }
      });
    });
  }

  let S = load();
  // Заблокированный ID (список BANNED_IDS в data.js): экран-заглушка поверх игры
  if (BANNED_IDS.includes(S.pid)) {
    const ban = document.createElement('div');
    ban.style.cssText = 'position:fixed;inset:0;z-index:999;background:#0f1012;color:#eee;display:grid;place-items:center;text-align:center;padding:24px;font:16px system-ui';
    ban.innerHTML = `<div><div style="font-size:48px">⛔</div><h3>Доступ закрыт</h3><p style="color:#9aa0a6">Этот аккаунт заблокирован.<br>Твой ID: ${S.pid}</p></div>`;
    document.body.appendChild(ban);
  }
  let tab = 'home';
  const sub = { cases: 'car', career: 'jobs', inv: 'car', casino: 'roulette' };
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
  const hoursText = h => (h < 1 ? `${Math.max(1, Math.round(h * 60))} мин` : `${String(+h.toFixed(1)).replace('.', ',')} ч`);
  const visual = it => (it.img ? `<img class="pic${it.cat === 'home' ? ' cover' : ''}" src="${it.img}" alt="" loading="lazy">` : it.icon);
  const rStyle = r => `--rc:${RARITIES[r].color};--rbg:${RARITIES[r].bg}`;
  const short = name => name.split(',')[0];

  // ---------- статус ----------
  function netWorth() {
    let v = S.money;
    for (const [id, n] of Object.entries(S.inv)) if (ITEM[id]) v += ITEM[id].value * (n - (isSvcCar(id) ? 1 : 0));
    for (const [id, g] of Object.entries(S.garage)) if (S.inv[id] && g.tuneInv) v += g.tuneInv * TUNE_SELL_RATE;
    for (const p of S.plates) if (!p.svc) v += p.v;
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
  // Порог доверия для уровня (индекс 0…4) у конкретной связи — у влиятельных выше
  function cxp(id, i) { return Math.round(CONN_XP[i] * (CONN_RARITY_XP[ITEM[id].rarity] || 1)); }
  function connLv(id) {
    const c = S.conn[id];
    if (!c) return 0;
    let lv = 1;
    while (lv < CONN_MAX_LV && c.xp >= cxp(id, lv)) lv++;
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
    if (S.sil && name === 'fineCut' && STR().fineCut) v = Math.max(v, STR().fineCut);
    if (S.sil) for (let r = 0; r <= S.sil.r; r++) if (SERVICE_RANKS[r].perk === name) v = Math.max(v, SERVICE_RANKS[r].v);
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
  const licenseCost = d => Math.round(d.price * BIZ_LICENSE * (1 - perk('licenseCut') / 100));

  // ---------- экономика ----------
  const carBonus = () => (S.car && S.inv[S.car] ? ITEM[S.car].bonus : 0);
  function jobPay() {
    if (S.sil) return servicePay();
    const j = JOB[S.job];
    if (!j || (j.needCar && !carBonus())) return 0;
    return j.pay * (1 + carBonus() / 100) * (1 + S.skills.int * 0.01);
  }
  function rent() {
    let r = 0;
    for (const [id, n] of Object.entries(S.inv)) {
      const it = ITEM[id];
      if (it && it.cat === 'home') r += it.bonus;   // каждое жильё сдаётся один раз: копии не складываются
    }
    return r * (1 + S.skills.biz * 0.01 + perk('rentUp') / 100);
  }

  const frozen = id => !!(S.event && EV[S.event.id].freeze && S.event.biz === id);
  // Происшествие в бизнесе: freeze — выручки нет, cut — вдвое меньше; «закрыт на N часов» — тоже без выручки
  const INC = Object.fromEntries(BIZ_INCIDENTS.map(x => [x.id, x]));
  const bizShut = (id, b = S.biz[id]) => frozen(id) || !!(b && ((b.inc && INC[b.inc.id] && INC[b.inc.id].effect === 'freeze') || (b.closedUntil || 0) > Date.now()));
  const bizCut = b => (b && b.inc && INC[b.inc.id] && INC[b.inc.id].effect === 'cut' ? 0.5 : 0);
  // Без управляющего: занят на работе — мало времени на бизнес, уволился — почти всё под контролем
  const ownerEff = () => Math.min(1, (S.job || S.sil ? OWNER_EFF_EMPLOYED : OWNER_EFF_FREE) * (1 + perk('bizEff') / 100));
  // Денежные параметры бизнеса — доли его цены (см. data.js)
  const bizNum = d => ({ rev: d.eco * BIZ_REV, salary: d.eco * BIZ_SALARY, rent: d.eco * BIZ_RENT,
    mgr: d.eco * BIZ_MGR, license: d.price * BIZ_LICENSE });
  // b — состояние бизнеса (можно передать «а что если» для подсказок на кнопках)
  function bizStats(id, b = S.biz[id]) {
    const d = BIZ[id], n = bizNum(d);
    const cap = b.slots * d.perSlot;
    const demand = Math.round((d.s0 + b.ads) * d.perSlot * (1 + perk('demandUp') / 100));
    const sold = Math.min(cap, demand);
    const M = MANAGERS[b.mgr - 1];
    const eff = M ? M.eff : ownerEff();
    const nephew = (b.nephew || 0) > Date.now() ? FAVOR.f_nephew.drag : null;
    const revenue = bizShut(id, b) ? 0 : sold / d.perSlot * n.rev * eff * (1 + perk('bizBoost') / 100) * (nephew ? 1 - nephew.revCut : 1) * (1 - bizCut(b));
    const wages = (b.slots + (nephew ? nephew.wages : 0)) * n.salary, mgr = M ? d.eco * M.salary : 0;
    const pre = revenue - wages - n.rent - mgr;
    const tax = pre > 0 ? pre * taxRate() : 0;
    const neck = cap < demand ? 'slots' : cap > demand ? 'ads' : '';
    return { cap, demand, sold, eff, revenue, wages, mgr, rent: n.rent, tax, profit: pre - tax, neck };
  }
  const bizProfit = () => Object.keys(S.biz).reduce((a, id) => a + (BIZ[id] ? bizStats(id).profit : 0), 0);
  const slotCost = id => Math.round(BIZ[id].eco * BIZ_SLOT_COST * Math.pow(BIZ_GROWTH, S.biz[id].slots - BIZ[id].s0));
  const adCost = id => Math.round(BIZ[id].eco * BIZ_AD_COST * Math.pow(BIZ_GROWTH, S.biz[id].ads));
  const mgrSalary = (id, t) => BIZ[id].eco * MANAGERS[t - 1].salary;
  const mgrHire = (id, t) => Math.round(mgrSalary(id, t) * MANAGERS[t - 1].hire / 1000) * 1000;
  // Насколько изменится прибыль, если поменять состояние бизнеса
  const bizDelta = (id, change) => {   // считаем без происшествий и закрытия: сколько даст прокачка, когда бизнес работает
    const base = Object.assign({}, S.biz[id], { inc: null, closedUntil: 0 });
    return bizStats(id, Object.assign({}, base, change)).profit - bizStats(id, base).profit;
  };
  function bizOpen(d) {
    if (rankIdx() < d.rank) return false;
    if (S.sil && (S.sil.r >= SERVICE_BIZ_UNTIL || !smallBiz(d.id))) return false;
    for (const [k, v] of Object.entries(d.req)) if (S.skills[k] < v) return false;
    return true;
  }

  // Внутри всё считается в «игровых месяцах» (так записаны зарплаты в data.js), а игроку показываем
  // реальные деньги в реальный час: ph() переводит «в месяц» в «в час» (за час проходит MONTHS_PER_HOUR месяцев).
  const ph = v => v * MONTHS_PER_HOUR;
  const incomeMonth = () => jobPay() + rent() + bizProfit() + roofIncome();
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
    const rate = sec > OFFLINE_AFTER_S ? OFFLINE_RATE : 1;
    const earned = incomeMonth() * MONTHS_PER_HOUR * sec / 3600 * rate;
    if (earned >= 0) earn(earned, 'work');
    else S.money = Math.max(0, S.money + earned);  // бизнес в минусе — убыток, но не ниже нуля
    // доверие тает, если долго не общаться (уровень не падает)
    for (const [id, c] of Object.entries(S.conn)) {
      if (now - c.last < DECAY_AFTER_H * 3600e3) continue;
      const floor = cxp(id, connLv(id) - 1);
      c.xp = Math.max(floor, c.xp - DECAY_XP_PER_DAY * sec / 86400);
    }
    return { sec, earned };
  }
  function tick() {
    const away = (Date.now() - S.lastTick) / 1000;
    const r = catchUp();
    ensureQuests();
    maybeEvent();
    maybeBizInc();
    maybeFavor();
    maybeOsb();
    maybeMessage();
    maybeReissue();
    if (away > 60 && r.earned >= 1) showOffline(r);
    updateLive();
  }

  // ---------- учёба ----------
  const skillPrice = lvl => Math.round(skillCost(lvl) * (1 - perk('skillCheap') / 100));

  // ---------- задания ----------
  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function weekStart(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }
  const questOk = q => !q.need || ({ conn: Object.keys(S.conn).length > 0, biz: Object.keys(S.biz).length > 0, car: countCat('car') > 0,
    civil: !S.sil, sil: !!S.sil })[q.need];
  function pickQuests(pool, k) {
    const avail = pool.filter(questOk).sort(() => Math.random() - 0.5);
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
    // Положение изменилось (служба, бизнес, связи) — невыполнимые задания заменяем другими, с нуля
    for (const [set, pool] of [[S.daily, DAILY_QUESTS], [S.weekly, WEEKLY_QUESTS]]) {
      set.list.forEach((q, i) => {
        if (q.claimed || questOk(QDEF[q.id])) return;
        const alt = pickQuests(pool.filter(d => !set.list.some(x => x.id === d.id)), 1)[0];
        if (alt) { set.list[i] = alt; changed = true; }
      });
    }
    return changed;
  }
  function progress(ev, n = 1) {
    if (XP_FOR[ev]) gainXP(XP_FOR[ev] * (ev === 'open' ? n : 1));
    for (const set of [S.daily, S.weekly]) {
      if (!set) continue;
      for (const q of set.list) if (QDEF[q.id].ev === ev && q.prog < q.target) q.prog = Math.min(q.target, q.prog + n);
    }
  }
  const allClaimed = set => set.list.every(q => q.claimed);
  const giveTicket = id => { S.tickets[id] = (S.tickets[id] || 0) + 1; };
  const ticketName = id => `билет «${CASE[id].name}»`;

  // ---------- жизненный путь ----------
  // У силовика шаги про работу и бизнес читаются как служба и «крыша»
  function lifeText(step) {
    if (!S.sil) return step.text;
    if (step.type === 'job') return `Довольствие от ${fmt(ph(step.v))} ₽/ч`;
    if (step.type === 'biz') return step.v > 1 ? `Держи ${step.v} бизнеса под «крышей»` : 'Возьми бизнес под «крышу»';
    if (step.type === 'bizProfit') return `«Крыша» от ${fmt(ph(step.v))} ₽/ч`;
    return step.text;
  }
  function lifeDone(step) {
    switch (step.type) {
      case 'job': return S.sil ? servicePay() >= step.v : !!JOB[S.job] && JOB[S.job].pay >= step.v;
      case 'car': return countCat('car') > 0;
      case 'skills': return Object.values(S.skills).reduce((a, b) => a + b, 0) >= step.v;
      case 'home': return countCat('home') >= step.v;
      case 'rank': return rankIdx() >= step.v;
      case 'carRarity': return Object.keys(S.inv).some(id => ITEM[id] && ITEM[id].cat === 'car' && !ITEM[id].svc && rarIdx(ITEM[id].rarity) >= step.v);
      case 'biz': return (S.sil ? S.sil.roofs.length : Object.keys(S.biz).length) >= step.v;
      case 'bizProfit': return (S.sil ? roofIncome() : bizProfit()) >= step.v;
      case 'conn': return Object.keys(S.conn).length >= step.v;
      case 'raceWins': return S.raceWins >= step.v;
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
    if (e.old) return false;   // бизнес-проверки теперь у каждого бизнеса свои (BIZ_INCIDENTS)
    const has = { car: !!carBonus(), home: countCat('home') > 0, biz: Object.keys(S.biz).length > 0, sil: !!S.sil, civil: !S.sil };
    if (e.need && !has[e.need]) return false;
    if (e.id === 'e_gibdd' && (S.car && isGov(S.car) || S.sil && S.sil.r >= STR().gibdd)) return false;
    if (e.need === 'car' && !e.good && S.sil && S.sil.r >= SERVICE_NO_RACE && svcCar()) return false;
    if (e.minRank && (e.need === 'sil' ? S.sil.r : rankIdx()) < e.minRank) return false;
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
      ? { id: e.id, biz, reward: Math.round(Math.max(EVENT_REWARD_MIN, (biz ? Math.max(bizStats(biz).profit, incomeMonth() / 3) : incomeMonth()) * e.reward) / 1000) * 1000 }
      : { id: e.id, biz, cost: eventCost(e, biz) };
    save();
    render();
    showEvent();
  }
  const evText = ev => EV[ev.id].text.replace('{biz}', ev.biz ? BIZ[ev.biz].name : 'бизнес');
  // Кто решает событие бесплатно: профессия или связь
  const callChance = id => Math.min(100, CALL_CHANCE[connLv(id) - 1] + perk('callUp'));
  function evHelper(e) {
    const j = JOB[S.job];
    if (j && (j.solves || []).includes(e.id)) return { kind: 'job', label: `Ты же ${j.name.toLowerCase()} — решишь сам` };
    if (e.via && S.conn[e.via]) return { kind: 'conn', label: `Позвонить: ${ITEM[e.via].name}`, chance: callChance(e.via) };
    return null;
  }
  // Управляющий бизнеса, которого коснулась проблема, может решить её сам
  const evMgr = ev => { const b = ev.biz && S.biz[ev.biz], M = b && MANAGERS[b.mgr - 1]; return M && M.solve ? M : null; };
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
        ${via && ev.callFailed ? `<button class="btn btn-danger" disabled>📵 ${ITEM[e.via].name} не помог<span class="btn-top">звонок не сработал — решай сам</span></button>`
          : via ? `<button class="btn btn-green" data-action="event-solve" data-id="via">${via.label}<span class="btn-top">${via.kind === 'job' || via.chance >= 100 ? 'бесплатно и без риска' : `бесплатно · шанс ${via.chance}%, иначе — официально`}</span></button>` : ''}
        ${evMgr(ev) ? (ev.mgrFailed ? `<button class="btn btn-danger" disabled>${evMgr(ev).icon} ${evMgr(ev).name} не справился<span class="btn-top">решай сам</span></button>`
          : `<button class="btn btn-line" data-action="event-solve" data-id="mgr">Поручить: ${evMgr(ev).name}<span class="btn-top">бесплатно · шанс ${evMgr(ev).solve}%</span></button>`) : ''}
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
    else if (how === 'mgr') {
      const M = evMgr(ev);
      if (!M || ev.mgrFailed) return;
      if (Math.random() * 100 >= M.solve) { ev.mgrFailed = true; haptic('err'); save(); showEvent(); return; }
      msg = `${M.name} всё уладил`;
    }
    else if (how === 'via') {
      const h = evHelper(e);
      if (!h || ev.callFailed) return;
      if (h.kind === 'conn' && Math.random() * 100 >= h.chance) {
        // связь не помогла: платим официально, а если не хватает — вопрос остаётся открытым
        ev.callFailed = true;
        haptic('err');
        if (S.money >= ev.cost) {
          S.money -= ev.cost;
          S.event = null;
          save(); render();
          showModal(`<div class="drop"><div class="call-fail">📵</div><div class="drop-name bad">Не получилось</div>
            <p style="margin-top:8px">${ITEM[e.via].name} не смог помочь — пришлось решать официально.</p>
            <div class="big bad">−${fmt(ev.cost)} ₽</div>
            <p class="small muted">Чем выше доверие, тем чаще звонок срабатывает: от ${CALL_CHANCE[0]}% до ${CALL_CHANCE[CALL_CHANCE.length - 1]}%.</p>
            <button class="btn full" data-action="close">Понятно</button></div>`);
        } else { save(); showEvent(); }
        return;
      }
      msg = h.kind === 'job' ? 'Решил своими полномочиями' : 'Решено по-дружески';
    }
    else if (how === 'official') { if (!pay(ev.cost)) return; msg = 'Оплачено официально'; }
    else if (how === 'bribe') {
      if (!pay(Math.round(ev.cost / BRIBE_DIVISOR))) return;
      repAdd(-5);
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

  // ---------- происшествия в бизнесе ----------
  // Деньги — в часах прибыли этого бизнеса (не меньше, чем на старте), с надбавкой за нарушения в деле
  function incBase(id) {
    const b = S.biz[id], d = BIZ[id];
    const now = bizStats(id, Object.assign({}, b, { inc: null, closedUntil: 0 })).profit;
    return Math.max(now, bizStats(id, { slots: d.s0, ads: 0, mgr: 3 }).profit);
  }
  const incCost = (id, h) => Math.round(h * ph(incBase(id)) * (1 + BIZ_STRIKE_FINE * (S.biz[id].strikes || 0)) / 1000) * 1000;
  const incChance = o => Math.min(95, o.chance + (perk('court') ? 20 : 0));
  const incStrike = b => { b.strikes = Math.min(BIZ_STRIKE_MAX, (b.strikes || 0) + 1); b.strikeAt = Date.now(); };
  function incNext(id) {
    const b = S.biz[id], [a, z] = BIZ_INC_EVERY_H;
    const h = (a + Math.random() * (z - a)) / (1 + b.slots / BIZ_INC_SLOTS) / (1 + BIZ_STRIKE_FREQ * (b.strikes || 0));
    b.nextInc = Date.now() + h * 3600e3;
  }
  function maybeBizInc() {
    const now = Date.now();
    let shown = false;
    for (const id of Object.keys(S.biz)) {
      const b = S.biz[id], d = BIZ[id];
      if (!d) continue;
      if (!b.nextInc) { incNext(id); continue; }
      if (b.strikes && now - (b.strikeAt || 0) > BIZ_STRIKE_DECAY_H * 3600e3) { b.strikes--; b.strikeAt = now; }
      if (b.inc && b.inc.waitUntil && now >= b.inc.waitUntil) { b.inc = null; incNext(id); toast(`${d.icon} «${d.name}»: всё утихло, работаем как раньше`); continue; }
      if (b.inc || now < b.nextInc) continue;
      const pool = BIZ_INCIDENTS.filter(x => (!x.only || x.only.includes(id)) && (!x.big || d.sMax >= 10) && (b.strikes || 0) >= (x.strikes || 0) && x.id !== b.lastInc);
      incNext(id);
      if (!pool.length) continue;
      const x = pool[Math.floor(Math.random() * pool.length)], M = MANAGERS[b.mgr - 1];
      b.lastInc = x.id;
      if (M && M.solve && Math.random() * 100 < M.solve) { toast(`${M.icon} ${M.name} в «${d.name}» сам уладил: ${x.title.toLowerCase()}`); continue; }
      b.inc = { id: x.id, at: now };
      if (!shown && $('#modal').classList.contains('hidden')) { shown = true; showBizInc(id); }
    }
  }
  function incOptOk(id, o) {
    if (o.t === 'conn') return !!S.conn[o.conn];
    if (o.t === 'fire') return S.biz[id].slots > BIZ[id].s0;
    return true;
  }
  function showBizInc(id) {
    const b = S.biz[id], d = BIZ[id];
    if (!b || !b.inc) return;
    const x = INC[b.inc.id];
    const eff = b.inc.waitUntil ? `Ждём ещё <span data-timer="${b.inc.waitUntil}">${fmtTime(b.inc.waitUntil - Date.now())}</span> — ${x.effect === 'freeze' ? 'без выручки' : 'выручка вдвое меньше'}.`
      : x.effect === 'freeze' ? 'Пока не решишь: выручки нет, а зарплаты и аренда идут.' : 'Пока не решишь: выручка вдвое меньше.';
    const btn = (o, i) => {
      if (!incOptOk(id, o)) return '';
      if (o.t === 'conn' && b.inc.callFailed === o.conn) return `<button class="btn btn-danger" disabled>📵 ${ITEM[o.conn].name} не помог<span class="btn-top">решай по-другому</span></button>`;
      const cost = o.h ? incCost(id, o.h) : 0, rec = x.record ? ' · нарушение в дело' : '';
      const [cls, top] = {
        pay: ['', `${fmt(cost)} ₽${o.clear ? ` · минус ${o.clear} нарушения из дела` : rec}`],
        bribe: ['btn-line', `${fmt(cost)} ₽ · риск ${o.risk || bribeRisk()}%`],
        close: ['btn-ghost', `бесплатно · закрыт ${o.hours} ч${rec}`],
        court: ['btn-line', `шанс ${incChance(o)}%`],
        conn: ['btn-green', `бесплатно · шанс ${callChance(o.conn)}%`],
        wait: ['btn-ghost', `бесплатно · ${o.hours} ч ${x.effect === 'freeze' ? 'без выручки' : 'с половиной выручки'}`],
        fire: ['btn-ghost', 'бесплатно · минус одно рабочее место'],
      }[o.t];
      const label = o.t === 'conn' ? `Позвонить: ${ITEM[o.conn].name}` : o.label;
      return `<button class="btn ${cls}" data-action="inc-do" data-id="${id}:${i}" ${cost && S.money < cost ? 'disabled' : ''}>${label}<span class="btn-top">${top}</span></button>`;
    };
    showModal(`<h3>${x.icon} ${x.title}</h3><p>${x.text.replace('{biz}', d.name)}</p>
      <p class="small ${x.effect === 'freeze' ? 'bad' : 'gold'}">${eff}${b.strikes ? ` Нарушений в деле: ${b.strikes} — проверки чаще, штрафы выше.` : ''}</p>
      ${b.inc.waitUntil ? '' : `<div class="choice">${x.opts.map(btn).join('')}</div>`}
      <button class="btn btn-ghost full" style="margin-top:8px" data-action="close">Решу позже</button>`);
  }
  function incResolve(id, msg, strike) {
    const b = S.biz[id];
    if (strike) incStrike(b);
    b.inc = null;
    closeModal(); haptic('ok'); toast(msg); save(); render();
  }
  function incFail(id, o, text) {
    const b = S.biz[id], d = BIZ[id], f = o.fail || {};
    const fine = f.h ? incCost(id, f.h) : 0;
    if (fine) S.money = Math.max(0, S.money - fine);
    if (f.strike || o.t === 'bribe') incStrike(b);
    if (f.lose === 'biz') delete S.biz[id];
    else { b.inc = null; if (f.freeze) b.closedUntil = Date.now() + f.freeze * 3600e3; }
    haptic('err'); save(); render();
    showModal(`<div class="drop"><div class="drop-icon" style="font-size:44px">😬</div><div class="drop-name bad">Не вышло</div>
      <p style="margin-top:8px">${text}</p>${fine ? `<div class="big bad">−${fmt(fine)} ₽</div>` : ''}
      ${f.lose === 'biz' ? `<div class="big bad">«${d.name}» больше не твой</div>` : ''}${f.freeze ? `<p class="small muted">«${d.name}» не работает ${f.freeze} ч.</p>` : ''}
      <button class="btn full" data-action="close">Эх</button></div>`);
  }
  function incDo(id, i) {
    const b = S.biz[id];
    if (!b || !b.inc) return;
    const x = INC[b.inc.id], o = x.opts[i];
    if (!o || !incOptOk(id, o) || b.inc.waitUntil) return;
    const cost = o.h ? incCost(id, o.h) : 0;
    if (o.t === 'pay') {
      if (!pay(cost)) return;
      if (o.clear) b.strikes = Math.max(0, (b.strikes || 0) - o.clear);
      return incResolve(id, `${x.icon} ${o.ok}`, x.record && !o.clear);
    }
    if (o.t === 'bribe') {
      if (!pay(cost)) return;
      repAdd(-3);
      if (Math.random() * 100 < (o.risk || bribeRisk())) return incFail(id, o, 'Проверяющий оказался честным. Ну или ему мало дали. Теперь штраф и запись в деле.');
      return incResolve(id, `🤝 ${o.ok}`);
    }
    if (o.t === 'close') { b.closedUntil = Date.now() + o.hours * 3600e3; return incResolve(id, `🔒 ${o.ok}`, x.record); }
    if (o.t === 'court') return Math.random() * 100 < incChance(o) ? incResolve(id, `⚖️ ${o.ok}`) : incFail(id, o, o.no || 'Не повезло.');
    if (o.t === 'conn') {
      if (b.inc.callFailed === o.conn) return;
      if (Math.random() * 100 < callChance(o.conn)) return incResolve(id, `📞 ${o.ok}`);
      b.inc.callFailed = o.conn; haptic('err'); save(); showBizInc(id); return;
    }
    if (o.t === 'wait') { b.inc.waitUntil = Date.now() + o.hours * 3600e3; closeModal(); toast(`⏳ ${o.ok}`); save(); render(); return; }
    if (o.t === 'fire') { b.slots--; b.inv = Math.max(BIZ[id].price, b.inv - slotCost(id)); return incResolve(id, `🚪 ${o.ok}`); }
  }

  // ---------- связи: встречи, просьбы, услуги ----------
  const meetOf = (id, i) => CONN_MEETS[id] ? CONN_MEETS[id][i] : ['Встреча', 'users', 20e3 * RARITIES[ITEM[id].rarity].mult];
  const meetCost = (id, m) => Math.round(meetOf(id, MEETS.indexOf(m))[2] * (1 - perk('meetCheap') / 100));
  function addXp(id, xp) {
    const c = S.conn[id], before = connLv(id);
    c.xp = Math.min(cxp(id, CONN_MAX_LV - 1), c.xp + xp);
    c.last = Date.now();
    const after = connLv(id);
    if (after > before) { toast(`${ITEM[id].icon} Доверие ${after}: ${perkText(ITEM[id], after)}`); haptic('ok'); }
  }
  function favorCost(f) {
    if (!f.cost) return 0;
    if (f.cost.salary) return Math.round(bizNum(BIZ[S.favor.biz]).salary * f.cost.salary);
    return monthsMoney(f.cost.hours, f.cost.min);
  }
  function maybeFavor() {
    const now = Date.now();
    if (S.favor && now > S.favor.until) {
      const id = S.favor.conn;
      if (S.conn[id]) S.conn[id].xp = Math.max(cxp(id, connLv(id) - 1), S.conn[id].xp - FAVOR_FAIL_XP);
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
    const base = SPECIALS[it.special.type].replace('{h}', it.special.hours).replace('{case}', it.special.case ? CASE[it.special.case].name : '');
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
      ...(r.items || []).map(id => ITEM[id].name),
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
    if ((p.only || p.onlyId) && !((p.only && user && user.username && user.username.toLowerCase() === p.only) || (p.onlyId && S.pid === p.onlyId))) {
      toast('Этот промокод не для тебя'); haptic('err'); return;
    }
    if (S.promo.includes(hash)) { toast('Этот промокод уже активирован'); haptic('err'); return; }
    if (p.until && new Date() > new Date(p.until + 'T23:59:59')) { toast('Срок действия промокода истёк'); haptic('err'); return; }
    S.promo.push(hash);
    const r = p.reward;
    if (r.money) earn(r.money);
    for (const [id, n] of Object.entries(r.tickets || {})) for (let i = 0; i < n; i++) giveTicket(id);
    for (const id of r.items || []) addItem(ITEM[id]);
    if (r.badge && !S.badges.includes(r.badge)) S.badges.push(r.badge);
    save(); render(); showName();
    showModal(`<div class="drop"><div class="drop-icon" style="--rbg:var(--gold-bg)">${ic('gift', 'gold')}</div>
      <div class="drop-name">${r.message || 'Промокод активирован'}</div><div class="small muted">${r.message ? 'Промокод активирован' : p.label || ''}</div>
      <div class="drop-bonus">${rewardList(r)}</div>
      <button class="btn full" style="margin-top:12px" data-action="close">Отлично</button></div>`);
    haptic('ok');
  }
  const badgeIcons = () => S.badges.filter(b => BADGES[b]).map(b => `<i class="ti ti-${BADGES[b].icon} gold" title="${BADGES[b].name}"></i>`).join(' ');

  // ---------- личные сообщения ----------
  // Показываем по одному, когда нет других окон; отметка «показано» ставится сразу, поэтому второго раза не будет
  function maybeMessage() {
    if (!$('#modal').classList.contains('hidden')) return;
    const fresh = UPDATE_NOTES.items.filter(i => !S.newsSeen.includes(i[3]));
    if (fresh.length && !(S.tut > 0 && S.tut <= TUTORIAL.length)) {
      S.newsSeen = S.newsSeen.concat(fresh.map(i => i[3]));
      save();
      showModal(`${sheetHead('✨ ' + UPDATE_NOTES.title)}
        ${fresh.map(([icon, head, text]) => `<div class="news-row"><div class="news-ico">${icon}</div><div class="grow"><b>${head}</b><div class="small muted">${text}</div></div></div>`).join('')}
        <button class="btn full" style="margin-top:12px" data-action="close">Круто, играю</button>`, true);
      haptic('medium');
      return;
    }
    const m = PLAYER_MESSAGES.find(x => x.to === S.pid && !(S.msgSeen || []).includes(x.id));
    if (!m) return;
    (S.msgSeen = S.msgSeen || []).push(m.id);
    for (const t of m.tickets || []) if (CASE[t]) giveTicket(t);   // подарок: билеты в кейсы
    save(); render();
    showModal(`<div class="drop"><div class="drop-icon" style="font-size:44px">${m.icon || '✉️'}</div>
      <div class="drop-name">${m.title}</div><p style="margin-top:10px;font-size:17px">${m.text}</p>
      <button class="btn full" style="margin-top:12px" data-action="close">Понял</button></div>`);
    haptic('medium');
  }

  // ---------- учёт игроков ----------
  // Отправка в таблицу Google: без ответа (no-cors), тихо, не чаще раза в REPORT_EVERY_H часов.
  // С локального адреса и в тестовом режиме не шлём, чтобы тесты не засоряли таблицу.
  function reportPlayer() {
    const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    if (!STATS_URL || isDebug() || (local && !window.__forceReport)) return;
    if (Date.now() - (S.lastReport || 0) < REPORT_EVERY_H * 3600e3) return;
    S.lastReport = Date.now();
    try {
      fetch(STATS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: S.pid, tag: (user && user.username) || '', name: (user && user.first_name) || '', lvl: S.lvl }) }).catch(() => {});
    } catch (e) { /* без сети — отправим в другой раз */ }
    save();
  }

  // ---------- сделка с олигархом ----------
  const dealMax = () => Math.min(S.money, monthsMoney(DEAL_INCOME_H, 50e3));

  // ---------- гонки ----------
  const rclass = id => RACE_CLASSES[ITEM[id].rarity];
  // Восстановление по времени: { n, ts } — сколько есть и с какого момента копится следующее
  function regen(o, max, minutes) {
    const step = minutes * 60e3, now = Date.now();
    if (o.n >= max) { o.ts = now; return; }
    const gained = Math.floor((now - o.ts) / step);
    if (gained > 0) { o.n = Math.min(max, o.n + gained); o.ts = o.n >= max ? now : o.ts + gained * step; }
  }
  const nextIn = (o, minutes) => o.ts + minutes * 60e3 - Date.now();
  function carState(id) {
    if (!S.garage[id]) S.garage[id] = { tank: TANK_RACES, ts: Date.now(), wear: 0, broken: false };
    const g = S.garage[id];
    if (!g.stage) { g.stage = 0; g.tuneInv = 0; }
    const t = { n: g.tank, ts: g.ts };
    regen(t, TANK_RACES, TANK_REGEN_MIN);
    g.tank = t.n; g.ts = t.ts;
    return g;
  }
  function pool() { regen(S.pool, RACE_POOL, POOL_REGEN_MIN); return S.pool; }
  // до двух значащих цифр: 23 456 → 23 000
  const round2 = v => { if (v <= 0) return 0; const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / mag) * mag; };
  // Единица ставки U — доля цены машины: на дорогой машине и гонки дороже
  const raceUnit = id => Math.max(RACE_UNIT_MIN, ITEM[id].value * RACE_CAR_SHARE);
  function raceStake(id, lv) {
    const u = raceUnit(id), L = RACE_LEVELS[lv];
    return { fee: round2(u * L.fee), prize: round2(u * L.prize) };
  }
  const tuneCost = (id, st) => round2(raceUnit(id) * TUNE_STAGES[st].cost);
  // сколько тюнинг добавит к цене машины при продаже (только последнего экземпляра)
  const tuneValue = id => (S.garage[id] ? Math.round((S.garage[id].tuneInv || 0) * TUNE_SELL_RATE) : 0);
  // что машина стоит сверх себя самой: тюнинг и висящий на ней номер
  const carExtra = id => tuneValue(id) + (plateOf(id) ? plateSell(plateOf(id)) : 0);
  const stageHp = (hp, st) => Math.round(hp * (1 + (st ? TUNE_STAGES[st - 1].hp : 0)));
  const carHp = id => stageHp(CAR_HP[id], carState(id).stage);
  const carTime = id => quarterMile(carHp(id));
  const stageStars = st => `<span class="stars">${'★'.repeat(st)}<span class="off">${'★'.repeat(TUNE_STAGES.length - st)}</span></span>`;
  // Шанс победы на уровне lv (0…4): соперник уровня затюнингован на Stage lv, сравниваем с твоим Stage
  // roll — «форма» соперника (0…1, см. rivals): чем он сильнее, тем ниже шанс.
  // Верных побед нет: где по тюнингу было бы 100%, шанс в полосе своего уровня (кроме «Новичка»), сложнее — ниже.
  function raceChance(id, lv, stage, roll) {
    const s = stage === undefined ? carState(id).stage : stage, d = lv + 1 - s;
    const r = roll === undefined ? rivals(id)[lv].roll : roll;
    if (d <= 0) return lv === 0 ? 100 : Math.ceil(RACE_TOP_MAX - RACE_TOP_STEP * (lv - 1 + r));
    if (d === 1 && s > 0) return RACE_NEAR_WIN;
    const base = RACE_LEVELS[d - 1].base;
    return base > 0 && base < 100 ? base + Math.round(RACE_FORM * (1 - 2 * r)) : base;
  }
  // Средний выигрыш за заезд на самом выгодном уровне (без учёта мастерства) — чтобы видеть, что даёт тюнинг
  function bestRaceEV(id, stage) {
    return Math.max(...RACE_LEVELS.map((L, lv) => {
      const st = raceStake(id, lv);
      return raceChance(id, lv, stage, 0.5) / 100 * st.prize - st.fee;
    }));
  }
  // Соперники машины меняются после каждого заезда: модель — случайная из своей «пятой» части класса по мощности
  // (чем выше уровень, тем мощнее), roll — форма соперника: мощность ±4% и шанс победы.
  function rollRivals(id) {
    const list = ITEMS.filter(x => x.cat === 'car' && x.rarity === ITEM[id].rarity && x.id !== id && CAR_HP[x.id])
      .sort((a, b) => CAR_HP[a.id] - CAR_HP[b.id]);
    const n = list.length, k = RACE_LEVELS.length;
    return RACE_LEVELS.map((L, lv) => {
      if (!n) return { id, roll: Math.random() };
      const lo = Math.min(n - 1, Math.floor(lv * n / k)), hi = Math.min(n, Math.max(lo + 1, Math.floor((lv + 1) * n / k)));
      return { id: list[lo + Math.floor(Math.random() * (hi - lo))].id, roll: Math.random() };
    });
  }
  function rivals(id) {
    const g = carState(id);
    if (!g.rivals || g.rivals.length !== RACE_LEVELS.length || g.rivals.some(r => !ITEM[r.id])) g.rivals = rollRivals(id);
    return g.rivals;
  }
  function rivalOf(id, lv) {
    const r = rivals(id)[lv];
    return { it: ITEM[r.id], stage: lv, hp: Math.round(stageHp(CAR_HP[r.id], lv) * (0.96 + 0.08 * r.roll)) };
  }
  const breakChance = id => Math.min(90, carState(id).wear * BREAK_PER_WEAR);
  const raceCarId = () => {
    const owned = Object.keys(S.inv).filter(id => ITEM[id] && ITEM[id].cat === 'car');
    if (S.raceCar && S.inv[S.raceCar]) return S.raceCar;
    return S.car && S.inv[S.car] ? S.car : owned[0] || null;
  };
  // Что мешает ехать: общее для всех уровней — машина и лимиты; деньги — у каждого уровня свои
  function raceBlock(id) {
    if (S.sil && S.sil.r >= SERVICE_NO_RACE) return 'С полковника гонки не по статусу';
    if (S.sil && S.sil.r >= SERVICE_OWN_RACE_UNTIL && !isSvcCar(id)) return 'С капитана — только на служебной машине';
    const st = carState(id);
    if (st.broken) return 'Машина сломана — нужен ремонт';
    if (st.tank < 1) return `Бак пуст — +1 заезд через ${fmtTime(nextIn({ ts: st.ts }, TANK_REGEN_MIN))}`;
    if (pool().n < 1) return `Лимит заездов — +1 через ${fmtTime(nextIn(S.pool, POOL_REGEN_MIN))}`;
    return '';
  }
  // После заезда может остановить ГИБДД. Связь «Инспектор ГИБДД» снижает шанс, на максимуме — отпускает.
  function gibddStop(id) {
    const lv = connLv('k_gibdd');
    if (Math.random() * 100 >= Math.max(0, GIBDD_CHANCE - GIBDD_CONN_CUT * lv)) return null;
    if (isGov(id) || isSvcCar(id)) return { fine: 0, gov: true };
    if (S.sil && S.sil.r >= STR().gibdd) return { fine: 0, sil: true };
    if (lv >= CONN_MAX_LV) return { fine: 0 };
    return { fine: round2(raceUnit(id) * GIBDD_FINE * (1 - perk('fineCut') / 100)) };
  }

  // ---------- номера ----------
  const PBOX = Object.fromEntries(PLATE_BOXES.map(b => [b.id, b]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // «Все регионы»: регион выпадает случайно при открытии
  const ALL_REG = { id: 'all', name: 'Все регионы', mult: PLATE_REGIONS.reduce((a, r) => a + r.mult, 0) / PLATE_REGIONS.length, codes: [] };
  const plateReg = () => (S.plateReg === 'all' ? ALL_REG : PLATE_REGIONS.find(r => r.id === S.plateReg) || PLATE_REGIONS[0]);
  // Шансы редкостей набора в регионе: госномер в Москве и Питере реже
  const boxW = (box, reg) => Object.fromEntries(Object.entries(box.w).map(([rar, w]) => [rar, rar === 'mythic' ? w * (reg.gov || 1) : w]));
  const plateOf = carId => S.plates.find(p => p.car === carId);
  const plateSell = p => p.collect || Math.round(p.v * PLATE_SELL_RATE);   // collect — цена коллекционера за единственный 97-й
  const isGov = carId => { const p = plateOf(carId); return !!p && p.rar === 'mythic'; };
  // Редкость по виду номера (см. PLATE_RARITY в data.js)
  function plateRarity(a, d, b) {
    const sameL = a === b[0] && b[0] === b[1];
    const pretty = /^(\d)\1\1$/.test(d) || /^00[1-9]$/.test(d);
    if (sameL && pretty) return 'legendary';
    if (sameL || pretty) return 'epic';
    if (/^[1-9]00$/.test(d) || d[0] === d[2]) return 'rare';
    return 'common';
  }
  const rndDigits = () => String(1 + Math.floor(Math.random() * 999)).padStart(3, '0');
  const prettyDigits = () => (Math.random() < 0.5 ? String(Math.ceil(Math.random() * 9)).repeat(3) : '00' + Math.ceil(Math.random() * 9));
  const rareDigits = () => { const x = Math.ceil(Math.random() * 9); return Math.random() < 0.4 ? x + '00' : `${x}${Math.floor(Math.random() * 10)}${x}`; };
  // Номер нужной редкости: собираем подходящий вид и проверяем классификацией
  function makePlate(rar, reg) {
    let a, d, b, r = pick(reg.codes);
    if (rar === 'mythic') {
      const g = pick(PLATE_GOV);
      a = g[0]; b = g.slice(1); d = rndDigits(); r = pick(reg.codes.filter(c => c !== PLATE_SVC_CODE));
    } else {
      do {
        a = pick(PLATE_LETTERS);
        b = pick(PLATE_LETTERS) + pick(PLATE_LETTERS);
        d = rndDigits();
        if (rar === 'legendary') { b = a + a; d = prettyDigits(); }
        else if (rar === 'epic') { if (Math.random() < 0.5) b = a + a; else d = prettyDigits(); }
        else if (rar === 'rare') d = rareDigits();
      } while (plateRarity(a, d, b) !== rar);
    }
    const base = PLATE_RARITY[rar].value;
    const v = round2(base * reg.mult * (rar === 'mythic' ? 1 : 0.9 + Math.random() * 0.2));
    return { id: ++S.plateSeq, a, d, b, r, rar, v, car: null };
  }
  // Цена набора — от ожидаемой стоимости номера в выбранном регионе
  const plateEV = (box, reg) => {
    const w = boxW(box, reg), tw = Object.values(w).reduce((a, b) => a + b, 0);
    return Object.entries(w).reduce((ev, [rar, x]) => ev + x / tw * PLATE_RARITY[rar].value * reg.mult, 0);
  };
  function plateBoxPrice(box, reg) {
    const ev = reg.id === 'all' ? PLATE_REGIONS.reduce((a, r) => a + plateEV(box, r), 0) / PLATE_REGIONS.length : plateEV(box, reg);
    return round2(ev * PLATE_PRICE_RATE);
  }
  function rollPlateRarity(box, reg) {
    const w = reg ? boxW(box, reg) : box.w;
    let x = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [rar, v] of Object.entries(w)) if ((x -= v) < 0) return rar;
    return 'common';
  }
  // Номер как настоящий: буквы ниже цифр, у каждого символа своя ячейка — все номера одного размера.
  // reel — вместо символов барабаны: случайные символы и в конце настоящий (крутятся при открытии набора).
  const REEL_N = 14;
  const reelOf = (fin, pool) => Array.from({ length: REEL_N }, () => `<span>${pick(pool)}</span>`).join('') + `<span>${fin}</span>`;
  function plateInner(p, reel) {
    const cells = [[p.a, 'L'], [p.d[0], 'D'], [p.d[1], 'D'], [p.d[2], 'D'], [p.b[0], 'L'], [p.b[1], 'L']];
    const cell = ([ch, k], i) => `<span class="pc ${k}">${reel ? `<span class="pc-s" style="--t:${(0.9 + i * 0.14).toFixed(2)}s">${reelOf(ch, k === 'L' ? PLATE_LETTERS.split('') : '0123456789'.split(''))}</span>` : ch}</span>`;
    const code = reel ? `<span class="pc-s" style="--t:${(0.9 + 6 * 0.14).toFixed(2)}s">${reelOf(p.r, reel)}</span>` : p.r;
    return `<span class="pl-main">${cells.map(cell).join('')}</span>
      <span class="pl-reg"><span class="pc R ${p.r.length > 2 ? 'c3' : ''}">${code}</span><span class="pl-rus">RUS<i class="pl-flag"></i></span></span>`;
  }
  // Рамка и свечение — цвета редкости (у прокручивающегося номера редкости ещё нет — он нейтральный)
  const plateHTML = (p, cls = '', reel) => `<span class="plate ${p.rar ? 'r-' + p.rar : ''} ${cls}" style="--rc:${p.rar ? RARITIES[p.rar].color : '#8a8f98'}">${plateInner(p, reel)}</span>`;

  // ---------- кейсы ----------
  function poolOf(c) {
    let ids = c.items;
    // бесплатные кейсы растут вместе со статусом игрока
    if (c.id === 'free') ids = FREE_TIERS.filter(t => rankIdx() >= t.rank).pop().items;
    if (c.id === 'conn_free') ids = ids.filter(id => rankIdx() >= (CONN_MIN_RANK[id] || 0));
    return ids.map(id => ITEM[id]).filter(Boolean);
  }
  // real = настоящий дроп (учитывает и двигает гарантию), иначе — заполнитель ленты рулетки
  function rollItem(c, real) {
    const pool = poolOf(c);
    let rars = RARITY_ORDER.filter(r => c.w[r] > 0 && pool.some(i => i.rarity === r));
    const hiW = rars.filter(r => rarIdx(r) >= 2).reduce((x, r) => x + c.w[r], 0) / rars.reduce((x, r) => x + c.w[r], 0) * 100;
    if (real && S.pity >= PITY - 1 && hiW >= PITY_MIN_W) {
      const hi = rars.filter(r => rarIdx(r) >= 2);
      if (hi.length) rars = hi;
    }
    let x = Math.random() * rars.reduce((a, r) => a + c.w[r], 0);
    let rar = rars[rars.length - 1];
    for (const r of rars) { if ((x -= c.w[r]) < 0) { rar = r; break; } }
    if (real && hiW >= PITY_MIN_W) S.pity = rarIdx(rar) >= 2 ? 0 : S.pity + 1;
    const list = pool.filter(i => i.rarity === rar);
    return list[Math.floor(Math.random() * list.length)];
  }
  const cdLeft = c => Math.max(0, (S.cd[c.id] || 0) + c.cooldown - Date.now());
  const caseSection = c => ITEM[c.items[0]].cat;

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
    for (let i = 0; i < n; i++) results.push(addItem(rollItem(c, true), c));
    S.opened += n;
    progress('open', n);
    gainXP(n * (XP_CASE[c.tier] || XP_CASE.cheap));
    if (c.cooldown && !byTicket) progress(c.id === 'free' ? 'free' : 'conn_free');
    save();
    render();
    if (n > 1) showMulti(c, results);
    else if (S.fast) showDrop(results[0]);
    else playRoulette(c, results[0]);
  }

  // Кладёт выпавшее; возвращает, что с ним случилось
  // src — кейс, из которого выпало: подарок за лишнюю связь считается от его цены, а не от дохода (иначе кейс становится фармилкой)
  function addItem(it, src) {
    S.got[it.id] = 1;
    if (it.cat === 'conn') {
      if (!S.conn[it.id]) { S.conn[it.id] = newConn(0); return { it, isNew: true }; }
      if (S.conn[it.id].xp >= cxp(it.id, CONN_MAX_LV - 1)) {
        const v = Math.max(DUP_CONN_GIFT_MIN, Math.round((src && src.price > 0 ? src.price : 0) * DUP_CONN_GIFT / 1000) * 1000);
        earn(v);
        return { it, gift: v };
      }
      const before = connLv(it.id);
      S.conn[it.id].xp = Math.min(cxp(it.id, CONN_MAX_LV - 1), S.conn[it.id].xp + DUP_CONN_XP);
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
  // Продать один экземпляр; тюнинг и номер уходят вместе с последним. Возвращает выручку.
  function sellOne(id) {
    const it = ITEM[id];
    if (!it || !S.inv[id] || it.cat === 'conn') return 0;
    if (isSvcCar(id) && S.inv[id] <= 1) { toast('Служебную машину продать нельзя — можно «списать на личное»'); return 0; }
    if (sellLock('i:' + id) && S.inv[id] <= 1) { toast(`Только что списана — продать можно через ${fmtTime(sellLock('i:' + id))}`); return 0; }
    const price = sellPrice(it) + (S.inv[id] === 1 ? carExtra(id) : 0);
    S.inv[id]--;
    earn(price);
    if (!S.inv[id]) {
      delete S.inv[id];
      delete S.garage[id];
      S.plates = S.plates.filter(p => p.car !== id);
      if (S.car === id) S.car = bestCar();
    }
    return price;
  }
  function sell(id) {
    const it = ITEM[id];
    const price = sellOne(id);
    if (!price) return;
    haptic('light');
    toast(`Продано: ${it.name} +${fmt(price)} ₽`);
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
      const winTile = strip.children[RL_WIN];
      winTile.classList.add('win');
      haptic(rarIdx(res.it.rarity) >= 2 ? 'ok' : 'medium');
      setTimeout(() => {
        $('#roulette').classList.add('hidden');
        spinning = false;
        showDrop(res);
      }, 750);
    };
    const follow = () => {
      const m = new DOMMatrix(getComputedStyle(strip).transform);
      const idx = Math.floor((-m.m41 + box.clientWidth / 2) / RL_STEP);
      if (idx !== lastIdx) { lastIdx = idx; haptic('tick'); }
      raf = requestAnimationFrame(follow);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const x = RL_WIN * RL_STEP + 48 - box.clientWidth / 2 + (Math.random() - 0.5) * 70;
      strip.style.transition = 'transform 6s cubic-bezier(.08,.6,.12,1)';
      strip.style.transform = `translateX(${-x}px)`;
      raf = requestAnimationFrame(follow);
    }));
    strip.addEventListener('transitionend', () => setTimeout(finish, 150), { once: true });
    $('#rl-skip').onclick = () => {
      // пропуск: мгновенно доезжаем до выигрышной плитки
      const cur = new DOMMatrix(getComputedStyle(strip).transform).m41;
      strip.style.transition = 'none';
      strip.style.transform = `translateX(${cur}px)`;
      requestAnimationFrame(() => {
        strip.style.transition = 'transform .35s ease-out';
        strip.style.transform = `translateX(${-(RL_WIN * RL_STEP + 48 - box.clientWidth / 2)}px)`;
        setTimeout(finish, 380);
      });
    };
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
  // Подтверждение: в Telegram — его родное окно, иначе — своё (системный confirm некоторые браузеры молча блокируют)
  let confirmCb = null;
  function askConfirm(text, cb) {
    if (inTelegram && tg.showConfirm) return tg.showConfirm(text, ok => ok && cb());
    confirmCb = cb;
    showModal(`<p style="margin-top:4px">${text}</p>
      <div class="row" style="margin-top:12px"><button class="btn btn-ghost grow" data-action="close">Отмена</button>
        <button class="btn btn-danger grow" data-action="confirm-yes">Да</button></div>`);
  }

  function bonusText(it) {
    if (it.cat === 'conn') return perkText(it);
    if (it.cat === 'car') return `+${it.bonus}% к зарплате`;
    return `+${fmt(ph(it.bonus))} ₽/ч аренды`;
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
      actions = `<button class="btn btn-ghost grow" data-action="close" data-goto="career" data-sub="career:conn">К связям</button><button class="btn grow" data-action="close">Отлично</button>`;
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
      <div class="small muted drop-price">${it.value ? `Стоит ${fmt(it.value)} ₽ · перекупщик даст ${Math.round(sellRate() * 100)}%` : '&nbsp;'}</div>
      <div class="row">${actions}</div></div>`);
    haptic(rarIdx(it.rarity) >= 2 ? 'ok' : 'medium');
  }
  // Итоги открытия пачки: вещи можно отметить и продать выборочно или все разом
  let multi = null;
  function showMulti(c, results) {
    const sorted = results.slice().sort((a, b) => rarIdx(a.it.rarity) - rarIdx(b.it.rarity));
    const step = S.fast ? 0 : 0.12;
    multi = { list: sorted, picked: new Set() };
    const tiles = sorted.map((res, i) => {
      const note = resultNote(res), can = !res.sold && res.it.cat !== 'conn';
      return `<div class="pick-wrap" ${can ? `data-action="multi-pick" data-id="${i}"` : ''}>${tileHTML(res.it, note ? `<div class="tile-note">${note}</div>` : '',
        'reveal' + (rarIdx(res.it.rarity) >= 3 ? ' shine' : ''), `--d:${(i * step).toFixed(2)}s`)}${can ? `<i class="pick-mark">${ic('check')}</i>` : ''}</div>`;
    }).join('');
    const best = sorted[sorted.length - 1].it;
    const soldSum = results.filter(r => r.sold).reduce((a, r) => a + sellPrice(r.it), 0);
    const sellable = sorted.some(r => !r.sold && r.it.cat !== 'conn');
    showModal(`<h3>${c.name} ×${results.length}</h3>
      <div class="tiles mb">${tiles}</div>
      ${soldSum ? `<p class="small">Автопродажа +${fmt(soldSum)} ₽</p>` : ''}
      ${sellable ? `<p class="small muted">Нажми на вещи, чтобы выбрать, что продать.</p>
        <div class="sell-row"><button class="btn btn-ghost" data-action="multi-sell" data-id="all">Продать всё · ${fmt(multiSum(true))} ₽</button>
          <button class="btn btn-line" id="multi-sel" data-action="multi-sell" data-id="sel" disabled>Продать выбранное</button></div>` : ''}
      <button class="btn full" data-action="close">Забрать всё</button>`);
    setTimeout(() => haptic(rarIdx(best.rarity) >= 2 ? 'ok' : 'medium'), sorted.length * step * 1000);
  }
  const multiSum = all => multi.list.reduce((a, r, i) => a + (!r.sold && r.it.cat !== 'conn' && (all || multi.picked.has(i)) ? sellPrice(r.it) : 0), 0);
  function showOffline({ sec, earned }) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    showModal(`<h3>С возвращением 👋</h3>
      <p>Тебя не было ${h ? h + ' ч ' : ''}${m} мин. Работа, аренда и бизнес принесли:</p>
      <div class="big">+${fmt(earned)} ₽</div>
      <p class="small">Без тебя доход идёт на ${Math.round(OFFLINE_RATE * 100)}% и копится максимум ${OFFLINE_CAP_H} часов — в игре он полный.</p>
      <button class="btn full" data-action="close">Забрать</button>`);
  }
  // Шанс в процентах по-русски: 7,9% · 0,5% · 0,05%
  const pct = v => (v >= 1 ? String(+v.toFixed(1)) : String(+v.toPrecision(2))).replace('.', ',') + '%';
  function showPeek(id) {
    const c = CASE[id], pool = poolOf(c);
    const rars = RARITY_ORDER.filter(x => c.w[x] > 0 && pool.some(i => i.rarity === x));
    const tw = rars.reduce((a, x) => a + c.w[x], 0);
    const own = i => !!S.got[i.id];
    const groups = rars.slice().reverse().map(r => {
      const list = pool.filter(i => i.rarity === r).sort((a, b) => b.value - a.value);
      const tiles = list.map(i => `<div data-action="item-info" data-id="${id}:${i.id}">${tileHTML(i, `<div class="tile-note muted">${pct(c.w[r] / tw * 100 / list.length)}${own(i) ? ` ${ic('circle-check-filled', 'good')}` : ''}${i.value ? `<br>${fmt(i.value)} ₽` : ''}</div>`)}</div>`).join('');
      return `<div class="peek-head"><span class="rar-chip" style="background:${RARITIES[r].color}">${c.items[0].startsWith('c_') ? RACE_CLASSES[r].name + ' · ' : ''}${RARITIES[r].name}</span><b>${pct(c.w[r] / tw * 100)}</b></div>
        <div class="tiles">${tiles}</div>`;
    }).join('');
    showModal(`${sheetHead(c.name + ': что внутри')}${groups}
      <button class="btn btn-ghost full" style="margin-top:12px" data-action="case" data-id="${id}">${ic('arrow-left')} Назад</button>`, true);
  }

  // Подробно о вещи из кейса: что даёт связь по уровням доверия, машина и жильё — цифрами
  function showItemInfo(caseId, id) {
    const it = ITEM[id];
    if (!it) return;
    let body = '';
    if (it.cat === 'conn') {
      body = `<div class="label">${PERKS[it.perk].replace('{v}', '…')}</div>
        ${it.lv.map((v, i) => `<div class="kv small"><span>${stars(i + 1)}</span><b>${PERKS[it.perk].replace('{v}', v)}</b></div>`).join('')}
        <div class="small" style="margin-top:8px">${ic('star', 'gold')} На полном доверии: ${specialText(it)}</div>
        ${EVENTS.some(e => e.via === id) ? `<div class="small muted" style="margin-top:6px">Помогает звонком: ${EVENTS.filter(e => e.via === id).map(e => e.title.toLowerCase()).join(', ')}</div>` : ''}`;
    } else if (it.cat === 'car') {
      body = `<div class="kv small"><span>Стоит</span><b>${fmt(it.value)} ₽</b></div>
        <div class="kv small"><span>Перекупщик даст (${Math.round(sellRate() * 100)}%)</span><b>${fmt(sellPrice(it))} ₽</b></div>
        <div class="kv small"><span>К зарплате</span><b>+${it.bonus}%</b></div>
        <div class="kv small"><span>Мощность · класс</span><b>${CAR_HP[id] || '—'} л.с. · ${RACE_CLASSES[it.rarity].name}</b></div>
        <div class="kv small"><span>Ставки в гонках</span><b>от ${fmt(round2(Math.max(RACE_UNIT_MIN, it.value * RACE_CAR_SHARE) * RACE_LEVELS[4].prize))} ₽ за победу</b></div>`;
    } else {
      body = `<div class="kv small"><span>Стоит</span><b>${fmt(it.value)} ₽</b></div>
        <div class="kv small"><span>Перекупщик даст (${Math.round(sellRate() * 100)}%)</span><b>${fmt(sellPrice(it))} ₽</b></div>
        <div class="kv small"><span>Аренда</span><b>+${fmt(ph(it.bonus))} ₽/ч</b></div>`;
    }
    showModal(`${sheetHead(it.name)}
      <div class="row" style="margin-bottom:10px"><div class="inv-icon" style="width:96px;height:64px">${visual(it)}</div>
        <div class="grow small" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</div></div>
      <div class="card">${body}</div>
      <button class="btn btn-ghost full" style="margin-top:8px" data-action="peek" data-id="${caseId}">${ic('arrow-left')} Назад</button>`, true);
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
      <div class="row"><div class="grow"><div class="big-text">${lifeText(step)}</div><div class="reward">${rewardText(step.reward)}</div></div>
      ${done ? '<button class="btn btn-green btn-sm" data-action="claim-life">Забрать</button>' : '<span class="tag lock">в процессе</span>'}</div></div>`;
  }
  // ---------- коллекции ----------
  const ownedCars = () => Object.keys(S.inv).filter(id => ITEM[id] && ITEM[id].cat === 'car' && !ITEM[id].svc);
  function collState(c) {
    const own = new Set(ownedCars());
    const pool = c.t ? ITEMS.filter(i => i.cat === 'car' && !i.svc && (i.t || []).includes(c.t)) : null;
    const need = c.t ? pool.length : c.n === 'all' ? ITEMS.filter(i => i.cat === 'car' && !i.svc).length : c.n;
    const have = c.t ? pool.filter(i => own.has(i.id)).length : own.size;
    return { have: Math.min(have, need), need, done: have >= need, claimed: !!S.coll[c.id] };
  }
  const collReady = () => COLLECTIONS.some(c => { const st = collState(c); return st.done && !st.claimed; });
  const collReward = c => [c.money ? `+${fmt(monthsMoney(c.money, 20e3))} ₽` : '', c.ticket ? ticketName(c.ticket) : '', c.badge ? `значок «${BADGES[c.badge].name}»` : ''].filter(Boolean).join(' · ');
  function collRows() {
    return COLLECTIONS.map(c => {
      const st = collState(c);
      const right = st.claimed ? `<span class="tag">${ic('check')}</span>`
        : st.done ? `<button class="btn btn-green btn-sm" data-action="coll-claim" data-id="${c.id}">Забрать</button>`
        : `<span class="small muted">${st.have}/${st.need}</span>`;
      return `<div class="quest ${st.claimed ? 'claimed' : ''}"><div class="grow"><div class="q-text">${c.name}</div>
        <div class="bar"><i style="width:${st.have / st.need * 100}%"></i></div><div class="reward">${collReward(c)}</div></div>${right}</div>`;
    }).join('');
  }

  let profTab = 'quests';
  function showProfile(t) {
    if (t) profTab = t;
    if (S.tut > 0) { tutProfile = true; setTimeout(tutTick, 0); }
    ensureQuests();
    const r = rankInfo();
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setHours(24, 0, 0, 0);
    const nextWeek = weekStart(now); nextWeek.setDate(nextWeek.getDate() + 7);
    const left = ms => { const h = Math.floor(ms / 3600e3); return h >= 24 ? `${Math.floor(h / 24)} дн ${h % 24} ч` : `${h} ч ${Math.floor(ms % 3600e3 / 60e3)} мин`; };
    const lc = lvlColor(S.lvl), xpPct = S.lvl >= LEVEL_MAX ? 100 : S.xp / levelNeed(S.lvl) * 100;
    const tabs = [['quests', 'Задания'], ['path', 'Цели'], ['coll', `Коллекции${collReady() ? ' <span class="dotty">•</span>' : ''}`], ['more', 'Ещё']];
    let body = '';
    if (profTab === 'quests') body = `
      <div class="section">Дня · обновятся через ${left(tomorrow - now)}</div>
      <div class="card quests">${questRows(S.daily, 'daily')}${questBonus(S.daily, 'daily')}</div>
      <div class="section">Недели · ещё ${left(nextWeek - now)}</div>
      <div class="card quests">${questRows(S.weekly, 'weekly')}${questBonus(S.weekly, 'weekly')}</div>`;
    else if (profTab === 'coll') body = `<p class="small muted">Собирай машины — за серии и количество положены награды (один раз).</p>
      <div class="card quests">${collRows()}</div>`;
    else if (profTab === 'path') body = `${lifeCard()}
      <p class="small muted">Опыт — за кейсы, гонки, подработки, учёбу, связи, задания и службу. За уровень — денежный бонус, на каждом 5-м — ещё и билет.
        Цвет уровня: серый → синий (5) → фиолетовый (10) → золотой (20) → красный (35) → бирюзовый (45).</p>`;
    else body = `
      <div class="card"><div class="row"><div class="grow"><div class="small muted">Твой ID</div><div class="val" style="letter-spacing:1px">${S.pid}</div></div>
        <button class="btn btn-ghost btn-sm" data-action="copy-pid">${ic('copy')} Копировать</button></div></div>
      <p class="small muted" style="margin:0 2px 8px">Игра отправляет разработчику твой ID, Telegram-тег, имя и уровень — для промокодов и поддержки.</p>
      <div class="card"><div class="row"><input id="promo-input" class="input grow" placeholder="Промокод" autocomplete="off" autocapitalize="characters">
        <button class="btn btn-sm" data-action="promo">OK</button></div></div>
      <div class="card">
        <div class="kv"><span>Состояние</span><b>${fmt(r.nw)} ₽</b></div>
        <div class="kv"><span>Заработано за всё время</span><b>${fmt(S.total)} ₽</b></div>
        <div class="kv"><span>Открыто кейсов</span><b>${S.opened}</b></div>
        <div class="kv"><span>Коллекция</span><b>${Object.keys(S.inv).filter(id => ITEM[id] && !ITEM[id].svc).length} из ${ITEMS.filter(i => i.cat !== 'conn' && !i.svc).length}</b></div>
      </div>
      <button class="btn btn-line btn-sm full" style="margin-bottom:8px" data-action="tut-restart">${ic('school')} Пройти обучение заново</button>
      <div class="row"><button class="btn btn-ghost btn-sm grow" data-action="credits">${ic('camera')} Авторы фото</button>
        <button class="btn btn-danger btn-sm grow" data-action="reset">Начать заново</button></div>
      ${isDebug() ? debugPanel() : ''}`;
    showModal(`${sheetHead('Профиль')}
      <div class="card prof" style="--lc:${lc}"><div class="row">
        <div class="ava-wrap"><div class="ava">${$('#ava').textContent}</div><span class="lvl">${S.lvl}</span></div>
        <div class="grow"><div class="prof-name">${name.replace(/[<>&]/g, '')} ${badgeIcons()}</div>
          <div class="small muted">${r.cur.icon} ${r.cur.name}${S.sil ? ` · ${STR().icon} ${svcRank().name}` : ''}</div></div></div>
        <div class="kv small" style="margin-top:10px"><span>Уровень ${S.lvl}</span><b class="muted">${S.lvl >= LEVEL_MAX ? 'максимум' : `${Math.floor(S.xp)} / ${levelNeed(S.lvl)}`}</b></div>
        <div class="bar lvl-bar"><i style="width:${xpPct}%"></i></div>
        <div class="kv small" style="margin-top:6px"><span>Статус</span><b class="muted">${r.next ? `до «${r.next.name}» ${fmt(r.next.min - r.nw)} ₽` : 'вершина'}</b></div>
        <div class="bar"><i style="width:${r.pct}%"></i></div></div>
      <div class="seg">${tabs.map(([k, n]) => `<button class="${profTab === k ? 'active' : ''}" data-action="prof-tab" data-id="${k}">${n}</button>`).join('')}</div>
      ${body}`, true);
  }

  // ---------- тестовая панель: только при адресе с ?debug ----------
  // Режим разработчика: ?debug в адресе или личный ID из DEV_IDS (data.js) — для игры через Telegram
  const isDebug = () => /[?&]debug/.test(location.search) || (typeof S !== 'undefined' && S && DEV_IDS.includes(S.pid));
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
    const studyLine = `навыки: ${Object.values(S.skills).reduce((a, b) => a + b, 0)} ур.`;
    const gigLine = S.gig ? (Date.now() >= S.gig.until ? ' · подработка готова' : ` · подработка <span data-timer="${S.gig.until}">${fmtTime(S.gig.until - Date.now())}</span>`) : '';
    const row = (go, icon, title, subline, cls = 'muted') => `<button class="card tap" ${go}><div class="list-row"><div class="ico-box">${ic(icon)}</div>
      <div class="grow"><div class="val">${title}</div><div class="small ${cls}">${subline}</div></div><span class="chev">${ic('chevron-right')}</span></div></button>`;
    return `
      ${ev ? `<button class="card tap ${ev.good ? 'accent' : 'danger'}" data-action="event-show"><div class="list-row">
          <div class="ico-box" style="font-size:22px">${ev.icon}</div>
          <div class="grow"><div class="big-text">${ev.title}</div>
          <div class="small muted">${ev.good ? 'Забери награду' : 'Требует решения'}${S.event.biz ? ' · ' + BIZ[S.event.biz].name : ''}</div></div>
          <span class="chev">${ic('chevron-right')}</span></div></button>` : ''}
      ${life ? `<button class="card tap accent ${lifeOk ? 'ok' : ''}" data-action="${lifeOk ? 'claim-life' : 'life-go'}">
        <div class="label">${ic('route')} Следующая цель</div>
        <div class="row"><div class="grow"><div class="big-text">${lifeText(life)}</div><div class="reward">${rewardText(life.reward)}</div></div>
        ${lifeOk ? '<span class="btn btn-green btn-sm">Забрать</span>' : `<span class="chev">${ic('chevron-right')}</span>`}</div></button>` : ''}
      <div class="grid2">
        <button class="tile-card" data-action="inv" data-id="car">
          <div class="ph">${car ? visual(car) : ic('car')}</div>
          <div class="body"><div class="label">Гараж · ${countCat('car')}</div>
            <div class="val ellipsis">${car ? car.name : 'Пешком'}</div>
            <div class="small ${car ? 'good' : 'muted'}">${car ? (S.sil ? (isSvcCar(car.id) ? 'служебная' : 'личная машина') : `+${car.bonus}% к зарплате`) : 'машины — в кейсах'}</div></div></button>
        <button class="tile-card" data-action="inv" data-id="home">
          <div class="ph">${homes.length ? `<img class="cover" src="${ITEM[homes[0]].img}" alt="">` : ic('home')}</div>
          <div class="body"><div class="label">Жильё · ${countCat('home')}</div>
            <div class="val ellipsis">${homes.length ? ITEM[homes[0]].name : 'Нет жилья'}</div>
            <div class="small ${homes.length ? 'good' : 'muted'}">${homes.length ? `+${fmt(ph(rent()))} ₽/ч` : 'жильё — в кейсах'}</div></div></button>
      </div>
      ${row('data-goto="career"', S.sil ? 'shield' : 'briefcase', S.sil ? `${STR().icon} ${svcRank().name} ${STR().name}` : job ? job.name : 'Предприниматель',
        `${pay ? `<span class="good">${fmt(ph(pay))} ₽/ч</span> · ` : ''}${studyLine}${gigLine}${S.sil && Date.now() >= S.sil.nextMission ? ' · <span class="gold">есть задание</span>' : ''}`)}
      ${S.sil ? row('data-goto="career"', 'umbrella', `«Крыша» · ${S.sil.roofs.length}`,
        S.sil.roofs.length ? `+${fmt(ph(roofIncome()))} ₽/ч` : svcRank().roofs ? 'возьми бизнес под «крышу»' : 'с сержанта', S.sil.roofs.length ? 'good' : 'muted')
      : row('data-goto="biz"', 'building-factory-2', nBiz ? `Бизнес · ${nBiz}${Object.values(S.biz).some(b => b.inc) ? ' · ⚠️ проблемы' : ''}` : 'Свой бизнес',
        nBiz ? `${bp >= 0 ? '+' : ''}${fmt(ph(bp))} ₽/ч` : 'от ларька с шаурмой до IT-холдинга', nBiz ? (bp < 0 ? 'bad' : 'good') : 'muted')}
      ${row('data-goto="career" data-sub="career:conn"', 'users', nConn ? `Связи · ${nConn}` : 'Связи',
        S.favor ? 'Тебя кое о чём просят' : nConn ? 'полезные люди решают проблемы' : 'открой «Знакомство дня»', S.favor ? 'gold' : 'muted')}
      <p class="small muted" style="text-align:center;margin-top:6px">${ic('clock')} Деньги капают непрерывно. Без тебя — ${Math.round(OFFLINE_RATE * 100)}% дохода, максимум ${OFFLINE_CAP_H} ч</p>`;
  }

  // ---------- имущество (открывается с главной) ----------
  function renderInv() {
    const cat = sub.inv;
    if (cat === 'plate') return invTabs(cat) + renderPlates();
    const list = Object.keys(S.inv).map(id => ITEM[id]).filter(it => it && it.cat === cat)
      .sort((a, b) => rarIdx(b.rarity) - rarIdx(a.rarity) || b.value - a.value);
    const rows = list.map(it => {
      const n = S.inv[it.id];
      const equip = cat === 'home' ? '' : S.car === it.id ? '<span class="tag">За рулём</span>'
        : `<button class="btn btn-sm btn-line" data-action="equip" data-id="${it.id}">Сесть</button>`;
      return `<div class="inv-item" style="${rStyle(it.rarity)}">
        <div class="inv-icon">${visual(it)}${n > 1 ? `<b class="cnt">×${n}</b>` : ''}</div>
        <div class="grow"><div class="inv-name">${it.name}</div>
          ${cat === 'car' && plateOf(it.id) ? `<div>${plateHTML(plateOf(it.id), 'sm')}</div>` : ''}
          <div class="small" style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</div>
          <div class="small muted">${bonusText(it)}${cat === 'home' && n > 1 ? ' · ×' + n + ', сдаётся одно' : ''} · ${fmt(it.value)} ₽</div></div>
        <div class="inv-actions">${equip}${isSvcCar(it.id) && n <= 1 ? '<span class="tag">Служебная</span>'
          : `<button class="btn btn-sm btn-ghost" data-action="sell" data-id="${it.id}">Продать ${fmt(sellPrice(it) + (n === 1 ? carExtra(it.id) : 0))}</button>`}</div></div>`;
    }).join('');
    let worth = 0, sale = 0, cnt = 0;
    for (const it of list) {
      const n = S.inv[it.id] - (isSvcCar(it.id) ? 1 : 0);
      if (n <= 0) continue;
      cnt += n; worth += it.value * n; sale += sellPrice(it) * n + (cat === 'car' ? carExtra(it.id) : 0);
      if (cat === 'car' && plateOf(it.id)) worth += plateOf(it.id).v;
    }
    return `${invTabs(cat)}
      <p class="hint">${cat === 'car' ? 'Машина, на которой ездишь, прибавляет к зарплате.' : 'Каждое жильё сдаётся один раз — лишние копии лучше продать.'} Собрано ${list.filter(i => !i.svc).length} из ${ITEMS.filter(i => i.cat === cat && !i.svc).length}.</p>
      ${rows || `<div class="empty">${ic(cat === 'car' ? 'car' : 'home')}Пока пусто<br><br><button class="btn btn-sm" data-goto="cases" data-sub="cases:${cat}">К кейсам</button></div>`}
      ${cnt ? totalsCard(cnt, worth, sale, cat === 'car' ? 'Номера на машинах и тюнинг входят в цену продажи. Служебная не считается.' : '') : ''}`;
  }

  // Итог под списком имущества: рыночная стоимость и сколько дадут, если продать всё сразу
  const totalsCard = (cnt, worth, sale, note) => `<div class="card totals">
      <div class="kv"><span>Всего</span><b>${cnt} шт.</b></div>
      <div class="kv"><span>Всё стоит</span><b>${fmt(worth)} ₽</b></div>
      <div class="kv"><span>Перекупщик даст за всё</span><b class="good">${fmt(sale)} ₽</b></div>
      ${note ? `<div class="small muted">${note}</div>` : ''}</div>`;
  const invTabs = cat => `<button class="back" data-goto="home">${ic('chevron-left')} Главная</button>
      <div class="seg">
        <button class="${cat === 'car' ? 'active' : ''}" data-sub="inv:car">Гараж · ${countCat('car')}</button>
        <button class="${cat === 'plate' ? 'active' : ''}" data-sub="inv:plate">Номера · ${S.plates.length}</button>
        <button class="${cat === 'home' ? 'active' : ''}" data-sub="inv:home">Жильё · ${countCat('home')}</button></div>`;

  // ---------- номера: экран ----------
  function renderPlates() {
    const reg = plateReg();
    const regs = `<button class="card tap" data-action="plate-regs"><div class="list-row"><div class="ico-box">${ic('map-pin')}</div>
        <div class="grow"><div class="small muted">Регион номера</div><div class="val">${reg.id === 'all' ? 'Все регионы · выпадет случайно' : `${reg.name} · ${reg.codes.slice(0, 3).join(', ')}${reg.codes.length > 3 ? '…' : ''}`}</div></div>
        <span class="small gold">${reg.id !== 'all' && reg.mult > 1 ? '×' + String(reg.mult).replace('.', ',') : ''}</span><span class="chev">${ic('chevron-down')}</span></div></button>`;
    const boxes = PLATE_BOXES.map(box => {
      const price = plateBoxPrice(box, reg), locked = rankIdx() < box.rank;
      const bw = reg.id === 'all' ? box.w : boxW(box, reg), tw = Object.values(bw).reduce((a, b) => a + b, 0);
      const odds = Object.entries(bw).filter(([, w]) => w > 0)
        .map(([rar, w]) => `<span style="color:${RARITIES[rar].color}">${PLATE_RARITY[rar].name} ${pct(w / tw * 100)}</span>`).join(' · ');
      return `<div class="card ${locked ? 'locked' : ''}">
        <div class="row"><div class="job-ico">${box.icon}</div>
          <div class="grow"><div class="job-name">${box.name}</div><div class="small">${odds}</div></div>
          ${locked ? `<span class="tag lock" title="нужен статус">${ic('lock')} ${RANKS[box.rank].name}</span>`
            : `<button class="btn btn-sm btn-col" data-action="plate-open" data-id="${box.id}" data-confirm="${fmt(price)} ₽" ${S.money < price ? 'disabled' : ''}>Открыть<span class="btn-top">${fmt(price)} ₽</span></button>`}</div></div>`;
    }).join('');
    const mine = [...S.plates].sort((x, y) => y.v - x.v).map(p => {
      const car = p.car && ITEM[p.car];
      if (p.svc) return `<div class="card plate-row" style="${rStyle(p.rar)}"><div class="row">${plateHTML(p)}
          <div class="grow"><div class="small" style="color:${RARITIES[p.rar].color}"><b>Служебный</b> · ${PLATE_RARITY[p.rar].name}</div>
            <div class="small muted ellipsis">на ${car ? car.name : 'служебной'} · не продаётся</div></div></div></div>`;
      return `<div class="card plate-row" style="${rStyle(p.rar)}">
        <div class="row">${plateHTML(p)}
          <div class="grow"><div class="small" style="color:${RARITIES[p.rar].color}"><b>${PLATE_RARITY[p.rar].name}</b> · ${fmt(p.v)} ₽</div>
            <div class="small muted ellipsis">${car ? 'на ' + car.name : 'не установлен'}</div></div></div>
        <div class="row" style="margin-top:8px">
          ${car ? `<button class="btn btn-sm btn-ghost grow" data-action="plate-off" data-id="${p.id}">Снять</button>`
            : `<button class="btn btn-sm btn-line grow" data-action="plate-on" data-id="${p.id}" ${countCat('car') ? '' : 'disabled'}>Повесить на машину</button>`}
          <button class="btn btn-sm btn-ghost" data-action="plate-sell" data-id="${p.id}">Продать ${fmt(plateSell(p))}</button></div></div>`;
    }).join('');
    return `<p class="hint">Номер вешается на машину: его цена входит в твой статус и в цену машины при продаже.
        Чем красивее номер и «дороже» регион — тем он ценнее. Госномера ${PLATE_GOV.join(' и ')} выпадают в любом регионе, самые редкие и дорогие — московские; 97-й регион — только у генералов на службе. С госномером ГИБДД не штрафует.</p>
      ${regs}
      ${boxes}
      <label class="toggle" style="margin:4px 0 12px"><input type="checkbox" data-toggle="fast" ${S.fast ? 'checked' : ''}><i></i>Быстрое открытие</label>
      ${mine || `<div class="empty">${ic('rectangle')}Номеров пока нет</div>`}
      ${S.plates.some(p => !p.svc) ? totalsCard(S.plates.filter(p => !p.svc).length, S.plates.filter(p => !p.svc).reduce((a, p) => a + p.v, 0), S.plates.filter(p => !p.svc).reduce((a, p) => a + plateSell(p), 0), 'Служебный номер не считается.') : ''}`;
  }
  function openPlate(boxId) {
    const box = PBOX[boxId], sel = plateReg();
    if (!box || spinning || rankIdx() < box.rank) return;
    if (!pay(plateBoxPrice(box, sel))) return;
    const reg = sel.id === 'all' ? pick(PLATE_REGIONS) : sel;
    const p = makePlate(rollPlateRarity(box, reg), reg);
    S.plates.push(p);
    save(); render();
    const final = () => {
      spinning = false;
      const el = $('#pl-roll');
      if (!el) return;
      el.outerHTML = plateHTML(p, 'big win');
      $('#pl-info').innerHTML = `<div class="drop-name" style="color:${RARITIES[p.rar].color}">${PLATE_RARITY[p.rar].name}</div>
        <div class="big">${fmt(p.v)} ₽</div>${sel.id === 'all' ? `<div class="small muted">${reg.name}</div>` : ''}`;
      $('#pl-actions').classList.remove('hidden');
      haptic(rarIdx(p.rar) >= 2 ? 'ok' : 'light');
    };
    // барабаны региона: в режиме «Все регионы» крутятся коды всех регионов
    const codes = (sel.id === 'all' ? PLATE_REGIONS.flatMap(r => r.codes) : reg.codes);
    showModal(`<div class="drop" style="${rStyle(p.rar)}">
        <div class="plate-stage">${plateHTML(Object.assign({}, p, { rar: null }), 'big', S.fast ? null : codes)}</div>
        <div id="pl-info" style="min-height:64px;margin-top:10px"></div>
        <div class="row hidden" id="pl-actions" style="margin-top:6px">
          <button class="btn btn-ghost grow" data-action="plate-sell" data-id="${p.id}">Продать ${fmt(plateSell(p))}</button>
          ${countCat('car') ? `<button class="btn grow" data-action="plate-on" data-id="${p.id}">Повесить</button>` : `<button class="btn grow" data-action="close">В коллекцию</button>`}</div></div>`);
    $('.plate-stage .plate').id = 'pl-roll';
    if (S.fast) return final();
    // барабаны останавливаются по очереди слева направо, последний — регион
    spinning = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { const el = $('#pl-roll'); if (el) el.classList.add('go'); }));
    setTimeout(final, (0.9 + 6 * 0.14) * 1000 + 250);
  }
  // Выбор машины для номера
  function plateChooseCar(pid) {
    const cars = Object.keys(S.inv).filter(id => ITEM[id] && ITEM[id].cat === 'car');
    const p = S.plates.find(x => x.id === pid);
    if (!p) return;
    showModal(`<h3>Повесить ${plateHTML(p, 'sm')}</h3>
      <p class="small muted">Если на машине уже есть номер — он снимется и останется у тебя.</p>
      ${cars.map(id => `<button class="list-btn" data-action="plate-set" data-id="${pid}:${id}">
        <span class="inv-icon">${visual(ITEM[id])}</span><span class="grow">${ITEM[id].name}</span>
        ${plateOf(id) ? plateHTML(plateOf(id), 'sm') : '<span class="small muted">без номера</span>'}</button>`).join('')}
      <button class="btn btn-ghost full" data-action="close" style="margin-top:8px">Отмена</button>`);
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
  function themeRow(c) {
    return `<button class="card tap" data-action="case" data-id="${c.id}"><div class="list-row">
      <div class="ico-box" style="font-size:20px">${c.icon}</div>
      <div class="grow"><div class="val">${c.name}${S.tickets[c.id] ? ` · ${ic('ticket', 'gold')}×${S.tickets[c.id]}` : ''}</div><div class="small muted ellipsis">${c.desc}</div></div>
      <span class="case-price">${fmt(casePrice(c))} ₽</span></div></button>`;
  }
  function renderCases() {
    const sec = sub.cases;
    const list = CASES.filter(c => !c.cooldown && caseSection(c) === sec);
    const dot = c => (!cdLeft(c) ? ' <span class="dotty">•</span>' : '');
    const tierBlock = (tier, title) => {
      const l = list.filter(c => c.tier === tier && !c.theme).sort((a, b) => a.price - b.price);
      return l.length ? `<div class="section">${title}</div><div class="case-grid">${l.map(caseTile).join('')}</div>` : '';
    };
    const themed = list.filter(c => c.theme).sort((a, b) => a.price - b.price);
    return `<div class="seg">
        <button class="${sec === 'car' ? 'active' : ''}" data-sub="cases:car">Авто${dot(CASE.free)}</button>
        <button class="${sec === 'home' ? 'active' : ''}" data-sub="cases:home">Жильё</button>
        <button class="${sec === 'conn' ? 'active' : ''}" data-sub="cases:conn">Связи${dot(CASE.conn_free)}</button></div>
      <p class="pity mb">${ic('target')} Эпик или выше не позже чем через ${PITY - S.pity} шт. в кейсах, где его шанс от ${PITY_MIN_W}%${S.skills.cha ? ` · скидка ${Math.min(S.skills.cha, 30)}%` : ''}</p>
      ${freeCaseCard(sec === 'conn' ? CASE.conn_free : CASE.free)}
      ${tierBlock('cheap', 'Недорогие')}${tierBlock('mid', 'Средние')}${tierBlock('elite', 'Дорогие')}
      ${themed.length ? `<details class="more"><summary>${ic('category')} Тематические · ${themed.length}</summary>${themed.map(themeRow).join('')}</details>` : ''}`;
  }
  function showCase(id) {
    const c = CASE[id], pool = poolOf(c);
    const rars = RARITY_ORDER.filter(r => c.w[r] > 0 && pool.some(i => i.rarity === r));
    const tw = rars.reduce((a, r) => a + c.w[r], 0);
    const bar = rars.map(r => `<i style="width:${c.w[r] / tw * 100}%;background:${RARITIES[r].color}"></i>`).join('');
    const legend = rars.map(r => `<span style="color:${RARITIES[r].color}">${RARITIES[r].name} ${pct(c.w[r] / tw * 100)}</span>`).join('');
    const tickets = S.tickets[id] || 0;
    showModal(`${sheetHead(c.name)}
      <div class="case-tile" style="margin-bottom:12px"><div class="case-cover" style="height:140px">${coverHTML(c)}</div></div>
      <p>${c.desc}.</p>
      <div class="chance-bar">${bar}</div><div class="chance-legend">${legend}</div>
      ${tickets ? `<button class="btn full" style="margin-top:12px" data-action="ticket" data-id="${id}">${ic('ticket')} Открыть по билету · осталось ${tickets}</button>` : ''}
      <div class="open-row">${MULTI_OPEN.map(n => `<button class="btn btn-ghost" data-action="open" data-id="${id}" data-n="${n}" data-confirm="×${n} · ${fmt(batchPrice(c, n))} ₽">
        <span class="btn-top">×${n}${MULTI_DISCOUNT[n] ? ` <s>−${MULTI_DISCOUNT[n] * 100}%</s>` : ''}</span>${fmt(batchPrice(c, n))} ₽
        ${MULTI_DISCOUNT[n] ? `<s class="save">выгода ${fmt(casePrice(c) * n - batchPrice(c, n))}</s>` : ''}</button>`).join('')}</div>
      <button class="btn btn-ghost full" style="margin-top:8px" data-action="peek" data-id="${id}">${ic('list-search')} Что внутри</button>
      <div style="margin-top:8px">
        <label class="toggle"><input type="checkbox" data-toggle="fast" ${S.fast ? 'checked' : ''}><i></i>Быстрое открытие</label>
        ${caseSection(c) !== 'conn' ? `<label class="toggle"><input type="checkbox" data-toggle="autoSell" ${S.autoSell ? 'checked' : ''}><i></i>Сразу продавать обычные повторки</label>` : ''}
      </div>`, true);
  }

  // ---------- уровень игрока ----------
  const lvlColor = l => LEVEL_COLORS.find(([from]) => l >= from)[1];
  function gainXP(n) {
    if (!n || S.lvl >= LEVEL_MAX) return;
    S.xp += n;
    while (S.lvl < LEVEL_MAX && S.xp >= levelNeed(S.lvl)) {
      S.xp -= levelNeed(S.lvl);
      S.lvl++;
      const v = monthsMoney(LEVEL_MONEY_MONTHS, LEVEL_MONEY_MIN), t = LEVEL_TICKETS[S.lvl];
      earn(v);
      if (t) giveTicket(t);
      haptic('ok');
      toast(`⭐ Уровень ${S.lvl}! +${fmt(v)} ₽${t ? ' и ' + ticketName(t) : ''}`);
      if (S.lvl === SERVICE_MIN_LEVEL && !S.sil) setTimeout(() => toast('Открыта служба: МВД, ФСБ, прокуратура — в «Карьере»'), 2500);
    }
  }

  // ---------- служба ----------
  const STR = () => STRUCTURES.find(x => x.id === S.sil.s);
  const svcRank = () => SERVICE_RANKS[S.sil.r];
  const servicePay = () => Math.round(svcRank().pay * STR().payMult * (1 + S.skills.int * 0.01));
  // Доход с одной «крыши»: цена бизнеса × ставка × его характер, у «профильного» для структуры — больше
  const roofTrait = id => ROOF_TRAITS[id] || { rate: 1, risk: 1 };
  const roofFits = id => !!S.sil && roofTrait(id).fit === S.sil.s;
  const roofCap = () => svcRank().pay * ROOF_CAP;   // без payMult: «крыша» — деньги бизнеса, а не довольствие, во всех структурах одинаково
  const roofPay = id => Math.min(roofCap(), BIZ[id].turn * ROOF_RATE * roofTrait(id).rate * (roofFits(id) ? 1 + ROOF_FIT : 1));
  const roofIncome = () => (S.sil ? S.sil.roofs.reduce((a, id) => a + roofPay(id), 0) : 0);
  // «Месяц звания» — мерило денег в заданиях: довольствие + самая дорогая доступная «крыша»
  const rankMonth = () => svcRank().pay * STR().payMult + (svcRank().tier >= 0 ? Math.min(roofCap(), BUSINESSES[svcRank().tier].turn * ROOF_RATE) : 0);
  const serviceH = () => (Date.now() - S.sil.since) / 3600e3;
  // Служебный опыт упирается в требование следующего звания (на высшем — в своё): сверх лимита не копится, до повышения фармить нечего
  const svcXpCap = () => (SERVICE_RANKS[S.sil.r + 1] || SERVICE_RANKS[S.sil.r]).xp;
  function svcXpAdd(n) { const got = Math.max(0, Math.min(n, svcXpCap() - S.sil.xp)); S.sil.xp += got; return got; }
  const xpText = (got, want) => got >= want ? `+${got} опыта` : got > 0 ? `+${got} опыта (лимит звания)` : 'опыт на этом звании набран';
  const rankH = () => (Date.now() - (S.sil.rankAt || S.sil.since)) / 3600e3;   // выслуга на текущем звании
  // Погоны звания: у МВД — полицейские, у ФСБ — армейские, у прокуратуры — свои (k0–k9). Без гербов и эмблем
  const boardImg = (r, cls = '') => `<img class="pogon ${cls}" src="img/ranks/${({ mvd: 'p', spn: 'k' })[S.sil.s] || 'a'}${r}.png?v=2" alt="${SERVICE_RANKS[r].name}">`;
  // Что нужно до следующего звания: [{ text, ok }]
  function promoReqs() {
    const nx = SERVICE_RANKS[S.sil.r + 1];
    if (!nx) return null;
    const left = Math.max(0, nx.h - rankH());
    return [
      { ok: left <= 0, text: left > 0 ? `Выслуга на звании: ещё ${fmtTime(left * 3600e3)} из ${nx.h} ч` : `Выслуга на звании ${nx.h} ч` },
      { ok: S.lvl >= nx.lv, text: `Уровень ${nx.lv}` + (S.lvl < nx.lv ? ` (сейчас ${S.lvl})` : '') },
      ...STR().skills.map(k => ({ ok: S.skills[k] >= nx.sk, text: `${SKILL[k].name} ${nx.sk}` + (S.skills[k] < nx.sk ? ` (сейчас ${S.skills[k]})` : '') })),
      { ok: S.sil.xp >= nx.xp, text: `Служебный опыт ${Math.floor(S.sil.xp)} / ${nx.xp}` },
      { ok: S.rep >= 0, text: `Репутация не ниже 0` + (S.rep < 0 ? ` (сейчас ${Math.round(S.rep)})` : '') },
      ...(S.sil.r + 1 >= SERVICE_BIZ_UNTIL && Object.keys(S.biz).length ? [{ ok: false, text: `Продай бизнес — с «${SERVICE_RANKS[SERVICE_BIZ_UNTIL].name}» нельзя` }] : []),
    ];
  }
  const missionOf = () => MISSIONS.find(m => m.id === S.sil.mission);
  // Служебная машина: лежит в гараже, но не твоя — не продаётся, не тюнингуется, не входит в состояние
  const svcCar = () => (S.sil && S.sil.car && S.inv[S.sil.car] ? S.sil.car : null);
  const isSvcCar = id => !!id && svcCar() === id;
  const svcPlate = () => S.plates.find(p => p.svc);
  function dropSvcCar() {
    const id = S.sil && S.sil.car;
    S.plates = S.plates.filter(p => !p.svc);
    if (!id || !S.inv[id]) { if (S.sil) S.sil.car = null; return; }
    if (--S.inv[id] <= 0) { delete S.inv[id]; delete S.garage[id]; }
    if (S.car === id && !S.inv[id]) S.car = bestCar();
    if (S.raceCar === id && !S.inv[id]) S.raceCar = null;
    S.sil.car = null;
  }
  // alt — повторная выдача после списания: автобаза даёт другую модель того же уровня (из линеек всех структур)
  function issueSvcCar(alt) {
    let base = SERVICE_CARS[S.sil.s][S.sil.r];
    if (alt && base) {
      const pool = [...new Set(Object.values(SERVICE_CARS).map(l => l[S.sil.r]).filter(Boolean))].filter(b => svcCarId(b) !== S.sil.lastCar);
      if (pool.length) base = pickOne(pool);
    }
    if (!base) return null;
    dropSvcCar();
    const id = svcCarId(base), plate = SERVICE_PLATES[S.sil.r];
    S.inv[id] = (S.inv[id] || 0) + 1;
    S.sil.car = id;
    S.sil.carAt = Date.now();
    let p;
    if (plate.gov) {
      // своя серия у ведомства; 97-й регион — пока свой не выкуплен (один раз за игру), потом другие московские
      const ser = STR().series, first = !(S.p97 || {})[S.sil.s];
      p = makePlate('mythic', PLATE_REGIONS[0]);
      p.a = ser[0]; p.b = ser.slice(1);
      p.d = '0' + String(1 + Math.floor(Math.random() * 99)).padStart(2, '0');   // «блатной» номер 001–099
      p.r = first ? PLATE_SVC_CODE : pick(PLATE_SVC_REGIONS);
      if (first) p.collect = Math.round((PLATE_97_COLLECT[0] + Math.random() * (PLATE_97_COLLECT[1] - PLATE_97_COLLECT[0])) / 1e6) * 1e6;
    } else p = makePlate(rollPlateRarity({ w: plate }), PLATE_REGIONS[0]);
    for (const x of S.plates) if (x.car === id) x.car = null;
    p.car = id; p.svc = true;
    S.plates.push(p);
    S.raceCar = id;
    return id;
  }
  // Выкуп служебной: машина — от 70% (сержант) до 50% цены (генерал с хорошей репутацией); номер — по цене продажи,
  // а единственный 97-й — по своей цене (коллекционер даст за него миллиард)
  const svcBuyRate = () => SVC_BUY_MAX - (SVC_BUY_MAX - SVC_BUY_MIN - 0.03) * Math.max(0, S.sil.r - 1) / (SERVICE_RANKS.length - 2) - (S.rep >= SVC_BUY_REP ? 0.03 : 0);
  const plateBuy = p => (p.collect ? p.v : Math.round(p.v * PLATE_SELL_RATE));
  const writeoffCost = () => Math.round((ITEM[S.sil.car].value * svcBuyRate() + (svcPlate() ? plateBuy(svcPlate()) : 0)) / 1000) * 1000;
  function doWriteoff(cost, id) {
    if (!svcCar() || S.sil.car !== id || !pay(cost)) return;
    const p = svcPlate(), until = Date.now() + SVC_SELL_LOCK_MIN * 60e3;
    S.lock = S.lock || {};
    S.lock['i:' + id] = until;
    if (p) { p.svc = false; S.lock['p:' + p.id] = until; if (p.collect) (S.p97 = S.p97 || {})[S.sil.s] = true; }
    S.sil.car = null;
    S.sil.lastCar = id;
    S.sil.reissueAt = Date.now() + SVC_REISSUE_H * 3600e3;
    haptic('ok'); toast(`${ITEM[id].name} теперь твоя`); save(); render();
  }
  const sellLock = key => Math.max(0, ((S.lock || {})[key] || 0) - Date.now());
  // Автобаза выдала новую служебную после списания
  function maybeReissue() {
    const sv = S.sil;
    if (!sv || svcCar() || !sv.reissueAt || Date.now() < sv.reissueAt || !SERVICE_CARS[sv.s][sv.r]) return;
    sv.reissueAt = 0;
    const id = issueSvcCar(true);
    save(); render();
    if (id) toast(`🚨 Автобаза выдала новую служебную: ${ITEM[id].name}`);
  }
  const writeoffBlock = () => (S.rep < 0 ? 'нужна репутация не ниже 0'
    : Date.now() - (S.sil.carAt || 0) < SVC_WRITEOFF_H * 3600e3 ? `через ${fmtTime(S.sil.carAt + SVC_WRITEOFF_H * 3600e3 - Date.now())}` : '');
  // Риск сесть на службе: базовый × структура × защита (связи и звания, но не больше SVC_SAFE_MAX)
  const svcRisk = base => Math.round(base * STR().riskMult * (1 - Math.min(SVC_SAFE_MAX, perk('safe')) / 100));
  function repAdd(n) { S.rep = Math.max(-REP_MAX, Math.min(REP_MAX, (S.rep || 0) + (n > 0 ? n * REP_GOOD_MULT : n))); }
  const checksPerDay = () => CHECKS_PER_DAY * Math.pow(2, -S.rep / 50) * (1 - perk('osbCut') / 100);
  const badRep = () => Math.max(0, -S.rep);
  const findChance = () => Math.min(90, svcRisk(S.sil.roofs.reduce((a, id) => a + OSB_PER_ROOF * roofTrait(id).risk, 0) + badRep() * OSB_PER_REP));
  const repBar = () => `<div class="rep-bar"><i style="left:${(S.rep + REP_MAX) / (2 * REP_MAX) * 100}%"></i></div>
        <div class="kv small"><span class="bad">Взяточник</span><b class="${S.rep < -20 ? 'bad' : S.rep > 20 ? 'good' : 'muted'}">${S.rep > 0 ? '+' : ''}${Math.round(S.rep)}</b><span class="good">Честный</span></div>`;
  function scheduleCheck() { S.sil.nextCheck = Date.now() + 24 / checksPerDay() * (0.6 + Math.random() * 0.8) * 3600e3; }
  const smallBiz = id => BUSINESSES.findIndex(d => d.id === id) <= SERVICE_BIZ_TIER;
  function joinBlock() {
    if (Date.now() < S.silBan) return `Вернуться на службу можно через ${fmtTime(S.silBan - Date.now())}.`;
    if (Object.keys(S.biz).some(id => !smallBiz(id))) return `Госслужащему можно держать только мелкий бизнес (до «${BUSINESSES[SERVICE_BIZ_TIER].name}») — остальное продай.`;
    if (S.gig) return 'Сначала закончи подработку.';
    return '';
  }
  function nextMission() {
    const pool = MISSIONS.filter(m => m.who.includes(S.sil.s) && m.id !== S.sil.last);
    S.sil.mission = pick(pool).id;
  }
  // Попался: суд, конфискация, навыки проседают, со службы — уволен
  // Попался: дело можно попробовать «замять» звонком сильной связи (один звонок), иначе — суд
  const rescuers = () => Object.keys(S.conn).filter(id => ITEM[id] && RESCUE_BASE[ITEM[id].rarity]);
  const rescueChance = id => Math.min(95, RESCUE_BASE[ITEM[id].rarity] + RESCUE_PER_LV * (connLv(id) - 1));
  const rescueFee = () => Math.round(Math.max(S.money * RESCUE_FEE, rankMonth()) / 1000) * 1000;
  function caught(why) {
    S.sil.caught = why;
    haptic('err'); save(); render();
    showCaught();
  }
  function showCaught() {
    const why = S.sil.caught, list = rescuers();
    showModal(`<div class="drop"><div class="drop-name bad">🚨 Взяли с поличным</div>
      <p style="margin-top:8px">${why}</p>
      <p class="small">Впереди суд: конфискация ${Math.round(JAIL_MONEY * 100)}% денег, навыки −${Math.round(JAIL_SKILLS * 100)}%, увольнение.
        ${list.length ? 'Можно один раз позвонить влиятельной связи — вдруг замнёт.' : 'Влиятельных связей (прокурор, судья, депутат и выше) нет — помочь некому.'}</p>
      <div class="choice">
        ${list.map(id => `<button class="btn btn-line" data-action="rescue" data-id="${id}">Позвонить: ${ITEM[id].name}
          <span class="small">шанс ${rescueChance(id)}% · «благодарность» ${fmt(rescueFee())} ₽</span></button>`).join('')}
        <button class="btn btn-danger" data-action="rescue" data-id="">Принять приговор</button>
      </div></div>`);
  }
  function goToJail(why) {
    const lost = Math.round(S.money * JAIL_MONEY);
    S.money -= lost;
    for (const k of Object.keys(S.skills)) S.skills[k] = Math.floor(S.skills[k] * (1 - JAIL_SKILLS));
    const was = `${svcRank().name} ${STR().name}`;
    dropSvcCar();
    S.sil = null;
    S.silBan = Date.now() + SERVICE_JAIL_COOLDOWN_H * 3600e3;
    repAdd(-20);
    S.jailed++;
    haptic('err'); save(); render();
    showModal(`<div class="drop"><div class="drop-name">⛓️ Попался</div>
      <p style="margin-top:8px">${why}</p>
      <p class="small">Суд: условный срок, ${was} — уволен со службы. Конфискация <b>${fmt(lost)} ₽</b>, навыки просели на ${Math.round(JAIL_SKILLS * 100)}%.
        Вернуться на службу — не раньше чем через ${SERVICE_JAIL_COOLDOWN_H / 24} сут.</p>
      <button class="btn full" data-action="close">Начать с чистого листа</button></div>`);
  }
  // Служебные проверки: чем хуже репутация и больше «крыш», тем чаще приходят и тем чаще что-то находят
  function maybeOsb() {
    if (!S.sil) return;
    if (!S.sil.nextCheck) { scheduleCheck(); save(); }
    if (!S.sil.osb && !S.sil.clean && Date.now() >= S.sil.nextCheck) {
      scheduleCheck();
      if (Math.random() * 100 < findChance()) S.sil.osb = true;
      else { svcXpAdd(OSB_CLEAN_XP); repAdd(3); S.sil.clean = true; }
      save();
    }
    if (!$('#modal').classList.contains('hidden')) return;
    if (S.sil.caught) showCaught();
    else if (S.sil.osb) showOsb();
    else if (S.sil.clean) {
      S.sil.clean = false;
      save(); render();
      showModal(`<div class="drop"><div class="drop-name">🗂️ Служебная проверка</div>
        <p style="margin-top:8px">Проверяющие перерыли твои дела и ничего не нашли.</p>
        <div class="big">+${OSB_CLEAN_XP} опыта</div>
        <button class="btn full" data-action="close">Служу честно</button></div>`);
    }
  }
  const osbPayoff = () => Math.round(Math.max(roofIncome() * OSB_PAYOFF_MONTHS, rankMonth() * 3) / 1000) * 1000;
  const denyRisk = () => Math.min(90, svcRisk(OSB_DENY_JAIL + badRep() * OSB_PER_REP));
  function showOsb() {
    const pay = osbPayoff();
    const top = S.sil.roofs.slice().sort((x, y) => roofPay(y) - roofPay(x))[0];
    showModal(`<h3>🕴️ Служебная проверка</h3>
      <p>${S.sil.roofs.length ? 'Проверяющие заинтересовались, почему бизнесмены так тебя любят.' : 'Проверяющие нашли «нестыковки» в твоих делах.'} Нужно решать.</p>
      <div class="choice">
        <button class="btn" data-action="osb" data-id="pay" ${S.money < pay ? 'disabled' : ''}>Занести «кому надо»<span class="small">${fmt(pay)} ₽ — вопрос закрыт, репутация хуже</span></button>
        ${top ? `<button class="btn btn-ghost" data-action="osb" data-id="give">Отдать «крышу»<span class="small">${BIZ[top].icon} ${BIZ[top].name} — больше не твоя</span></button>`
          : `<button class="btn btn-ghost" data-action="osb" data-id="reprimand">Принять выговор<span class="small">−100 служебного опыта</span></button>`}
        <button class="btn btn-danger" data-action="osb" data-id="deny">Пойти в отказ<span class="small">${denyRisk()}% — сесть</span></button>
      </div>`);
  }

  // ---------- карьера ----------
  const connAlert = () => !cdLeft(CASE.conn_free) || !!S.favor || !!(S.deal && Date.now() >= S.deal.until);
  function renderCareer() {
    const v = sub.career;
    const gigReady = S.gig && Date.now() >= S.gig.until;
    const missionReady = S.sil && Date.now() >= S.sil.nextMission;
    return `<div class="seg seg-scroll">
        <button class="${v === 'jobs' ? 'active' : ''}" data-sub="career:jobs">${S.sil ? `Служба${missionReady ? ' <span class="dotty">•</span>' : ''}` : 'Работа'}</button>
        ${S.sil ? `<button class="${v === 'spec' ? 'active' : ''}" data-sub="career:spec">Спецзадания${specReady() ? ' <span class="dotty">•</span>' : ''}</button>` : ''}
        <button class="${v === 'skills' ? 'active' : ''}" data-sub="career:skills">Учёба</button>
        ${S.sil ? '' : `<button class="${v === 'gigs' ? 'active' : ''}" data-sub="career:gigs">Подработки${gigReady ? ' <span class="dotty">•</span>' : ''}</button>`}
        <button class="${v === 'race' ? 'active' : ''}" data-sub="career:race">Гонки</button>
        <button class="${v === 'conn' ? 'active' : ''}" data-sub="career:conn">Связи${connAlert() ? ' <span class="dotty">•</span>' : ''}</button></div>
      ${v === 'jobs' ? (S.sil ? renderService() : renderJobs()) : v === 'spec' && S.sil ? renderSpec() : v === 'skills' ? renderSkills() : v === 'gigs' && !S.sil ? renderGigs() : v === 'race' ? renderRace() : renderConn()}`;
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
      <div class="grow"><div class="job-name">${j.name}</div><div class="job-pay">${fmt(ph(j.pay))} ₽/ч</div>
        ${bonus ? `<div class="perk">${ic('star')} ${bonus}</div>` : ''}${!ok && !cur && reqs ? `<div class="reqs">${reqs}</div>` : ''}</div>
      ${action}</div>`;
  }
  function svcCarCard() {
    const id = svcCar(), r = S.sil.r;
    const race = r >= SERVICE_NO_RACE ? 'гонки не по статусу, зато мигалка: проблемы с машиной обходят стороной'
      : r >= SERVICE_OWN_RACE_UNTIL ? 'гонки — только на ней, ГИБДД не трогает' : 'пока гоняешь на своих (подпольные гонки — до лейтенанта)';
    if (!id) {
      const line = SERVICE_CARS[S.sil.s], next = Object.keys(line).map(Number).find(k => k > r);
      return `<div class="card small muted">${ic('car')} ${S.sil.reissueAt ? `Служебную ты списал на себя. Новую автобаза выдаст через <span data-timer="${S.sil.reissueAt}">${fmtTime(S.sil.reissueAt - Date.now())}</span> — другую модель того же уровня.`
        : next !== undefined ? `Служебная машина — со звания «${SERVICE_RANKS[next].name}»: ${ITEM[line[next]].name}.` : 'Служебной машины сейчас нет.'}
        <br>${race}.</div>`;
    }
    const block = writeoffBlock();
    const top = r >= 9;
    return `<div class="card"><div class="row"><div class="inv-icon svc-car">${visual(ITEM[id])}</div>
        <div class="grow"><div class="val">${ITEM[id].name}${top ? ' · кортеж' : ''}</div><div>${svcPlate() ? plateHTML(svcPlate(), 'sm') : ''}</div>
          <div class="small muted">${race}</div></div></div>
      <button class="btn btn-sm btn-ghost full" style="margin-top:8px" data-action="svc-writeoff" ${block ? 'disabled' : ''}>
        Выкупить себе · ${fmt(writeoffCost())} ₽${block ? ` <span class="small">(${block})</span>` : ''}</button></div>`;
  }
  // ---------- спецзадания: расследование для всех; перехват и штурм у МВД и ФСБ, суд и проверка у прокуратуры ----------
  const specLeft = t => Math.max(0, ((S.sil.specCd || {})[t] || 0) - Date.now());
  const specList = () => Object.entries(SPEC_TYPES).filter(([, T]) => !T.only || T.only.includes(S.sil.s));   // у каждого ведомства свои
  const specReady = () => !!S.sil && (!!S.sil.spec || specList().some(([t]) => !specLeft(t)));
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  const specPrize = () => round2(servicePay() * SPEC_MONEY);
  function renderSpec() {
    const sv = S.sil, cur = sv.spec && SPEC_TYPES[sv.spec.t];
    const card = (t, T) => {
      const left = specLeft(t);
      const btn = sv.spec ? (sv.spec.t === t ? `<button class="btn full" data-action="spec-open">Продолжить</button>` : `<div class="small muted">Сначала закончи текущее задание</div>`)
        : left ? `<div class="small muted">${ic('clock')} Снова через <span data-timer="${sv.specCd[t]}">${fmtTime(left)}</span></div>`
        : `<button class="btn full" data-action="spec-start" data-id="${t}">Начать</button>`;
      return `<div class="card ${!left && !sv.spec || (cur && sv.spec.t === t) ? 'accent' : ''}"><div class="big-text">${T.icon} ${T.name}</div>
        <p class="small" style="margin:6px 0 10px">${T.desc}</p>${btn}</div>`;
    };
    return `<p class="hint">Три вида заданий своего ведомства, у каждого свой откат — ${SPEC_COOLDOWN_MIN} мин. Без взяток: только голова и руки.
        Справился — премия до ${fmt(round2(specPrize() * 1.3))} ₽ (${SPEC_MONEY} оклада × качество), служебный опыт и репутация +${SPEC_REP * REP_GOOD_MULT}. Провалил — ничего.</p>
      ${specList().map(([t, T]) => card(t, T)).join('')}`;
  }
  // Расследование: подозреваемые с признаками; у каждого невиновного хотя бы один признак отличается от преступника
  function genInv() {
    const names = SUSPECT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    const rnd = () => Object.fromEntries(INV_ATTRS.map(a => [a.k, pickOne(a.vals)]));
    const culprit = rnd(), sus = [], key = o => INV_ATTRS.map(a => o[a.k]).join('|');
    const seen = new Set([key(culprit)]);
    while (sus.length < 4) {
      const o = rnd();
      // похожие на преступника по 2–3 признакам — чтобы улики приходилось выбирать с умом
      INV_ATTRS.forEach(a => { if (Math.random() < 0.55) o[a.k] = culprit[a.k]; });
      if (seen.has(key(o))) continue;
      seen.add(key(o)); sus.push(o);
    }
    const c = Math.floor(Math.random() * 5);
    sus.splice(c, 0, culprit);
    return { t: 'inv', sus: sus.map((a, i) => ({ n: names[i], a })), c, time: INV_TIME, known: {}, ruled: [] };
  }
  const invOut = (sp, i) => sp.ruled.includes(i) || Object.entries(sp.known).some(([k, v]) => sp.sus[i].a[k] !== v);
  function viewInv(sp) {
    const dots = Array.from({ length: INV_TIME }, (_, i) => `<i class="${i < sp.time ? 'on' : ''}"></i>`).join('');
    const clues = INV_ATTRS.filter(a => sp.known[a.k]).map(a => `<div class="small">${ic('point')} ${a.clue(sp.known[a.k])}</div>`).join('')
      + (sp.ruled.length ? `<div class="small">${ic('point')} ДНК исключила: ${sp.ruled.map(i => sp.sus[i].n).join(', ')}</div>` : '');
    const acts = INV_ATTRS.map(a => `<button class="btn btn-sm btn-ghost" data-action="inv-act" data-id="${a.k}" ${sp.known[a.k] || sp.time < 1 ? 'disabled' : ''}>${ic(a.icon)} ${a.act}</button>`).join('')
      + `<button class="btn btn-sm btn-ghost" data-action="inv-act" data-id="dna" ${sp.dna || sp.time < 2 ? 'disabled' : ''}>${ic('dna')} ДНК-экспертиза · 2 действия</button>`;
    const cards = sp.sus.map((x, i) => `<div class="card sus ${invOut(sp, i) ? 'out' : ''}"><div class="row"><div class="grow"><b>${x.n}</b>
        <div class="small muted">${INV_ATTRS.map(a => x.a[a.k]).join(' · ')}</div></div>
        <button class="btn btn-sm ${invOut(sp, i) ? 'btn-ghost' : ''}" data-action="inv-arrest" data-id="${i}">Задержать</button></div></div>`).join('');
    return `${sheetHead('🔎 Расследование')}
      <p class="small">Ночью обчистили сейф ювелирного. Подозреваемых пятеро. До утра — ${INV_TIME} следственных действия. Чем меньше потратишь, тем выше награда.</p>
      <div class="kv small"><span>Время до утра</span><span class="tank inv-time">${dots}</span></div>
      ${clues ? `<div class="card">${clues}</div>` : ''}
      <div class="inv-acts">${acts}</div>
      <div class="section">Подозреваемые</div>${cards}`;
  }
  // Перехват: беглец идёт к краю по кратчайшему пути, ты ставишь по одному посту за ход
  function genChase() {
    const N = CHASE_SIZE, g = new Array(N * N).fill(0), mid = Math.floor(N * N / 2);
    let placed = 0;
    while (placed < CHASE_BLOCKS) {
      const i = Math.floor(Math.random() * N * N), x = i % N, y = Math.floor(i / N);
      if (g[i] || Math.abs(x - 4) + Math.abs(y - 4) < 2) continue;
      g[i] = 1; placed++;
    }
    return { t: 'chase', g, x: mid, turns: 0 };
  }
  const chaseNb = i => { const N = CHASE_SIZE, x = i % N, y = Math.floor(i / N); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a); };
  const chaseEdge = i => { const N = CHASE_SIZE, x = i % N, y = Math.floor(i / N); return x === 0 || y === 0 || x === N - 1 || y === N - 1; };
  // Расстояние от каждой клетки до края (через свободные клетки)
  function chaseDist(g) {
    const d = new Array(g.length).fill(Infinity), q = [];
    g.forEach((v, i) => { if (!v && chaseEdge(i)) { d[i] = 0; q.push(i); } });
    while (q.length) { const i = q.shift(); for (const j of chaseNb(i)) if (!g[j] && d[j] === Infinity) { d[j] = d[i] + 1; q.push(j); } }
    return d;
  }
  function viewChase(sp) {
    const cells = sp.g.map((v, i) => i === sp.x ? '<span class="cc target">🚗</span>'
      : v === 1 ? '<span class="cc block"></span>' : v === 2 ? '<span class="cc post">🚓</span>'
      : chaseEdge(i) ? '<span class="cc exit"></span>'
      : `<button class="cc free" data-action="ch-cell" data-id="${i}"></button>`).join('');
    return `${sheetHead('🚓 Перехват')}
      <p class="small">Беглец на 🚗 рвётся к краю карты. Каждый ход ставь пост 🚓 на свободный перекрёсток — потом он делает шаг. Красные клетки по краю — выезды из города: он уйдёт, если доберётся до любой, а ставить посты на них нельзя. Отрежь все пути к выездам — и он твой.<br><span class="muted">Совет: пост прямо перед машиной она просто объедет — перекрывай на шаг-два вперёд.</span></p>
      <div class="kv small"><span>Постов выставлено</span><b>${sp.turns}</b></div>
      <div class="chase-grid" style="--n:${CHASE_SIZE}">${cells}</div>`;
  }
  // Штурм (ФСБ): здание из комнат-веток, три канала разведки, своё снаряжение и шум
  function genRaid() {
    const acc = Math.min(0.88, 0.62 + S.skills.int * 0.012), types = Object.keys(RAID_THREATS);
    const roll = () => { let x = Math.random() * types.reduce((a, k) => a + RAID_THREATS[k].w, 0); for (const k of types) if ((x -= RAID_THREATS[k].w) < 0) return k; return 'single'; };
    const names = RAID_ROOM_NAMES.slice().sort(() => Math.random() - 0.5), rooms = [];
    let gear = Object.keys(RAID_GEAR).filter(k => k !== 'sapper').sort(() => Math.random() - 0.5).filter((k, i, a) => !(k === 'flash1' && a.includes('flash'))).slice(0, 3);
    for (let i = 0; i < RAID_ROOMS; i++) {
      let type = roll();
      if (type === 'trap' && rooms.some(r => r.type === 'trap')) type = 'empty';
      if (type === 'hostage' && rooms.filter(r => r.type === 'hostage').length >= 2) type = 'single';
      const fake = () => RAID_THREATS[pickOne(types.filter(t => t !== type))];
      const ch = k => (Math.random() < acc ? RAID_THREATS[type] : fake())[k];
      rooms.push({ n: names[i], type, from: i ? Math.floor(Math.random() * i) : -1, done: false, res: '',
        sound: ch('sound'), heat: ch('heat'), door: ch('door'), show: ['sound', 'heat', 'door'].sort(() => Math.random() - 0.5).slice(0, 2) });
    }
    if (rooms.some(r => r.type === 'trap')) gear = ['sapper', ...gear.slice(0, 2)];
    const uses = {}, sp = { t: 'raid', v: 3, rooms, cur: null, hp: RAID_HP, lost: 0, saved: 0, noise: 0, drones: 0, thermal: false, uses, gear, acc, log: [] };
    for (const g of gear) { const G = RAID_GEAR[g]; if (G.act) uses[G.act] = (uses[G.act] || 0) + G.n; if (G.drone) sp.drones += G.drone; if (G.thermal) sp.thermal = true; }
    if (sp.thermal) rooms.forEach(r => { r.heat = RAID_THREATS[r.type].heat; if (!r.show.includes('heat')) r.show.push('heat'); });
    return sp;
  }
  const raidOpen = (sp, i) => !sp.rooms[i].done && (sp.rooms[i].from < 0 || sp.rooms[sp.rooms[i].from].done);
  function raidClues(r) {
    const T = RAID_THREATS[r.type];
    const v = r.sure ? { sound: T.sound, heat: T.heat, door: T.door } : r;
    const heat = h => (h >= 3 ? '3 и больше' : h);
    return `${r.sure ? `<div class="small good">${ic('drone')} Дрон: ${T.name}</div>` : ''}
      <div class="small">${ic('ear')} ${r.sure || r.show.includes('sound') ? v.sound : '<span class="muted">не слышно</span>'}</div>
      <div class="small">${ic('temperature')} ${r.sure || r.show.includes('heat') ? `людей: ${heat(v.heat)}` : '<span class="muted">тепловизора нет</span>'}</div>
      <div class="small">${ic('door')} ${r.sure || r.show.includes('door') ? v.door : '<span class="muted">к двери не подобраться</span>'}</div>`;
  }
  function viewRaid(sp) {
    if (sp.v !== 3) return `${sheetHead('🛡️ Штурм')}<p>Это задание устарело.</p>`;
    const noise = Array.from({ length: RAID_ALARM }, (_, i) => `<i class="${i < sp.noise ? 'on' : ''}"></i>`).join('');
    const gear = `<div class="small muted" style="margin:4px 0 8px">${ic('backpack')} ${sp.gear.map(g => RAID_GEAR[g].name).join(' · ')}</div>`;
    const head = `${sheetHead('🛡️ Штурм')}
      <div class="kv small"><span>Ранено: ${RAID_HP - sp.hp} из ${RAID_HP} · спасено: ${sp.saved}${sp.lost ? ` · погибло: ${sp.lost}` : ''}</span>
        <span>Шум <span class="tank inv-time raid-noise">${noise}</span></span></div>${gear}`;
    const log = sp.log.length ? `<div class="card small">${sp.log.slice(-3).map(l => `<div>${l}</div>`).join('')}</div>` : '';
    if (sp.cur !== null) {
      const r = sp.rooms[sp.cur];
      const acts = Object.entries(RAID_ACTIONS).filter(([k]) => k === 'quiet' || k === 'storm' || sp.uses[k] !== undefined).map(([k, A]) => {
        const left = sp.uses[k];
        return `<button class="btn ${left === 0 ? 'btn-ghost' : ''}" data-action="raid-act" data-id="${k}" ${left === 0 ? 'disabled' : ''}>${ic(A.icon)} ${A.name}${left !== undefined ? ` ×${left}` : ''}
          <span class="small" style="display:block;opacity:.75">${A.loud ? 'громко · ' : ''}подходит: ${A.ok.map(t => RAID_THREATS[t].name).join(', ')}</span></button>`;
      }).join('');
      return `${head}<div class="card accent"><div class="big-text">${r.n}</div>${raidClues(r)}
          ${r.sure || !sp.gear.includes('drone') ? '' : `<button class="btn btn-sm btn-ghost full" style="margin-top:8px" data-action="raid-drone" ${sp.drones ? '' : 'disabled'}>${ic('drone')} Пустить дрон · ${sp.drones}</button>`}</div>
        <div class="raid-acts">${acts}</div>
        <button class="btn btn-ghost btn-sm full" data-action="raid-pick" data-id="-1">${ic('arrow-left')} К плану здания</button>
        <p class="small muted" style="margin-top:8px">Разведка верна примерно в ${Math.round(sp.acc * 100)}% случаев по каждому каналу. ${sp.noise >= RAID_ALARM ? '<b class="bad">Тревога: бандиты настороже — тихо к заложникам уже не пройти, одиночки собрались в банды.</b>' : `Громкие способы поднимают шум: на ${RAID_ALARM}-м бандиты насторожатся.`}</p>${log}`;
    }
    const cards = sp.rooms.map((r, i) => {
      const open = raidOpen(sp, i);
      if (r.done) return `<div class="card sus out"><b>${r.n}</b><div class="small">${r.res}</div></div>`;
      if (!open) return `<div class="card sus out"><b>${r.n}</b><div class="small muted">${ic('lock')} проход через «${sp.rooms[r.from].n}»</div></div>`;
      return `<div class="card"><div class="row"><div class="grow"><b>${r.n}</b>${raidClues(r)}</div>
        <button class="btn btn-sm" data-action="raid-pick" data-id="${i}">Войти</button></div></div>`;
    }).join('');
    return `${head}<p class="small">Здание — как дерево: открыты только комнаты рядом с зачищенными. Выбирай порядок с умом.</p>${cards}${log}`;
  }
  // Суд: дело собрано случайно, в папке улики; уловку бьёт улика, которая её опровергает по смыслу
  const ctrick = id => COURT_TRICKS.find(x => x.id === id);
  const ccard = id => COURT_CARDS.find(x => x.id === id);
  function genCourt() {
    const tricks = COURT_TRICKS.slice().sort(() => Math.random() - 0.5).slice(0, COURT_ROUNDS).map(t => ({ id: t.id, line: pickOne(t.text) }));
    const pool = COURT_CARDS.slice().sort(() => Math.random() - 0.5), hand = [];
    tricks.slice().sort(() => Math.random() - 0.5).slice(0, COURT_WIN + 1).forEach(t => {
      const need = ctrick(t.id).need, c = pool.find(c => !hand.includes(c.id) && c.tags.some(g => need.includes(g)));
      if (c) hand.push(c.id);
    });
    for (const c of pool) if (hand.length < COURT_HAND && !hand.includes(c.id)) hand.push(c.id);
    hand.sort(() => Math.random() - 0.5);
    return { t: 'court', v: 2, charge: pickOne(COURT_CHARGES), who: pickOne(COURT_DEFENDANTS), lawyer: pickOne(COURT_LAWYERS), tricks, hand, i: 0, win: 0, lose: 0, obj: COURT_OBJECTIONS, log: [] };
  }
  function viewCourt(sp) {
    if (sp.v !== 2) return `${sheetHead('⚖️ Суд')}<p>Это задание устарело.</p>`;
    const r = sp.tricks[sp.i], next = sp.tricks[sp.i + 1];
    const cards = sp.hand.map(id => { const c = ccard(id); return `<button class="btn btn-ghost court-card" data-action="court-move" data-id="${id}"><b>${c.name}</b><span class="small">${c.text}</span></button>`; }).join('');
    return `${sheetHead('⚖️ Суд')}
      <p class="small">Подсудимый — <b>${sp.who}</b>, обвинение: ${sp.charge}. Защищает — <b>${sp.lawyer}</b>.</p>
      <div class="kv small"><span>Раунд ${sp.i + 1} из ${COURT_ROUNDS}</span><span>Присяжные: ${sp.win} за тебя · ${sp.lose} против</span></div>
      <div class="card accent"><div class="small muted">${sp.lawyer}:</div><div class="big-text">${r.line}</div></div>
      ${next ? `<p class="small muted">${ic('eye')} Следом адвокат готовит: ${next.line}</p>` : ''}
      <div class="section">Твоя папка — какая улика это опровергнет?</div>
      <div class="court-hand">${cards}</div>
      <div class="row" style="margin-top:8px"><button class="btn btn-line btn-sm grow" data-action="court-move" data-id="obj" ${sp.obj ? '' : 'disabled'}>${ic('hand-stop')} «Протест!» ×${sp.obj}</button>
        <button class="btn btn-ghost btn-sm grow" data-action="court-move" data-id="pass">Уступить раунд</button></div>
      <p class="small muted" style="margin-top:6px">Улика тратится. Нужно выиграть ${COURT_WIN} раунда из ${COURT_ROUNDS}. «Протест!» бьёт что угодно, но он один.</p>
      ${sp.log.length ? `<div class="card small">${sp.log.slice(-3).map(l => `<div>${l}</div>`).join('')}</div>` : ''}`;
  }
  function courtStep(sp, k) {
    if (sp.v !== 2) return;
    const r = sp.tricks[sp.i], need = ctrick(r.id).need;
    let ok = false, txt = '';
    if (k === 'obj') { if (!sp.obj) return; sp.obj--; ok = true; txt = '«Протест принят!» — судья стучит молотком'; }
    else if (k === 'pass') txt = 'Ты промолчал. Присяжные решили, что адвокат прав';
    else {
      if (!sp.hand.includes(k)) return;
      const c = ccard(k); sp.hand = sp.hand.filter(x => x !== k);
      ok = c.tags.some(g => need.includes(g));
      txt = ok ? `«${c.name}» — ${pickOne(['адвокат покраснел', 'зал ахнул', 'присяжные закивали', 'подсудимый сполз под стол'])}` : `«${c.name}» — не в тему, присяжные зевнули`;
    }
    if (ok) sp.win++; else sp.lose++;
    sp.log.push(`${ok ? '✅' : '❌'} Раунд ${sp.i + 1}: ${txt}`);
    sp.i++;
    haptic(ok ? 'light' : 'err');
    if (sp.win >= COURT_WIN) return finishSpec(0.8 + 0.12 * (sp.win - sp.lose) + 0.05 * sp.hand.length + 0.1 * sp.obj,
      `Виновен! ${sp.who} отправляется подумать о жизни (${sp.win}:${sp.lose}). ${sp.lawyer} уже пишет апелляцию на салфетке.`);
    if (sp.lose > COURT_ROUNDS - COURT_WIN) return finishSpec(0, `Оправдан. ${sp.who} уходит из зала под ручку с тётей-свидетельницей (${sp.win}:${sp.lose}).`);
    save(); openSpec();
  }
  // Допрос (МВД): половина рассказа — враньё; три запроса проверяют темы; два противоречия — признание
  function genQuiz() {
    const acc = Math.min(0.85, 0.6 + S.skills.int * 0.012);
    const lies = new Set(INT_TOPICS.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, INT_LIES));
    const st = INT_TOPICS.map((T, i) => {
      const said = pickOne(T.vals), lie = lies.has(i);
      return { said, truth: lie ? pickOne(T.vals.filter(v => v !== said)) : said, lie, checked: false, caught: false,
        tell: Math.random() < (lie ? acc : 1 - acc) ? pickOne(INT_TELLS) : '' };
    });
    return { t: 'quiz', crime: pickOne(INT_CRIMES), who: pickOne(INT_SUSPECTS), st, req: INT_REQUESTS, found: 0, acc };
  }
  function viewQuiz(sp) {
    const rows = sp.st.map((x, i) => {
      const T = INT_TOPICS[i];
      const fact = x.checked ? (x.lie ? `<div class="small bad">${ic('file-alert')} ${T.req}: на самом деле — ${x.truth}</div>` : `<div class="small good">${ic('file-check')} ${T.req}: подтверждается</div>`) : '';
      const btn = x.caught ? `<span class="tag good">${ic('check')} уличён</span>`
        : x.checked && x.lie ? `<button class="btn btn-sm btn-danger" data-action="quiz-catch" data-id="${i}">Уличить</button>`
        : x.checked ? '' : `<button class="btn btn-sm btn-ghost" data-action="quiz-check" data-id="${i}" ${sp.req ? '' : 'disabled'}>Проверить</button>`;
      return `<div class="card sus ${x.checked && !x.lie ? 'out' : ''}"><div class="row"><div class="grow">
          <div class="small muted">${T.q}</div><b>«${x.said}»</b>${x.tell ? ` <span class="small gold">— ${x.tell}</span>` : ''}${fact}</div>${btn}</div></div>`;
    }).join('');
    return `${sheetHead('🗣️ Допрос')}
      <p class="small">Подозреваемый — ${sp.who}, дело про ${sp.crime}. Рассказывает складно, но половина — враньё.</p>
      <div class="kv small"><span>Запросов осталось: ${sp.req}</span><span>Противоречий: ${sp.found} из ${INT_NEED}</span></div>
      <p class="small muted">Следи, где он нервничает — это подсказка, но не всегда честная (верна примерно в ${Math.round(sp.acc * 100)}% случаев).</p>
      ${rows}`;
  }
  function quizStep(sp, kind, i) {
    const x = sp.st[i];
    if (!x) return;
    if (kind === 'check') {
      if (x.checked || !sp.req) return;
      x.checked = true; sp.req--;
      haptic(x.lie ? 'light' : 'err');
    } else {
      if (!x.checked || !x.lie || x.caught) return;
      x.caught = true; sp.found++;
      haptic('ok');
      if (sp.found >= INT_NEED) return finishSpec(1 + 0.12 * sp.req + (sp.st.filter(y => y.lie && y.checked).length > INT_NEED ? 0.1 : 0),
        `${sp.who} поплыл: «Ладно, ладно, это был я! Только маме не говорите».`);
    }
    const canWin = sp.found + sp.st.filter(y => y.lie && y.checked && !y.caught).length + sp.req >= INT_NEED;
    if (!canWin) return finishSpec(0, `Запросы кончились, а ${sp.who} держится. Адвокат уводит его со словами «до новых встреч».`);
    save(); openSpec();
  }
  // Проверка компании: девять документов, в трёх нарушения; метка аналитика верна не всегда; пять проверок
  function genAudit() {
    const acc = Math.min(0.9, AUDIT_ACC + S.skills.int * 0.005);
    const titles = AUDIT_TITLES.slice().sort(() => Math.random() - 0.5).slice(0, AUDIT_DOCS);
    const bad = new Set(Array.from({ length: AUDIT_DOCS }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, AUDIT_BAD));
    const docs = titles.map((t, i) => ({ t, bad: bad.has(i), flag: Math.random() < acc ? bad.has(i) : !bad.has(i), open: false }));
    return { t: 'audit', docs, checks: AUDIT_CHECKS, found: 0, acc };
  }
  function viewAudit(sp) {
    const cards = sp.docs.map((d, i) => `<div class="card sus ${d.open && !d.bad ? 'out' : ''}"><div class="row"><div class="grow">
        <b>${d.open ? (d.bad ? '🚩 ' : '✔️ ') : d.flag ? '⚠️ ' : ''}${d.t}</b>
        <div class="small muted">${d.open ? d.note : d.flag ? 'аналитик: подозрительно' : 'аналитик: вроде чисто'}</div></div>
        ${d.open ? '' : `<button class="btn btn-sm" data-action="audit-open" data-id="${i}" ${sp.checks ? '' : 'disabled'}>Проверить</button>`}</div></div>`).join('');
    return `${sheetHead('📂 Проверка компании')}
      <div class="kv small"><span>Проверок осталось: ${sp.checks}</span><span>Нарушений найдено: ${sp.found} из ${AUDIT_BAD}</span></div>
      <p class="small">Аналитик пометил подозрительное ⚠️, но прав примерно в ${Math.round(sp.acc * 100)}% случаев. Найди все ${AUDIT_BAD} нарушения за ${AUDIT_CHECKS} проверок — чем меньше потратишь, тем больше премия. Найдёшь два — тоже засчитают, но скромнее.</p>
      ${cards}`;
  }
  function auditStep(sp, i) {
    const d = sp.docs[i];
    if (!d || d.open || !sp.checks) return;
    d.open = true; sp.checks--;
    d.note = pickOne(d.bad ? AUDIT_BAD_TEXT : AUDIT_OK_TEXT);
    if (d.bad) sp.found++;
    haptic(d.bad ? 'light' : 'err');
    if (sp.found >= AUDIT_BAD) return finishSpec(1 + 0.1 * sp.checks, `Все ${AUDIT_BAD} нарушения в деле. Директор говорит, что «это всё бухгалтер», бухгалтер — что «это всё Мальдивы».`);
    if (!sp.checks) return sp.found >= AUDIT_BAD - 1 ? finishSpec(0.6, `Нашёл ${sp.found} нарушения из ${AUDIT_BAD}. Компанию оштрафовали, но третье они успели прогнать через шредер.`)
      : finishSpec(0, `Нашёл только ${sp.found}. Компания отделалась лёгким испугом и прислала тебе открытку «Спасибо за проверку!».`);
    save(); openSpec();
  }
  function openSpec() {
    const sp = S.sil && S.sil.spec;
    if (!sp) return;
    showModal(({ inv: viewInv, chase: viewChase, raid: viewRaid, court: viewCourt, audit: viewAudit, quiz: viewQuiz })[sp.t](sp), true);
  }
  function raidStep(sp, k) {
    const room = sp.cur !== null && sp.rooms[sp.cur], A = RAID_ACTIONS[k];
    if (!room || !A || room.done) return;
    if (sp.uses[k] !== undefined) { if (!sp.uses[k]) return; sp.uses[k]--; }
    else if (k !== 'quiet' && k !== 'storm') return;
    const alarm = sp.noise >= RAID_ALARM;
    const ok = A.ok.includes(room.type) && !(alarm && room.type === 'hostage' && k === 'quiet');
    const what = RAID_THREATS[room.type].name;
    if (ok) { if (room.type === 'hostage') sp.saved++; room.res = `✅ ${A.name.toLowerCase()} — ${room.type === 'hostage' ? 'заложник спасён' : room.type === 'empty' ? 'пусто, чисто' : what + ' — обезврежено'}`; }
    else if (room.type === 'hostage') { sp.lost++; room.res = `❌ ${A.name.toLowerCase()} — заложника спасти не удалось`; }
    else { sp.hp--; room.res = `🩸 ${A.name.toLowerCase()} — там ${what}, боец ранен`; }
    sp.log.push(`${room.n}: ${room.res}`);
    room.done = true; sp.cur = null;
    if (A.loud) {
      sp.noise++;
      if (sp.noise === RAID_ALARM) {
        sp.rooms.forEach(r => { if (!r.done && r.type === 'single') r.type = 'group'; });
        sp.log.push('🚨 Шум услышали: бандиты настороже и собираются вместе');
      }
    }
    haptic(ok ? 'light' : 'err');
    if (sp.hp <= 0) return finishSpec(0, 'Трое раненых — группу отозвали, штурм сорван.');
    if (sp.rooms.every(r => r.done)) {
      if (sp.lost >= 2) return finishSpec(0, `Здание взяли, но погибли ${sp.lost} заложника. Операцию признали проваленной.`);
      const spare = Object.values(sp.uses).reduce((a, b) => a + b, 0) + sp.drones;
      return finishSpec(Math.max(0.5, 1.15 - 0.15 * (RAID_HP - sp.hp) - 0.3 * sp.lost + 0.04 * spare - 0.05 * Math.max(0, sp.noise - 1)),
        `Здание зачищено. Раненых ${RAID_HP - sp.hp}, заложников спасено ${sp.saved}${sp.lost ? `, погиб ${sp.lost}` : ''}. Шума: ${sp.noise}.`);
    }
    save(); openSpec();
  }
  // Итог спецзадания. quality 0 — провал: ни денег, ни опыта. Иначе 0,5…1,3: премия, служебный опыт, репутация.
  function finishSpec(quality, text) {
    const sv = S.sil, t = sv.spec.t, ok = quality > 0;
    const money = ok ? round2(specPrize() * quality) : 0, want = ok ? Math.round(SPEC_XP * quality) : 0;
    let xp = want;
    const rep = ok ? SPEC_REP * REP_GOOD_MULT : SPEC_FAIL_REP[t];
    sv.spec = null;
    if (ok) {
      xp = svcXpAdd(want);
      earn(money);
      gainXP(5 + Math.round(want / 6));
      progress('mission');
    }
    repAdd(ok ? SPEC_REP : SPEC_FAIL_REP[t]);
    haptic(ok ? 'ok' : 'err'); save(); render();
    showModal(`<div class="drop"><div class="drop-name">${ok ? '🏅 Задание выполнено' : '😬 Провал'}</div>
      <p style="margin-top:8px">${text}</p>
      ${ok ? `<div class="big">+${fmt(money)} ₽ · ${xpText(xp, want)}</div>` : '<div class="big bad">Без премии и опыта</div>'}
      <p class="small muted">${rep ? `Репутация ${rep > 0 ? '+' : '−'}${Math.abs(rep)}. ` : ''}${SPEC_TYPES[t].name} — снова через ${SPEC_COOLDOWN_MIN} мин.</p>
      <button class="btn full" data-action="close">Дальше</button></div>`);
  }

  function renderService() {
    const sv = S.sil, st = STR(), rk = svcRank(), reqs = promoReqs();
    if (!sv.mission) nextMission();
    const m = missionOf(), ready = Date.now() >= sv.nextMission;
    const choice = (c, i) => {
      const bits = [];
      if (c.xp) bits.push(`+${c.xp} опыта`);
      if (c.money) bits.push(`+${fmt(round2(rankMonth() * st.bribeMult * c.money))} ₽`);
      if (c.risk) bits.push(`риск сесть ${svcRisk(c.risk)}%`);
      bits.push(c.risk ? `репутация −${REP_BRIBE + 4 * c.money}` : `репутация +${(c.money ? 4 : REP_HONEST) * REP_GOOD_MULT}`);
      const need = c.need && !st.force ? Object.entries(c.need).map(([k, v]) => `${SKILL[k].name} ${v}${S.skills[k] < v ? ' ✗' : ' ✓'}`).join(', ') : '';
      return `<button class="btn ${c.risk ? 'btn-danger' : c.need ? 'btn-line' : ''}" data-action="mission" data-id="${i}">${c.t}
        <span class="small">${bits.join(' · ')}${need ? `<br>нужно: ${need}` : ''}</span></button>`;
    };
    const mission = ready
      ? `<div class="card accent"><div class="big-text">${m.title}</div><p class="small" style="margin:6px 0 10px">${m.text}</p>
          <div class="choice">${m.choices.map(choice).join('')}</div></div>`
      : `<div class="card small muted">${ic('clock')} Новое задание через <span data-timer="${sv.nextMission}">${fmtTime(sv.nextMission - Date.now())}</span></div>`;
    const free = rk.roofs - sv.roofs.length;
    const roofRow = (d, act) => `<div class="list-row" style="margin-top:8px"><div class="ico-box" style="font-size:20px">${d.icon}</div>
        <div class="grow"><div class="val">${d.name}</div>
          <div class="small"><span class="good">+${fmt(ph(roofPay(d.id)))} ₽/ч</span> · <span class="${roofTrait(d.id).risk > 1 ? 'bad' : 'muted'}">риск ×${String(roofTrait(d.id).risk).replace('.', ',')}</span>${roofFits(d.id) ? ` · <span class="gold">профильный +${ROOF_FIT * 100}%</span>` : ''}</div>
          ${roofTrait(d.id).note ? `<div class="small muted">${roofTrait(d.id).note}</div>` : ''}</div>${act}</div>`;
    const mine = sv.roofs.map(id => roofRow(BIZ[id], `<button class="btn btn-sm btn-ghost" data-action="roof-drop" data-id="${id}">Отпустить</button>`)).join('');
    const can = free > 0 ? BUSINESSES.filter((d, i) => i <= rk.tier && !sv.roofs.includes(d.id)).reverse()
      .map(d => roofRow(d, `<button class="btn btn-sm" data-action="roof-take" data-id="${d.id}">Взять</button>`)).join('') : '';
    return `<div class="card accent">
        <div class="row">${boardImg(sv.r)}
          <div class="grow"><div class="job-name">${rk.name} · ${st.icon} ${st.name}</div>
            <div class="job-pay">${fmt(ph(servicePay()))} ₽/ч довольствие</div>
            <div class="small muted">На звании ${hoursText(rankH())} · всего ${hoursText(serviceH())} · звание ${sv.r + 1} из ${SERVICE_RANKS.length}</div></div></div>
        ${reqs ? `<div class="small" style="margin-top:10px">До звания «${SERVICE_RANKS[sv.r + 1].name}»:</div>
          ${reqs.map(x => `<div class="small ${x.ok ? 'good' : 'muted'}">${ic(x.ok ? 'check' : 'point')} ${x.text}</div>`).join('')}
          <button class="btn full" style="margin-top:8px" data-action="sil-promote" ${reqs.every(x => x.ok) ? '' : 'disabled'}>Аттестация — получить звание</button>`
          : '<div class="small gold" style="margin-top:8px">Высшее звание. Дальше только пенсия.</div>'}
      </div>
      <div class="section">Репутация</div>
      <div class="card">
        ${repBar()}
        <div class="small muted">Проверок: ${checksPerDay() >= 1 ? `≈ ${String(+checksPerDay().toFixed(1)).replace('.', ',')} в сутки` : `≈ раз в ${String(+(1 / checksPerDay()).toFixed(1)).replace('.', ',')} сут.`} ·
          найдут что-то с шансом ${findChance()}%. Честные решения поднимают репутацию, деньги и «крыши» — роняют.</div>
      </div>
      <div class="section">Служебная машина</div>
      ${svcCarCard()}
      <div class="section">Задание</div>
      ${mission}
      <div class="section">«Крыша» · ${sv.roofs.length} из ${rk.roofs}</div>
      <div class="card">
        <div class="small muted">Бизнес платит за спокойствие долю своей цены, но не больше ${fmt(ph(roofCap()))} ₽/ч с одной «крыши» на твоём звании — у каждого свой характер и риск. «Профильные» для ${STR().name} платят больше. Чем больше «крыш», тем чаще интересуется ОСБ.</div>
        ${mine}${can ? `<div class="small" style="margin-top:10px">Можно взять:</div>${can}` : ''}
        ${!rk.roofs ? '<div class="small muted" style="margin-top:6px">«Крыша» — с сержанта.</div>' : ''}
      </div>
      <div class="section">Что дают звания</div>
      <div class="card small">${SERVICE_RANKS.map((x, i) => x.bonus ? `<div class="rank-perk ${i <= sv.r ? 'on' : ''}">${ic(i <= sv.r ? 'check' : 'lock')}
          <span><b>${x.name}</b> — ${x.bonus}</span></div>` : '').join('')}
        <div class="muted" style="margin-top:6px">Каждое звание ещё и повышает довольствие и «потолок» бизнесов под «крышей».</div></div>
      <div class="section">Что даёт ${st.name}</div>
      <div class="card small">${st.perks.map(t => `<div>${ic('star', 'gold')} ${t}</div>`).join('')}
        <div class="muted" style="margin-top:6px">Для званий качай в «Учёбе»: ${st.skills.map(k => SKILL[k].name).join(' и ')}.</div>
        <div class="muted">Обычная работа и подработки — запрещены. Мелкий бизнес (до «${BUSINESSES[SERVICE_BIZ_TIER].name}») — можно до звания «${SERVICE_RANKS[SERVICE_BIZ_UNTIL - 1].name}» включительно, с «${SERVICE_RANKS[SERVICE_BIZ_UNTIL].name}» любой бизнес надо продать.</div></div>
      <button class="btn btn-ghost btn-sm full" data-action="sil-quit">Уволиться со службы</button>`;
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
    const service = S.lvl >= SERVICE_MIN_LEVEL && Date.now() < S.silBan
      ? `<div class="card small muted">${ic('clock')} На службу снова можно через <span data-timer="${S.silBan}">${fmtTime(S.silBan - Date.now())}</span></div>`
      : S.lvl >= SERVICE_MIN_LEVEL
      ? `<button class="card tap accent" data-action="sil-join"><div class="list-row"><div class="ico-box">${ic('shield')}</div>
          <div class="grow"><div class="val">Пойти на службу</div><div class="small muted">МВД, ФСБ или прокуратура: звания, «крыша», задания — и риск сесть</div></div>
          <span class="chev">${ic('chevron-right')}</span></div></button>`
      : `<div class="card small muted">${ic('lock')} Служба в МВД, ФСБ или прокуратуре — с ${SERVICE_MIN_LEVEL} уровня (сейчас ${S.lvl})</div>`;
    return `<p class="hint">Кроме зарплаты каждая профессия даёт свою пользу ${ic('star', 'gold')} — пока ты на ней работаешь.</p>
      ${service}
      ${focus}
      ${locked.length ? `<details class="card more-card"><summary class="row"><span class="ico-box">${ic('lock')}</span>
        <span class="grow"><span class="val">Ещё ${locked.length} профессий закрыто</span><br>
        <span class="small muted">Нужны навыки — качай их в «Учёбе». Ближе всего: ${near.name}</span></span><span class="chev">${ic('chevron-down')}</span></summary>
        <div style="margin-top:10px">${locked.map(jobCard).join('')}</div></details>` : ''}
      ${open.map(jobCard).join('')}`;
  }
  function renderSkills() {
    const skIcon = { int: 'brain', cha: 'message-circle', fit: 'barbell', biz: 'chart-line' };
    return `<p class="hint">Учёба без перерывов — ограничивают только деньги: каждый следующий уровень на 30% дороже.${
      perk('skillCheap') ? ` Профессия даёт скидку ${perk('skillCheap')}%.` : ''}</p>
      ${SKILLS.map(s => {
        const lvl = S.skills[s.id], max = lvl >= SKILL_MAX, cost = skillPrice(lvl);
        return `<div class="card job"><div class="ico-box">${ic(skIcon[s.id])}</div>
          <div class="grow"><div class="job-name">${s.name} <span class="gold">${lvl}</span><span class="muted small">/${SKILL_MAX}</span></div>
            <div class="small muted">${s.desc}</div><div class="bar"><i style="width:${lvl / SKILL_MAX * 100}%"></i></div></div>
          ${max ? '<span class="tag">MAX</span>'
            : `<button class="btn btn-sm btn-col" data-action="skill" data-id="${s.id}" ${S.money < cost ? 'disabled' : ''}>+1<span class="btn-top">${fmt(cost)} ₽</span></button>`}
        </div>`;
      }).join('')}`;
  }
  function renderRace() {
    const id = raceCarId();
    if (!id) return `<div class="empty">${ic('steering-wheel')}Для гонок нужна своя машина.<br>Машины выпадают из кейсов.<br><br>
      <button class="btn btn-sm" data-goto="cases" data-sub="cases:car">К кейсам</button></div>`;
    const it = ITEM[id], st = carState(id), rc = rclass(id), block = raceBlock(id), pl = pool();
    const cars = Object.keys(S.inv).filter(x => ITEM[x] && ITEM[x].cat === 'car').sort((a, b) => carHp(b) - carHp(a));
    const chips = cars.map(x => `<button class="chip ${x === id ? 'active' : ''}" data-action="race-car" data-id="${x}">${isSvcCar(x) ? '🚨 ' : ''}${rclass(x).name} · ${ITEM[x].name}${carState(x).stage ? ' · S' + carState(x).stage : ''} · ⛽${carState(x).tank}</button>`).join('');
    const tank = Array.from({ length: TANK_RACES }, (_, i) => `<i class="${i < st.tank ? 'on' : ''}"></i>`).join('');
    const next = TUNE_STAGES[st.stage];
    const tune = next
      ? `<div class="row"><div class="grow"><div class="small">Stage ${st.stage + 1} · <b>${next.name}</b></div>
          <div class="small muted">${carHp(id)} → ${stageHp(CAR_HP[id], st.stage + 1)} л.с.</div>
          <div class="small">В среднем за заезд: ${fmt(round2(bestRaceEV(id, st.stage)))} → <b class="good">${fmt(round2(bestRaceEV(id, st.stage + 1)))} ₽</b></div></div>
          <button class="btn btn-sm btn-col" data-action="tune" data-id="${id}" ${S.money < tuneCost(id, st.stage) ? 'disabled' : ''}>Тюнинг<span class="btn-top">${fmt(tuneCost(id, st.stage))} ₽</span></button></div>`
      : `<div class="small good">${ic('check')} Гоночная сборка — максимальный тюнинг</div>`;
    const levels = RACE_LEVELS.map((L, lv) => {
      const rv = rivalOf(id, lv), ch = raceChance(id, lv), stake = raceStake(id, lv);
      const poor = S.money < stake.fee;
      return `<div class="card race-lv" style="--lc:${L.color}">
        <div class="list-row"><div class="inv-icon">${visual(rv.it)}</div>
          <div class="grow"><div class="row"><span class="lv-name grow">${lv + 1}. ${L.name}</span><b class="lv-chance">${ch}%</b></div>
            <div class="small ellipsis">${rv.it.name} · ${rv.hp} л.с.</div>
            <div class="small muted">${stageStars(rv.stage)} · ${stake.fee ? `взнос ${fmt(stake.fee)} ₽` : 'без взноса'} · <span class="good">победа +${fmt(stake.prize)} ₽</span></div></div></div>
        <button class="btn btn-sm full" style="margin-top:8px" data-action="race" data-id="${lv}" ${block || poor ? 'disabled' : ''}>${poor && !block ? 'Не хватает на взнос' : 'На старт'}</button>
      </div>`;
    }).join('');
    return `<p class="hint">Драг на 402 м. Пять соперников — от новичка до легенды, после каждого заезда приезжают новые. Тюнинг поднимает шанс против сильных:
        соперник уровня N затюнингован на Stage N−1. Стартуй ровно на зелёный и попади передачей в зелёную зону — это ещё ±${RACE_SKILL}% к шансу.</p>
      <div class="card"><div class="kv"><span>${ic('flag')} Заездов доступно</span><b>${pl.n} / ${RACE_POOL}</b></div>
        <div class="small muted">${pl.n < RACE_POOL ? `+1 через <span data-timer="${pl.ts + POOL_REGEN_MIN * 60e3}">${fmtTime(nextIn(pl, POOL_REGEN_MIN))}</span> · ` : ''}общий лимит на все машины, ${RACE_POOL} в час</div></div>
      <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px">${chips}</div>
      <div class="card">
        <div class="list-row"><div class="inv-icon">${visual(it)}</div>
          <div class="grow"><div class="job-name">${it.name}</div>
            <div class="small muted">Класс <b class="gold">${rc.name}</b> · ${carHp(id)} л.с. · 402 м за ${carTime(id).toFixed(2)} с</div>
            <div class="small">${stageStars(st.stage)} <span class="muted">Stage ${st.stage}</span> ${plateOf(id) ? plateHTML(plateOf(id), 'sm') : ''}</div></div></div>
        <div class="kv small" style="margin-top:8px"><span>Бак: ${st.tank} / ${TANK_RACES} заездов</span>
          <b class="muted">${st.tank < TANK_RACES ? `+1 через <span data-timer="${st.ts + TANK_REGEN_MIN * 60e3}">${fmtTime(nextIn({ ts: st.ts }, TANK_REGEN_MIN))}</span>` : 'полный'}</b></div>
        <div class="tank">${tank}</div>
        <div class="kv small"><span>Износ ${Math.round(st.wear)}% · шанс поломки ${Math.round(breakChance(id))}%</span><b>${st.broken ? '<span class="bad">сломана</span>' : ''}</b></div>
        <div class="row" style="margin-top:8px">
          ${st.broken ? `<button class="btn btn-sm grow" data-action="repair" data-id="${id}">Ремонт · ${fmt(it.value * REPAIR_COST)} ₽</button>`
            : `<button class="btn btn-sm btn-ghost grow" data-action="service" data-id="${id}" ${st.wear <= 0 ? 'disabled' : ''}>ТО: износ → 0 · ${fmt(it.value * SERVICE_COST)} ₽</button>`}</div>
      </div>
      <div class="card">${tune}
        <div class="small muted" style="margin-top:6px">Тюнинг остаётся в машине: при продаже вернётся ${Math.round(TUNE_SELL_RATE * 100)}% вложенного${st.tuneInv ? ` (+${fmt(tuneValue(id))} ₽)` : ''}.</div></div>
      ${block ? `<p class="small bad" style="text-align:center">${block}</p>` : ''}
      ${levels}
      <p class="small muted" style="text-align:center">Всего побед: ${S.raceWins} · ставки — ${Math.round(RACE_CAR_SHARE * 100)}% цены машины за единицу: дороже машина — крупнее куш</p>`;
  }

  // Заезд: светофор → старт (реакция) → переключение передачи → результат
  let race = null;
  function startRace(id, lv) {
    if (race || !id || !RACE_LEVELS[lv] || raceBlock(id)) return;
    const st = carState(id), stake = raceStake(id, lv);
    if (stake.fee && !pay(stake.fee)) return;
    st.tank--;
    if (st.tank === TANK_RACES - 1) st.ts = Date.now();
    if (S.pool.n === RACE_POOL) S.pool.ts = Date.now();
    S.pool.n--;
    const rival = rivalOf(id, lv);
    race = { id, lv, rival, stake, chance: raceChance(id, lv), phase: 'lights', willBreak: Math.random() * 100 < breakChance(id) };
    st.wear = Math.min(100, st.wear + WEAR_PER_RACE);
    save(); render();
    const L = RACE_LEVELS[lv];
    showModal(`<div class="race-vs" style="--lc:${L.color}">
        <div><div class="inv-icon">${visual(ITEM[id])}</div><div class="small ellipsis">${ITEM[id].name}</div><div class="small muted">${carHp(id)} л.с.</div></div>
        <b class="vs">VS</b>
        <div><div class="inv-icon">${visual(rival.it)}</div><div class="small ellipsis">${rival.it.name}</div><div class="small muted">${rival.hp} л.с.</div></div></div>
      <div class="small" style="text-align:center"><b style="color:${L.color}">${L.name}</b> · шанс ${race.chance}%</div>
      <div class="race-lights"><i></i><i></i><i></i><i class="go"></i></div>
      <div class="race-tacho hidden" id="tacho"><div class="zone ok"></div><div class="zone perfect"></div><div class="needle" id="needle"></div></div>
      <p class="small" id="race-hint" style="text-align:center">Жми «Газ», когда загорится зелёный. Раньше — фальстарт.</p>
      <button class="btn full race-btn" id="race-btn" data-action="race-tap">Газ!</button>`);
    const lights = [...document.querySelectorAll('.race-lights i')];
    lights.forEach((l, i) => i < 3 && setTimeout(() => race && race.phase === 'lights' && l.classList.add('on'), 500 + i * 550));
    race.greenTimer = setTimeout(() => {
      if (!race || race.phase !== 'lights') return;
      lights.forEach(l => l.classList.remove('on'));
      lights[3].classList.add('on');
      race.phase = 'green';
      race.green = performance.now();
      haptic('medium');
    }, 2150 + Math.random() * 1400);
  }
  function raceTap() {
    if (!race) return;
    const now = performance.now();
    if (race.phase === 'lights') { clearTimeout(race.greenTimer); return finishRace({ jump: true }); }
    if (race.phase === 'green') {
      race.rt = (now - race.green) / 1000;
      if (race.rt > RACE_SLEEP) return finishRace({ sleep: true });
      race.phase = 'shift';
      $('#tacho').classList.remove('hidden');
      $('#race-hint').textContent = 'Переключи передачу, когда стрелка в зелёной зоне!';
      $('#race-btn').textContent = 'Передача!';
      race.shiftStart = now;
      const needle = $('#needle');
      const step = () => {
        if (!race || race.phase !== 'shift') return;
        const p = Math.min(1, (performance.now() - race.shiftStart) / 1100);
        needle.style.left = (p * 100) + '%';
        if (p >= 1) { race.shift = 1; return finishRace({}); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return;
    }
    if (race.phase === 'shift') {
      race.shift = Math.min(1, (now - race.shiftStart) / 1100);
      finishRace({});
    }
  }
  // Исход решает шанс уровня (± мастерство), а время на табло подстраивается под исход
  function finishRace({ jump, sleep }) {
    const r = race, id = r.id, st = carState(id);
    r.phase = 'done';
    race = null;
    st.rivals = rollRivals(id);
    let title, text, win = false, stop = null;
    if (jump) {
      title = '🚦 Фальстарт';
      text = 'Ты сорвался раньше зелёного — заезд засчитан как поражение.';
    } else if (sleep) {
      title = '😴 Проспал старт';
      text = `Соперник ушёл вперёд, пока ты стоял на месте. Жми «Газ» сразу на зелёный — быстрее ${RACE_SLEEP} с.`;
    } else if (r.willBreak) {
      st.broken = true;
      title = '💥 Поломка';
      text = `Машина сломалась прямо на трассе. Ремонт — ${fmt(ITEM[id].value * REPAIR_COST)} ₽. Делай ТО, пока износ небольшой.`;
    } else {
      const sh = r.shift;
      const shiftQ = sh >= 0.72 && sh <= 0.88 ? 1 : sh >= 0.6 && sh <= 0.94 ? 0 : -1;
      const skill = (r.rt < 0.3 ? 1 : r.rt > 0.6 ? -1 : 0) + shiftQ;
      const skillBonus = r.chance > 0 && r.chance < 100 ? Math.sign(skill) * RACE_SKILL : 0;
      const top = r.lv === 0 ? 100 : RACE_TOP_MAX - RACE_TOP_STEP * (r.lv - 1);
      const p = Math.max(0, Math.min(Math.max(top, r.chance), r.chance + skillBonus));
      const bonus = p - r.chance;   // сколько реально дало мастерство (выше полосы своего уровня не поднимает)
      win = Math.random() * 100 < p;
      const myTime = carTime(id) + (r.rt - 0.2) + [SHIFT_MISS, 0, SHIFT_PERFECT][shiftQ + 1] + (Math.random() - 0.5) * 0.1;
      const gap = 0.04 + Math.random() * 0.45;
      const oppTime = win ? myTime + gap : myTime - gap;
      title = win ? '🏆 Победа!' : '😤 Поражение';
      text = `Реакция ${r.rt.toFixed(3)} с · передача ${shiftQ > 0 ? 'идеально' : shiftQ === 0 ? 'нормально' : 'мимо'}<br>
        Шанс ${p}%${bonus ? ` (${bonus > 0 ? '+' : ''}${bonus}% за мастерство)` : ''}<br>
        Ты: <b>${myTime.toFixed(2)} с</b> · ${r.rival.it.name}: <b>${oppTime.toFixed(2)} с</b>`;
      stop = gibddStop(id);
    }
    if (win) {
      earn(r.stake.prize);
      S.raceWins++;
      progress('race_win');
    }
    if (!jump) gainXP(RACE_LEVELS[r.lv].xp * (win ? 2 : 1));
    let gibdd = '';
    if (stop) {
      const fine = Math.min(stop.fine, S.money);
      S.money -= fine;
      gibdd = stop.sil
        ? `<div class="card small" style="margin-top:10px;text-align:left">🚓 Тормознула ГИБДД. «Знаешь, кто я?» — ${svcRank().name.toLowerCase()} ${STR().name} показывает удостоверение, инспектор извиняется и отпускает.</div>`
        : stop.gov
        ? `<div class="card small" style="margin-top:10px;text-align:left">🚓 Тормознула ГИБДД. Инспектор увидел номер ${plateHTML(plateOf(id), 'sm')} и молча отдал честь.</div>`
        : fine
        ? `<div class="card danger small" style="margin-top:10px;text-align:left">🚓 После финиша тормознула ГИБДД: превышение на дороге общего пользования. Штраф <b>${fmt(fine)} ₽</b>.</div>`
        : `<div class="card small" style="margin-top:10px;text-align:left">🚓 Тормознула ГИБДД. Знакомый инспектор: «Опять ты? Ну езжай».</div>`;
    }
    save(); render();
    showModal(`<div class="drop"><div class="drop-name">${title}</div>
      <p style="margin-top:8px">${text}</p>
      <div class="big ${win ? '' : 'bad'}">${win ? '+' + fmt(r.stake.prize) : r.stake.fee ? '−' + fmt(r.stake.fee) : '0'} ₽</div>
      ${gibdd}
      <button class="btn full" data-action="close" style="margin-top:10px">Дальше</button></div>`);
    haptic(win ? 'ok' : 'err');
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
    if (S.sil && S.sil.r >= SERVICE_BIZ_UNTIL && !Object.keys(S.biz).length) return `<div class="empty">${ic('shield')}С «${SERVICE_RANKS[SERVICE_BIZ_UNTIL].name}» владеть бизнесом нельзя.<br>Зато бизнес можно взять под «крышу».<br><br>
      <button class="btn btn-sm" data-goto="career" data-sub="career:jobs">К службе</button></div>`;
    const owned = BUSINESSES.filter(d => S.biz[d.id]);
    const total = bizProfit();
    const plus = v => `${v >= 0 ? '+' : ''}${fmt(v)}`;
    const cards = owned.map(d => {
      const b = S.biz[d.id], st = bizStats(d.id), n = bizNum(d);
      const fullS = b.slots >= d.sMax, fullA = b.ads >= d.sMax - d.s0;
      const dS = bizDelta(d.id, { slots: b.slots + 1 }), dA = bizDelta(d.id, { ads: b.ads + 1 });
      const neck = st.neck === 'slots' ? `Клиентов больше, чем мест — добавь рабочее место`
        : st.neck === 'ads' ? `Места простаивают — нужна реклама`
        : `Места и клиенты в балансе — расширяйся: место, потом реклама`;
      return `<div class="card ${bizShut(d.id) ? 'danger' : ''}">
        <div class="biz-head"><div class="ico-box" style="font-size:22px">${d.icon}</div>
          <div class="grow"><div class="job-name">${d.name}</div>
            <div class="small muted">${bizShut(d.id) ? '🔒 Не работает' : b.mgr ? `${MANAGERS[b.mgr - 1].icon} ${MANAGERS[b.mgr - 1].name}: ${Math.round(st.eff * 100)}%` : `Без управляющего: ${Math.round(st.eff * 100)}%`}</div>
            ${(b.nephew || 0) > Date.now() ? `<div class="small bad">👦 Племянник в штате ещё <span data-timer="${b.nephew}">${fmtTime(b.nephew - Date.now())}</span> · выручка −${FAVOR.f_nephew.drag.revCut * 100}%</div>` : ''}</div>
          <div class="biz-profit ${st.profit < 0 ? 'bad' : ''}">${plus(ph(st.profit))}<div class="small muted">₽/ч</div></div></div>
        ${b.inc ? `<button class="btn btn-danger full" style="margin:8px 0" data-action="inc-open" data-id="${d.id}">${INC[b.inc.id].icon} ${INC[b.inc.id].title} — ${b.inc.waitUntil ? 'ждём, пока утихнет' : 'разобраться'}</button>` : ''}
        ${(b.closedUntil || 0) > Date.now() ? `<div class="small bad" style="margin:6px 0">🔒 Закрыт ещё <span data-timer="${b.closedUntil}">${fmtTime(b.closedUntil - Date.now())}</span></div>` : ''}
        ${b.strikes ? `<div class="small muted" style="margin:6px 0">📁 Нарушений в деле: ${b.strikes} из ${BIZ_STRIKE_MAX} — проверки чаще, штрафы выше</div>` : ''}
        <div class="biz-grid">
          <div><span class="small muted">Мощность</span><b>${fmt(st.cap)}</b><span class="small muted">${b.slots} мест</span></div>
          <div><span class="small muted">Клиенты</span><b>${fmt(st.demand)}</b><span class="small muted">${d.unit}</span></div>
          <div><span class="small muted">Обслужено</span><b>${fmt(st.sold)}</b><span class="small muted">${d.unit}</span></div></div>
        <div class="small ${st.neck ? 'gold' : 'good'}" style="margin-bottom:10px">${ic(st.neck ? 'bulb' : 'check')} ${neck}</div>
        <div class="acts" style="grid-template-columns:1fr 1fr">
          <button class="act" data-action="biz-slot" data-id="${d.id}" ${fullS ? 'disabled' : ''}>${ic('user-plus')}
            <span class="act-name">Рабочее место</span><span class="act-sub">${d.slot} · ${b.slots}/${d.sMax}</span>
            <span class="act-sub ${dS > 0 ? 'good' : 'bad'}">${fullS ? 'максимум' : plus(ph(dS)) + ' ₽/ч'}</span>
            <span class="act-cost">${fullS ? '' : fmt(slotCost(d.id)) + ' ₽'}</span></button>
          <button class="act" data-action="biz-ad" data-id="${d.id}" ${fullA ? 'disabled' : ''}>${ic('speakerphone')}
            <span class="act-name">Реклама</span><span class="act-sub">+${fmt(d.perSlot)} ${d.unit} · ${b.ads}/${d.sMax - d.s0}</span>
            <span class="act-sub ${dA > 0 ? 'good' : 'muted'}">${fullA ? 'максимум' : plus(ph(dA)) + ' ₽/ч'}</span>
            <span class="act-cost">${fullA ? '' : fmt(adCost(d.id)) + ' ₽'}</span></button></div>
        <details class="more"><summary>${ic('receipt')} Доходы, расходы и управление</summary>
          <div class="kv small"><span>Выручка</span><b>${fmt(st.revenue)}</b></div>
          <div class="kv small"><span>Зарплаты (${b.slots} × ${fmt(n.salary)})</span><b>−${fmt(st.wages)}</b></div>
          <div class="kv small"><span>Аренда помещения</span><b>−${fmt(st.rent)}</b></div>
          ${b.mgr ? `<div class="kv small"><span>${MANAGERS[b.mgr - 1].name}</span><b>−${fmt(st.mgr)}</b></div>` : ''}
          <div class="kv small"><span>Налог ${Math.round(taxRate() * 100)}%</span><b>−${fmt(st.tax)}</b></div>
          <div class="small muted" style="margin-top:4px">Все суммы — за час</div><div class="kv small"><span>Вложено</span><b>${fmt(b.inv)}</b></div>
          <div class="row" style="margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-sm ${b.mgr ? 'btn-ghost' : 'btn-line'}" data-action="biz-mgr" data-id="${d.id}">${b.mgr ? 'Сменить управляющего' : 'Нанять управляющего'}</button>
            <button class="btn btn-sm btn-danger" data-action="biz-sell" data-id="${d.id}">Продать за ${fmt(b.inv * bizSellRate())} (${Math.round(bizSellRate() * 100)}% вложенного)</button></div>
        </details></div>`;
    }).join('');
    const rest = BUSINESSES.filter(d => !S.biz[d.id]);
    const shop = rest.map(d => {
      const open = bizOpen(d);
      const start = bizStats(d.id, { slots: d.s0, ads: 0, mgr: 3 }).profit, full = bizStats(d.id, { slots: d.sMax, ads: d.sMax - d.s0, mgr: MANAGERS.length }).profit;
      const reqs = reqTags(d.req, [`<span class="req ${rankIdx() >= d.rank ? 'ok' : 'no'}">${RANKS[d.rank].name}</span>`]);
      return `<div class="card job ${open ? '' : 'locked'}"><div class="ico-box" style="font-size:22px">${d.icon}</div>
        <div class="grow"><div class="job-name">${d.name}</div>
          <div class="small muted">${fmt(d.price)} ₽ + лицензии ${fmt(licenseCost(d))} ₽</div>
          <div class="small good">≈ ${fmt(ph(start))} ₽/ч на старте с управляющим · до ${fmt(ph(full))} ₽/ч на полной прокачке · мест ${d.s0} → ${d.sMax}</div>
          ${open ? '' : `<div class="reqs">${reqs}</div>`}</div>
        ${open ? `<button class="btn btn-sm" data-action="biz-buy" data-id="${d.id}">Открыть</button>` : `<span class="tag lock">${ic('lock')}</span>`}</div>`;
    }).join('');
    return `<div class="title">Бизнес</div>
      ${owned.length ? `<div class="card"><div class="kv"><span>Прибыль всех бизнесов</span><b class="${total < 0 ? 'bad' : 'good'}">${fmt(ph(total))} ₽/ч</b></div>
        <div class="small muted" style="margin-top:6px">Без управляющего бизнес работает на ${Math.round(ownerEff() * 100)}% — ${S.job ? 'ты занят на работе' : 'ты занят только бизнесом'}.</div></div>${cards}`
        : `<p class="hint">Рабочие места дают мощность, реклама — клиентов. Заработаешь на меньшем из двух, поэтому развивай их по очереди. На каждой кнопке видно, сколько прибыли она добавит.</p>`}
      ${rest.length ? `<details class="more" ${owned.length ? '' : 'open'}><summary>${ic('plus')} Открыть новый бизнес</summary>${shop}</details>` : ''}`;
  }

  // ---------- связи ----------
  function stars(lv) { return starsHTML(lv); }
  const starsHTML = lv => `<span class="stars">${'★'.repeat(lv)}<span class="off">${'★'.repeat(CONN_MAX_LV - lv)}</span></span>`;
  const lvPct = id => {
    const lv = connLv(id), c = S.conn[id];
    return lv >= CONN_MAX_LV ? 100 : (c.xp - cxp(id, lv - 1)) / (cxp(id, lv) - cxp(id, lv - 1)) * 100;
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
        ${f.drag && S.biz[fv.biz] ? `<div class="small bad mb">${ic('alert-triangle')} Минус: «${BIZ[fv.biz].name}» ${f.drag.hours} ч с племянником — выручка −${f.drag.revCut * 100}% и лишняя зарплата: ${fmt(ph(bizDelta(fv.biz, { nephew: Date.now() + 3600e3 })))} ₽/ч</div>` : ''}
        <div class="row"><button class="btn btn-sm grow" data-action="favor-yes">${cost ? `Помочь · ${fmt(cost)} ₽` : 'Помочь'}</button>
          <button class="btn btn-sm btn-ghost" data-action="favor-no">Отказать</button></div></div>`;
    }
    let deal = '';
    if (perk('deal')) {
      const d = S.deal, used = S.dealDay === dayKey(new Date());
      deal = `<div class="card"><div class="label">${ic('briefcase')} Сделка с олигархом</div>
        <div class="small muted mb">Вложи до ${String(DEAL_INCOME_H / MONTHS_PER_HOUR).replace('.', ',')} ч своего дохода — через ${DEAL_HOURS} ч вернётся +${perk('deal')}%. Раз в сутки.</div>
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
    return `${freeCaseCard(CASE.conn_free)}
      ${favor}${deal}
      ${rows ? `<div class="section">Твои связи · ${ids.length}</div>${rows}`
        : `<div class="empty">${ic('users')}Полезные люди решают проблемы и дают бонусы.<br>Начни со «Знакомства дня».</div>`}
      <p class="hint" style="margin-top:10px">Доверие растёт от встреч и выполненных просьб. На ${CONN_MAX_LV} ★ открывается особая услуга. Если долго не общаться, доверие понемногу тает.</p>
      <button class="btn btn-ghost full" data-goto="cases" data-sub="cases:conn">${ic('box')} Больше связей — в кейсах</button>`;
  }
  function showConn(id) {
    const it = ITEM[id], c = S.conn[id], lv = connLv(id), now = Date.now();
    const toNext = lv < CONN_MAX_LV ? `${Math.ceil(cxp(id, lv) - c.xp)} доверия до ${lv + 1} ★` : 'Полное доверие';
    const meets = MEETS.map((m, i) => {
      const until = c.cd[m.id] || 0, wait = until > now, [mname, micon] = meetOf(id, i);
      return `<button class="act" data-action="meet" data-id="${id}:${m.id}" ${wait ? 'disabled' : ''}>${ic(micon)}
        <span class="act-name">${mname}</span><span class="act-sub">+${Math.round(m.xp * (1 + perk('trustUp') / 100))} доверия</span>
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

  // ---------- казино ----------
  let casBet = 0;          // текущая ставка (в рублях)
  let bj = null;           // раздача блэкджека
  let vp = null;           // раздача видеопокера
  let rlBusy = false;
  const maxBet = () => Math.floor(S.money * CASINO_MAX_SHARE);
  function betValue() {
    const mx = maxBet();
    if (!casBet) casBet = Math.max(CASINO_MIN_BET, Math.round(mx / 5 / 1000) * 1000);
    return Math.min(casBet, mx);
  }
  function betBar() {
    const mx = maxBet(), b = betValue();
    const chips = [[0.02, '2%'], [0.1, '10%'], [0.25, '25%'], [0.5, 'Макс']].map(([f, l]) => {
      const v = Math.max(CASINO_MIN_BET, Math.floor(S.money * f / 1000) * 1000);
      return `<button class="chip ${Math.min(v, mx) === b ? 'active' : ''}" data-action="cas-bet" data-id="${v}">${l} · ${fmt(Math.min(v, mx))}</button>`;
    }).join('');
    return `<div class="card"><div class="kv"><span>Ставка</span><b class="gold">${fmt(b)} ₽</b></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${chips}</div>
      <div class="small muted" style="margin-top:6px">Максимум — половина баланса: ${fmt(mx)} ₽</div></div>`;
  }
  // ставка списывается сразу; false — если ставить нечего
  function takeBet() {
    const b = betValue();
    if (b < CASINO_MIN_BET || S.money < CASINO_MIN_BET * 2) { toast(`Минимальная ставка ${fmt(CASINO_MIN_BET)} ₽ и не больше половины баланса`); return 0; }
    S.money -= b;
    return b;
  }
  function casinoWin(v) { if (v > 0) { S.money += v; S.total += v; } }

  // --- рулетка (европейская, 0–36)
  const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const numColor = n => (n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black');
  const RL_BETS = {
    red: { name: 'Красное', pay: 1, win: n => numColor(n) === 'red' },
    black: { name: 'Чёрное', pay: 1, win: n => numColor(n) === 'black' },
    even: { name: 'Чёт', pay: 1, win: n => n > 0 && n % 2 === 0 },
    odd: { name: 'Нечет', pay: 1, win: n => n % 2 === 1 },
    low: { name: '1–18', pay: 1, win: n => n >= 1 && n <= 18 },
    high: { name: '19–36', pay: 1, win: n => n >= 19 },
    d1: { name: '1–12', pay: 2, win: n => n >= 1 && n <= 12 },
    d2: { name: '13–24', pay: 2, win: n => n >= 13 && n <= 24 },
    d3: { name: '25–36', pay: 2, win: n => n >= 25 },
    zero: { name: 'Зеро', pay: 35, win: n => n === 0 },
  };
  let rlLast = [];
  function renderRoulette() {
    const btn = (id, cls = '') => `<button class="rl-bet ${cls}" data-action="rl-spin" data-id="${id}" ${rlBusy ? 'disabled' : ''}>${RL_BETS[id].name}<span>×${RL_BETS[id].pay + 1}</span></button>`;
    return `${betBar()}
      <div class="card"><div class="wheel-window"><div class="wheel-strip" id="wheel-strip">${rlStripHTML([rlLast[0] ?? 0])}</div><div class="rl-marker"></div></div>
        <div class="row" style="justify-content:center;gap:4px;margin-top:8px">${rlLast.slice(0, 10).map(n => `<span class="num ${numColor(n)}">${n}</span>`).join('') || '<span class="small muted">Сделай первую ставку</span>'}</div></div>
      <div class="rl-grid">${btn('red', 'red')}${btn('black', 'black')}${btn('even')}${btn('odd')}${btn('low')}${btn('high')}${btn('d1')}${btn('d2')}${btn('d3')}${btn('zero', 'green')}</div>
      <div class="card row"><span class="grow small muted">Ставка на число (выплата ×36)</span>
        <input id="rl-num" class="input" type="number" min="0" max="36" placeholder="0–36" style="width:80px">
        <button class="btn btn-sm" data-action="rl-spin" data-id="num" ${rlBusy ? 'disabled' : ''}>Ставлю</button></div>`;
  }
  const rlStripHTML = nums => nums.map(n => `<div class="wheel-num ${numColor(n)}">${n}</div>`).join('');
  function rlSpin(kind) {
    if (rlBusy) return;
    let bet;
    if (kind === 'num') {
      const n = parseInt(($('#rl-num') || {}).value, 10);
      if (!(n >= 0 && n <= 36)) { toast('Выбери число от 0 до 36'); return; }
      bet = { name: 'Число ' + n, pay: 35, win: x => x === n, even: false };
    } else bet = Object.assign({ even: RL_BETS[kind].pay === 1 }, RL_BETS[kind]);
    const stake = takeBet();
    if (!stake) return;
    const n = Math.floor(Math.random() * 37);   // честная рулетка: 37 ячеек, без подкруток
    const won = bet.win(n);
    rlBusy = true;
    save(); render();
    const strip = $('#wheel-strip'), win = 40;
    const seq = Array.from({ length: win + 5 }, (_, i) => (i === win ? n : Math.floor(Math.random() * 37)));
    strip.innerHTML = rlStripHTML(seq);
    strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const box = strip.parentElement.clientWidth;
      strip.style.transition = 'transform 3.2s cubic-bezier(.1,.7,.15,1)';
      strip.style.transform = `translateX(${-(win * 52 + 24 - box / 2)}px)`;
    }));
    setTimeout(() => {
      rlBusy = false;
      rlLast.unshift(n);
      if (won) casinoWin(stake * (bet.pay + 1));
      haptic(won ? 'ok' : 'err');
      toast(won ? `Выпало ${n} · ${bet.name}: +${fmt(stake * bet.pay)} ₽` : `Выпало ${n} · ставка «${bet.name}» проиграла`);
      save(); render();
      const st = $('#wheel-strip'); if (st) st.innerHTML = rlStripHTML([n]);
    }, 3400);
  }

  // --- карты
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS_C = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const drawCard = () => ({ r: Math.floor(Math.random() * 13), s: Math.floor(Math.random() * 4) });
  const cardHTML = (c, hidden, extra = '') => hidden ? `<div class="pcard back"></div>`
    : `<div class="pcard ${c.s === 1 || c.s === 2 ? 'red' : ''} ${extra}"><b>${RANKS_C[c.r]}</b><span>${SUITS[c.s]}</span></div>`;

  // --- блэкджек
  function bjValue(cards) {
    let v = 0, aces = 0;
    for (const c of cards) { const r = RANKS_C[c.r]; if (r === 'A') { aces++; v += 11; } else v += ['J', 'Q', 'K'].includes(r) ? 10 : +r; }
    while (v > 21 && aces) { v -= 10; aces--; }
    return v;
  }
  function renderBlackjack() {
    if (!bj) return `${betBar()}<div class="card" style="text-align:center"><p class="small muted">Набери больше дилера, но не больше 21. Блэкджек платит 3:2, дилер берёт до 17.</p>
      <button class="btn full" data-action="bj-deal">Раздать</button></div>`;
    const done = bj.done;
    return `<div class="card">
      <div class="label">Дилер · ${done ? bjValue(bj.dealer) : '?'}</div><div class="hand">${bj.dealer.map((c, i) => cardHTML(c, i === 1 && !done)).join('')}</div>
      <div class="label" style="margin-top:12px">Ты · ${bjValue(bj.player)} · ставка ${fmt(bj.bet)} ₽</div><div class="hand">${bj.player.map(c => cardHTML(c)).join('')}</div>
      ${done ? `<div class="big-text" style="text-align:center;margin:12px 0" class="${bj.win > 0 ? 'good' : ''}">${bj.msg}</div>
        <button class="btn full" data-action="bj-new">Ещё раз</button>`
      : `<div class="row" style="margin-top:12px"><button class="btn grow" data-action="bj-hit">Ещё</button>
          <button class="btn btn-ghost grow" data-action="bj-stand">Хватит</button>
          ${bj.player.length === 2 && S.money >= bj.bet ? `<button class="btn btn-line grow" data-action="bj-double">Удвоить</button>` : ''}</div>`}</div>`;
  }
  function bjFinish() {
    const p = bjValue(bj.player);
    if (p <= 21) while (bjValue(bj.dealer) < 17) bj.dealer.push(drawCard());
    const d = bjValue(bj.dealer), pBJ = p === 21 && bj.player.length === 2, dBJ = d === 21 && bj.dealer.length === 2;
    let win = 0, msg;
    if (p > 21) msg = 'Перебор — проигрыш';
    else if (pBJ && !dBJ) { win = bj.bet * 2.5; msg = `Блэкджек! +${fmt(bj.bet * 1.5)} ₽`; }
    else if (d > 21 || p > d) { win = bj.bet * 2; msg = `Победа! +${fmt(bj.bet)} ₽`; }
    else if (p === d) { win = bj.bet; msg = 'Ничья — ставка возвращена'; }
    else msg = 'Дилер выиграл';
    casinoWin(win);
    bj.done = true; bj.win = win; bj.msg = msg;
    haptic(win > bj.bet ? 'ok' : win ? 'light' : 'err');
    save(); render();
  }

  // --- видеопокер «Валеты и выше»
  function pokerHand(cards) {
    const ranks = cards.map(c => c.r).sort((a, b) => a - b), suits = cards.map(c => c.s);
    const cnt = {}; for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1;
    const groups = Object.values(cnt).sort((a, b) => b - a);
    const flush = suits.every(x => x === suits[0]);
    const uniq = [...new Set(ranks)];
    const straight = uniq.length === 5 && (ranks[4] - ranks[0] === 4 || ranks.join() === '0,1,2,3,12');
    if (straight && flush) return ranks[0] === 8 ? 'royal' : 'sflush';
    if (groups[0] === 4) return 'four';
    if (groups[0] === 3 && groups[1] === 2) return 'full';
    if (flush) return 'flush';
    if (straight) return 'straight';
    if (groups[0] === 3) return 'three';
    if (groups[0] === 2 && groups[1] === 2) return 'twopair';
    if (groups[0] === 2 && Object.entries(cnt).some(([r, n]) => n === 2 && +r >= 9)) return 'jacks';
    return null;
  }
  function renderPoker() {
    const table = POKER_PAYTABLE.map(p => `<div class="kv small ${vp && vp.done && vp.hand === p.id ? 'gold' : ''}"><span>${p.name}</span><b>×${p.pay + 1}</b></div>`).join('');
    if (!vp) return `${betBar()}<div class="card"><p class="small muted">Тебе раздают 5 карт. Отметь, какие оставить, и замени остальные. Выигрыш — по таблице.</p>
      <button class="btn full" data-action="vp-deal">Раздать</button></div><div class="card">${table}</div>`;
    return `<div class="card"><div class="label">Ставка ${fmt(vp.bet)} ₽ · ${vp.done ? 'итог' : 'нажми на карты, которые оставляешь'}</div>
      <div class="hand five">${vp.cards.map((c, i) => `<button class="hold-btn" data-action="vp-hold" data-id="${i}" ${vp.done ? 'disabled' : ''}>${cardHTML(c, false, vp.hold[i] ? 'held' : '')}<span>${vp.hold[i] ? 'держу' : ''}</span></button>`).join('')}</div>
      ${vp.done ? `<div class="big-text" style="text-align:center;margin:12px 0">${vp.msg}</div><button class="btn full" data-action="vp-new">Ещё раз</button>`
        : `<button class="btn full" style="margin-top:12px" data-action="vp-draw">Заменить</button>`}</div>
      <div class="card">${table}</div>`;
  }

  function renderCasino() {
    const v = sub.casino;
    return `<div class="title">Казино</div>
      <div class="seg">
        <button class="${v === 'roulette' ? 'active' : ''}" data-sub="casino:roulette">Рулетка</button>
        <button class="${v === 'bj' ? 'active' : ''}" data-sub="casino:bj">Блэкджек</button>
        <button class="${v === 'poker' ? 'active' : ''}" data-sub="casino:poker">Покер</button></div>
      ${v === 'roulette' ? renderRoulette() : v === 'bj' ? renderBlackjack() : renderPoker()}
      <p class="small muted" style="text-align:center">Казино всегда немного в плюсе. Играй на то, что не жалко потерять.</p>`;
  }

  const VIEWS = { home: renderHome, inv: renderInv, cases: renderCases, career: renderCareer, biz: renderBiz, casino: renderCasino };
  // ---------- обучение: слайды «в чём суть», потом экскурсия с прожектором; шаг засчитывается действием или кнопкой «Понятно» ----------
  let tutBase = null, tutProfile = false, tutRaf = 0, tutShown = '';
  const TUT_DONE = {
    cases: () => tab === 'cases',
    free: () => cdLeft(CASE.free) > 0,
    career: () => tab === 'career',
    study: () => tab === 'career' && sub.career === 'skills',
    skill: () => Object.values(S.skills).reduce((a, b) => a + b, 0) > tutBase,
    jobs: () => tab === 'career' && sub.career === 'jobs',
    profile: () => tutProfile,
  };
  const tutOn = () => S.tut > 0 && S.tut <= TUTORIAL.length;
  function tutTick() {
    if (!tutOn()) { tutClear(); return; }
    const step = TUTORIAL[S.tut - 1];
    if (step.id === 'skill' && tutBase === null) tutBase = Object.values(S.skills).reduce((a, b) => a + b, 0);
    if (!step.info && TUT_DONE[step.id]()) return tutNext();
    if (step.go && tab !== step.go) { tab = step.go; render(); return; }
    let bubble = $('#tut'), hole = $('#tut-hole');
    if (!hole) { hole = document.createElement('div'); hole.id = 'tut-hole'; document.body.appendChild(hole); }
    if (!bubble) { bubble = document.createElement('div'); bubble.id = 'tut'; document.body.appendChild(bubble); }
    if (tutShown !== step.id) {
      tutShown = step.id;
      const pct = (S.tut - 1) / TUTORIAL.length * 100;
      bubble.innerHTML = `<i class="tut-arrow"></i>
        <div class="tut-top"><span class="tut-step">${S.tut} из ${TUTORIAL.length}</span><div class="tut-bar"><i style="width:${pct}%"></i></div>
          <button class="tut-skip" data-action="tut-skip">Пропустить</button></div>
        <div class="tut-title">${step.title}</div><div class="tut-text">${step.text}</div>
        ${step.info ? '<button class="btn btn-sm full" style="margin-top:10px" data-action="tut-next">Понятно</button>' : `<div class="tut-act">${ic('hand-finger')} Нажми на подсвеченное</div>`}`;
      bubble.classList.remove('in'); void bubble.offsetWidth; bubble.classList.add('in');
      const el = document.querySelector(step.sel);
      if (el) { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    if (!tutRaf) tutRaf = requestAnimationFrame(tutPlace);
  }
  // Каждый кадр: прожектор — вокруг нужного места, подсказка — над ним или под ним, стрелка смотрит на цель
  function tutPlace() {
    tutRaf = 0;
    if (!tutOn()) return tutClear();
    const step = TUTORIAL[S.tut - 1], hole = $('#tut-hole'), bubble = $('#tut');
    if (!hole || !bubble) return;
    const covered = !$('#modal').classList.contains('hidden') || !$('#roulette').classList.contains('hidden');
    hole.style.display = bubble.style.display = covered ? 'none' : '';
    const el = !covered && document.querySelector(step.sel);
    if (el && el.offsetParent !== null) {
      const r = el.getBoundingClientRect(), pad = 6, br = Math.min(18, r.height / 2 + pad);
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px', borderRadius: br + 'px', opacity: 1 });
      const bw = bubble.offsetWidth, bh = bubble.offsetHeight, below = r.top + r.height / 2 < innerHeight / 2;
      const left = Math.max(12, Math.min(innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
      const top = below ? r.bottom + pad + 14 : r.top - pad - 14 - bh;
      Object.assign(bubble.style, { left: left + 'px', top: Math.max(12, Math.min(innerHeight - bh - 12, top)) + 'px' });
      bubble.classList.toggle('up', !below);
      bubble.style.setProperty('--ax', Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - left)) + 'px');
      bubble.classList.remove('free');
    } else if (!covered) {
      // цели на экране нет — подсказка по центру, без прожектора
      Object.assign(hole.style, { left: '50%', top: '50%', width: '0px', height: '0px', opacity: 1 });
      Object.assign(bubble.style, { left: Math.max(12, (innerWidth - bubble.offsetWidth) / 2) + 'px', top: (innerHeight - bubble.offsetHeight) / 2 + 'px' });
      bubble.classList.add('free');
    }
    tutRaf = requestAnimationFrame(tutPlace);
  }
  function tutClear() {
    if (tutRaf) cancelAnimationFrame(tutRaf);
    tutRaf = 0; tutShown = '';
    $('#tut') && $('#tut').remove();
    $('#tut-hole') && $('#tut-hole').remove();
  }
  function tutNext() {
    S.tut++;
    save();
    if (S.tut > TUTORIAL.length) return finishTutorial();
    haptic('light');
    tutTick();
  }
  // Вступительные слайды: картинки собраны из того, что есть в игре
  let introI = 0;
  function introArt(i) {
    const car = id => `<img src="${ITEM[id].img}" alt="">`;
    return [
      `<div class="ia ia-hero">${car('c_chiron')}<div class="ia-logo">ЖИТУХА</div></div>`,
      `<div class="ia ia-flow"><div><b>📄</b><span>листовки</span><i>${fmt(ph(JOBS[0].pay))}/ч</i></div><em>→</em><div><b>💼</b><span>директор</span><i>${fmt(ph(JOB.director.pay))}/ч</i></div><em>→</em><div><b>🏢</b><span>бизнес</span><i>млн/ч</i></div></div>`,
      `<div class="ia ia-cards"><div class="ia-c">${car('c_supra')}<span>машины</span></div><div class="ia-c"><img src="${ITEM.h_monaco.img}" alt="" class="cover"><span>жильё</span></div><div class="ia-c"><b>🤝</b><span>связи</span></div></div>`,
      `<div class="ia ia-paths"><div><b>👔</b><span>Гражданский</span><i>работа · бизнес</i></div><div class="vs">или</div><div><img src="img/ranks/a6.png" alt="" class="pogon"><span>Силовик</span><i>звания · «крыша»</i></div></div>`,
      `<div class="ia ia-risk"><b>🐀</b><b>🚓</b><b>🦈</b><b>🎰</b><b>📜</b></div>`,
    ][i];
  }
  function showIntro() {
    let box = $('#intro');
    if (!box) { box = document.createElement('div'); box.id = 'intro'; document.body.appendChild(box); }
    const sl = TUT_SLIDES[introI], last = introI === TUT_SLIDES.length - 1;
    box.innerHTML = `<div class="intro-card">
        <div class="intro-art">${introArt(introI)}</div>
        <div class="intro-body"><div class="intro-title">${sl.title}</div><p>${sl.text}</p></div>
        <div class="intro-dots">${TUT_SLIDES.map((_, i) => `<i class="${i === introI ? 'on' : ''}"></i>`).join('')}</div>
        <div class="intro-btns">${introI ? `<button class="btn btn-ghost" data-action="intro-prev">${ic('chevron-left')}</button>` : ''}
          <button class="btn grow" data-action="${last ? 'intro-start' : 'intro-next'}">${last ? 'Покажи, что где' : 'Дальше'}</button></div>
        <button class="intro-skip" data-action="tut-skip">Я сам разберусь</button></div>`;
  }
  function startTutorial() { introI = 0; showIntro(); }
  function finishTutorial() {
    S.tut = -1;
    tutClear();
    const first = !S.tutPaid;
    if (first) { S.tutPaid = true; earn(TUTORIAL_REWARD.money); giveTicket(TUTORIAL_REWARD.ticket); }
    save(); render();
    showModal(`<div class="drop"><div class="drop-icon" style="font-size:48px">🎓</div><div class="drop-name">Обучение пройдено!</div>
      ${first ? `<p style="margin-top:8px">Подарок на старт: <b>+${fmt(TUTORIAL_REWARD.money)} ₽</b> и ${ticketName(TUTORIAL_REWARD.ticket)}.</p>` : ''}
      <div class="card" style="text-align:left;margin-top:10px">
        <div class="small">${ic('route')} Следи за «Следующей целью» на главной</div>
        <div class="small" style="margin-top:4px">${ic('checklist')} Делай задания дня в профиле</div>
        <div class="small" style="margin-top:4px">${ic('school')} Учись — навыки открывают работу и бизнес</div>
        <div class="small" style="margin-top:4px">${ic('shield')} С 5-го уровня можно пойти на службу</div></div>
      <button class="btn full" style="margin-top:12px" data-action="close">Погнали</button></div>`);
  }

  function render() {
    $('#view').innerHTML = VIEWS[tab]();
    const navTab = tab === 'inv' ? 'home' : tab;
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === navTab));
    updateLive();
    tutTick();
  }

  // То, что меняется каждую секунду, обновляем точечно
  function updateLive() {
    $('#money').textContent = fmt(S.money);
    const im = incomeMonth();
    $('#inc').textContent = (im >= 0 ? '+' : '') + fmt(ph(im));
    $('#prank').textContent = S.sil ? `${STR().icon} ${svcRank().name} · ${STR().name}` : rankInfo().cur.icon + ' ' + rankInfo().cur.name;
    $('#plvl').textContent = S.lvl;
    $('.hdr').style.setProperty('--lc', lvlColor(S.lvl));
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
    $('.nav [data-tab="career"]').classList.toggle('dot', !!(S.gig && now >= S.gig.until) || connAlert());
    // закончился перерыв в учёбе или подработка — перерисовать карьеру
    if (tab === 'career' && S.gig && now >= S.gig.until && sub.career === 'gigs' && !$('[data-action="gig-claim"]')) render();
    if (tab === 'career' && sub.career === 'skills') {
      document.querySelectorAll('[data-action="skill"]').forEach(b => { b.disabled = S.money < skillPrice(S.skills[b.dataset.id]); });
    }
  }

  // Улучшение бизнеса: засчитывается в задания и показывает, как изменилась прибыль
  function bizUp(id, fn) {
    if (!S.biz[id]) return;
    const before = bizStats(id).profit;
    if (fn() === false) return;
    const diff = bizStats(id).profit - before;
    progress('bizup');
    haptic('medium');
    toast(`Прибыль: ${diff >= 0 ? '+' : ''}${fmt(ph(diff))} ₽/ч`);
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
      if (el.dataset.sub) { const [k, v] = el.dataset.sub.split(':'); sub[k] = v; }
      if (el.dataset.goto) { tab = el.dataset.goto; render(); }
    },
    inv: id => { sub.inv = id; tab = 'inv'; render(); window.scrollTo(0, 0); },
    'sell-drop': id => { closeModal(); sell(id); },
    sell: id => sell(id),
    equip: id => { S.car = id; haptic('light'); save(); render(); },
    job: id => {
      if (S.sil || !meetsJob(JOB[id])) return;
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
      if (lvl >= SKILL_MAX || !pay(skillPrice(lvl))) return;
      S.skills[id]++;
      progress('skill');
      haptic('medium'); toast(`${SKILL[id].name}: уровень ${S.skills[id]}`);
      save(); render();
    },
    gig: id => {
      const d = GIG[id];
      if (S.sil || S.gig || !gigOpen(d)) return;
      S.gig = { id, until: Date.now() + d.h * 3600e3 };
      haptic('medium'); toast(`${d.icon} Подработка начата`);
      save(); render();
    },
    'gig-claim': () => {
      if (!S.gig || Date.now() < S.gig.until) return;
      const id0 = S.gig.id, v = gigPay(GIG[S.gig.id]);
      S.gig = null;
      earn(v, 'work');
      progress('gig');
      gainXP(Math.max(1, Math.round(GIG[id0].h * GIG_XP_PER_H)));
      haptic('ok'); toast(`Подработка: +${fmt(v)} ₽`);
      save(); render();
    },
    'claim-q': key => {
      const [kind, i] = key.split(':');
      const set = kind === 'daily' ? S.daily : S.weekly, q = set.list[+i];
      if (!q || q.claimed || q.prog < q.target) return;
      q.claimed = true;
      gainXP(XP_QUEST[kind]);
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
    'life-go': () => {
      const step = LIFE_PATH[S.life];
      if (!step) return;
      const go = {
        job: S.sil ? ['career', 'career', 'jobs'] : ['career', 'career', 'jobs'], skills: ['career', 'career', 'skills'],
        car: ['cases', 'cases', 'car'], carRarity: ['cases', 'cases', 'car'], home: ['cases', 'cases', 'home'],
        biz: S.sil ? ['career', 'career', 'jobs'] : ['biz'], bizProfit: S.sil ? ['career', 'career', 'jobs'] : ['biz'],
        conn: ['cases', 'cases', 'conn'], connLv: ['career', 'career', 'conn'], raceWins: ['career', 'career', 'race'],
        rank: ['biz'],
      }[step.type] || ['home'];
      tab = go[0];
      if (go[1]) sub[go[1]] = go[2];
      haptic('light'); window.scrollTo(0, 0); render();
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
      if (S.sil && (S.sil.r >= SERVICE_BIZ_UNTIL || !smallBiz(id))) return toast(S.sil.r >= SERVICE_BIZ_UNTIL ? `С «${SERVICE_RANKS[SERVICE_BIZ_UNTIL].name}» бизнес — нельзя` : 'На службе — только мелкий бизнес');
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
      S.biz[id] = { slots: d.s0, ads: 0, mgr: 0, inv: d.price };
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
    'cas-bet': v => { casBet = +v; render(); },
    'rl-spin': kind => rlSpin(kind),
    'bj-deal': () => {
      const bet = takeBet(); if (!bet) return;
      bj = { bet, player: [drawCard(), drawCard()], dealer: [drawCard(), drawCard()] };
      save();
      if (bjValue(bj.player) === 21 || bjValue(bj.dealer) === 21) bjFinish(); else render();
    },
    'bj-hit': () => { if (!bj || bj.done) return; bj.player.push(drawCard()); if (bjValue(bj.player) >= 21) bjFinish(); else render(); },
    'bj-stand': () => { if (bj && !bj.done) bjFinish(); },
    'bj-double': () => {
      if (!bj || bj.done || bj.player.length !== 2 || S.money < bj.bet) return;
      S.money -= bj.bet; bj.bet *= 2; bj.player.push(drawCard()); bjFinish();
    },
    'bj-new': () => { bj = null; render(); },
    'vp-deal': () => {
      const bet = takeBet(); if (!bet) return;
      const cards = [];
      while (cards.length < 5) { const c = drawCard(); if (!cards.some(x => x.r === c.r && x.s === c.s)) cards.push(c); }
      vp = { bet, cards, hold: [false, false, false, false, false] };
      save(); render();
    },
    'vp-hold': i => { if (!vp || vp.done) return; vp.hold[+i] = !vp.hold[+i]; render(); },
    'vp-draw': () => {
      if (!vp || vp.done) return;
      vp.cards = vp.cards.map((c, i) => {
        if (vp.hold[i]) return c;
        let n; do { n = drawCard(); } while (vp.cards.some(x => x.r === n.r && x.s === n.s));
        return n;
      });
      vp.hand = pokerHand(vp.cards);
      const p = POKER_PAYTABLE.find(x => x.id === vp.hand);
      const win = p ? vp.bet * (p.pay + 1) : 0;
      casinoWin(win);
      vp.done = true;
      vp.msg = p ? `${p.name}! +${fmt(win - vp.bet)} ₽` : 'Ничего не собралось';
      haptic(p ? 'ok' : 'err');
      save(); render();
    },
    'vp-new': () => { vp = null; render(); },
    'race-car': id => { S.raceCar = id; save(); render(); },
    'sil-join': () => {
      if (S.sil || S.lvl < SERVICE_MIN_LEVEL) return;
      const block = joinBlock();
      showModal(`${sheetHead('Служба')}
        <p class="small">Вместо работы — служба: звания по выслуге, опыту и учёбе, довольствие, «крыша» над бизнесами, задания, служебная машина с капитана.
          Подработки нельзя, бизнес — только мелкий и до звания «${SERVICE_RANKS[SERVICE_BIZ_UNTIL - 1].name}». Уволишься или сядешь — звание сгорит, вернуться можно не сразу.</p>
        <div class="card"><div class="small muted">Твоя репутация</div>${repBar()}</div>
        ${block ? `<div class="card danger small">${block}</div>` : ''}
        ${STRUCTURES.map(x => `<div class="card"><div class="row"><div class="job-ico">${x.icon}</div><div class="grow"><div class="job-name">${x.name}</div>
          ${x.perks.map(t => `<div class="small">${ic('star', 'gold')} ${t}</div>`).join('')}
          <div class="small muted">${ic('school')} Для званий: ${x.skills.map(k => SKILL[k].name).join(' и ')}</div></div></div>
          <button class="btn full" style="margin-top:8px" data-action="sil-pick" data-id="${x.id}" ${block ? 'disabled' : ''}>Поступить в ${x.name}</button></div>`).join('')}`, true);
    },
    'sil-pick': id => {
      if (S.sil || S.lvl < SERVICE_MIN_LEVEL || joinBlock() || !STRUCTURES.some(x => x.id === id)) return;
      S.sil = { s: id, r: 0, xp: 0, since: Date.now(), rankAt: Date.now(), roofs: [], mission: null, last: '', nextMission: Date.now(), nextCheck: 0, osb: false, clean: false, car: null };
      S.job = null;
      sub.career = 'jobs';
      closeModal(); haptic('ok'); toast(`${STR().icon} Ты на службе: ${svcRank().name} ${STR().name}`); save(); render();
    },
    'sil-quit': () => askConfirm(`Уволиться со службы? Звание, выслуга, «крыша» и служебная машина сгорят. Вернуться можно через ${Math.round(SERVICE_COOLDOWN_H * 60)} мин и только с нуля.`, () => {
      dropSvcCar();
      S.sil = null;
      S.silBan = Date.now() + SERVICE_COOLDOWN_H * 3600e3;
      haptic('medium'); toast('Ты снова гражданский'); save(); render();
    }),
    'sil-promote': () => {
      const reqs = promoReqs();
      if (!reqs || !reqs.every(x => x.ok)) return;
      S.sil.r++;
      S.sil.rankAt = Date.now();
      S.sil.reissueAt = 0;
      const rk = svcRank(), car = issueSvcCar();
      haptic('ok'); save(); render();
      showModal(`<div class="drop"><div class="pogon-pair">${boardImg(S.sil.r - 1, 'old')}${ic('arrow-right')}${boardImg(S.sil.r, 'new')}</div>
        <div class="drop-name">🎖️ ${rk.name}</div>
        <p style="margin-top:8px">Присвоено новое звание. Довольствие: <b>${fmt(ph(servicePay()))} ₽/ч</b>.</p>
        ${rk.bonus ? `<div class="card small" style="text-align:left">${ic('star', 'gold')} ${rk.bonus}</div>` : ''}
        ${rk.roofs ? `<p class="small">«Крыша»: ${rk.roofs === 1 ? 'один бизнес' : `до ${rk.roofs} бизнесов`}, вплоть до «${BUSINESSES[rk.tier].name}».</p>` : ''}
        ${car ? `<div class="card small" style="text-align:left"><div class="row"><div class="inv-icon">${visual(ITEM[car])}</div>
          <div class="grow">Служебная машина: <b>${ITEM[car].name}</b><br>${plateHTML(svcPlate(), 'sm')}</div></div></div>` : ''}
        <button class="btn full" data-action="close">Служу Отечеству!</button></div>`);
    },
    mission: i => {
      const sv = S.sil, m = sv && missionOf(), c = m && m.choices[+i];
      if (!c || Date.now() < sv.nextMission) return;
      const st = STR();
      sv.last = m.id;
      sv.nextMission = Date.now() + MISSION_EVERY_MIN * 60e3;
      nextMission();
      const failed = c.need && !st.force && Object.entries(c.need).some(([k, v]) => S.skills[k] < v);
      if (!failed && c.risk && Math.random() * 100 < svcRisk(c.risk))
        return caught(`«${m.title}»: деньги оказались мечеными — это была проверка.`);
      const xp = failed ? c.fail.xp : c.xp || 0;
      const money = !failed && c.money ? round2(rankMonth() * st.bribeMult * c.money) : 0;
      const got = svcXpAdd(xp);
      if (money) earn(money);
      repAdd(failed ? 3 : c.risk ? -(REP_BRIBE + 4 * c.money) : c.money ? 4 : REP_HONEST);
      progress('mission');
      gainXP(3 + Math.round(xp / 5));
      haptic(failed ? 'err' : 'ok'); save(); render();
      showModal(`<div class="drop"><div class="drop-name">${failed ? '😬 Не вышло' : '✅ ' + m.title}</div>
        <p style="margin-top:8px">${failed ? c.fail.text : c.risk ? 'Деньги у тебя. Никто ничего не видел… пока.' : 'Сделано чисто — начальство заметило.'}</p>
        <div class="big">${money ? '+' + fmt(money) + ' ₽ · ' : ''}${xpText(got, xp)}</div>
        <button class="btn full" data-action="close">Дальше</button></div>`);
    },
    rescue: id => {
      const sv = S.sil;
      if (!sv || !sv.caught) return;
      const why = sv.caught;
      sv.caught = null;
      if (!id || !S.conn[id] || !rescuers().includes(id)) return goToJail(why);
      if (Math.random() * 100 < rescueChance(id)) {
        const fee = Math.min(S.money, rescueFee());
        S.money -= fee;
        repAdd(-10);
        haptic('ok'); save(); render();
        showModal(`<div class="drop"><div class="drop-name good">📞 Замяли</div>
          <p style="margin-top:8px">${ITEM[id].name} сделал пару звонков — дело «потерялось». «Благодарность»: <b>${fmt(fee)} ₽</b>.</p>
          <p class="small muted">Репутация пострадала. В следующий раз может и не повезти.</p>
          <button class="btn full" data-action="close">Фух</button></div>`);
      } else goToJail(`${why} ${ITEM[id].name} не смог помочь.`);
    },
    'spec-start': t => {
      const sv = S.sil;
      if (!sv || sv.spec || !specList().some(([k]) => k === t) || specLeft(t)) return;
      sv.spec = ({ inv: genInv, chase: genChase, raid: genRaid, court: genCourt, audit: genAudit, quiz: genQuiz })[t]();
      sv.specCd = Object.assign(sv.specCd || {}, { [t]: Date.now() + SPEC_COOLDOWN_MIN * 60e3 });
      haptic('medium'); save(); render(); openSpec();
    },
    'spec-open': () => openSpec(),
    'inv-act': k => {
      const sp = S.sil && S.sil.spec;
      if (!sp || sp.t !== 'inv') return;
      if (k === 'dna') {
        if (sp.dna || sp.time < 2) return;
        const pool = sp.sus.map((_, i) => i).filter(i => i !== sp.c && !invOut(sp, i)).sort(() => Math.random() - 0.5);
        sp.ruled.push(...pool.slice(0, 2)); sp.dna = true; sp.time -= 2;
      } else {
        if (sp.known[k] || sp.time < 1) return;
        sp.known[k] = sp.sus[sp.c].a[k]; sp.time--;
      }
      haptic('light'); save(); openSpec();
    },
    'inv-arrest': i => {
      const sp = S.sil && S.sil.spec;
      if (!sp || sp.t !== 'inv') return;
      if (+i === sp.c) finishSpec(1 + 0.075 * sp.time, `Задержан ${sp.sus[sp.c].n} — он во всём признался. ${sp.time ? `Сэкономлено действий: ${sp.time}.` : ''}`);
      else finishSpec(0, `${sp.sus[+i].n} оказался ни при чём. Настоящий преступник — ${sp.sus[sp.c].n} — успел скрыться.`);
    },
    'ch-cell': i => {
      const sp = S.sil && S.sil.spec;
      i = +i;
      if (!sp || sp.t !== 'chase' || sp.g[i] || i === sp.x || chaseEdge(i)) return;   // на красные клетки (выезды) посты не ставят
      sp.g[i] = 2; sp.turns++;
      const d = chaseDist(sp.g);
      if (d[sp.x] === Infinity) return finishSpec(1 + Math.max(0, 10 - sp.turns) * 0.04, `Беглец заперт — постов понадобилось ${sp.turns}.`);
      const best = chaseNb(sp.x).filter(j => !sp.g[j]).sort((a, b) => d[a] - d[b] || Math.random() - 0.5)[0];
      sp.x = best;
      haptic('light');
      if (chaseEdge(sp.x)) return finishSpec(0, 'Беглец вырвался из города. Ориентировка разослана по области.');
      save(); openSpec();
    },
    'court-move': k => { const sp = S.sil && S.sil.spec; if (sp && sp.t === 'court') courtStep(sp, k); },
    'audit-open': i => { const sp = S.sil && S.sil.spec; if (sp && sp.t === 'audit') auditStep(sp, +i); },
    'raid-act': k => { const sp = S.sil && S.sil.spec; if (sp && sp.t === 'raid') raidStep(sp, k); },
    'raid-drone': () => {
      const sp = S.sil && S.sil.spec, room = sp && sp.t === 'raid' && sp.cur !== null && sp.rooms[sp.cur];
      if (!room || room.sure || !sp.drones) return;
      sp.drones--; room.sure = true;
      haptic('light'); save(); openSpec();
    },
    'raid-pick': i => {
      const sp = S.sil && S.sil.spec;
      if (!sp || sp.t !== 'raid') return;
      i = +i;
      if (i < 0) sp.cur = null; else if (raidOpen(sp, i)) sp.cur = i; else return;
      save(); openSpec();
    },
    'quiz-check': i => { const sp = S.sil && S.sil.spec; if (sp && sp.t === 'quiz') quizStep(sp, 'check', +i); },
    'quiz-catch': i => { const sp = S.sil && S.sil.spec; if (sp && sp.t === 'quiz') quizStep(sp, 'catch', +i); },
    'svc-writeoff': () => {
      if (!svcCar() || writeoffBlock()) return;
      const cost = writeoffCost(), id = S.sil.car, p0 = svcPlate(), uniq = p0 && p0.collect;
      if (uniq) return askConfirm(`Выкупить «${ITEM[id].name}» с номером ${p0.a}${p0.d}${p0.b} ${p0.r} за ${fmt(cost)} ₽?\n\n⚠️ Это твой единственный номер 97 региона в ведомстве «${STR().name}». Государство больше такой не выдаст — на следующей служебной будет номер другой серии. Коллекционер даст за него ${fmt(p0.collect)} ₽.`, () => doWriteoff(cost, id));
      askConfirm(`Выкупить «${ITEM[id].name}»${p0 ? ' со служебным номером' : ''} за ${fmt(cost)} ₽? Перекупщик даст за машину ${fmt(sellPrice(ITEM[id]))} ₽${p0 ? ` и за номер ${fmt(plateSell(p0))} ₽` : ''}. Продать можно будет через ${SVC_SELL_LOCK_MIN} мин, новую служебную выдадут через ${SVC_REISSUE_H} ч.`, () => doWriteoff(cost, id));
    },
    'roof-take': id => {
      const sv = S.sil, rk = sv && svcRank(), i = BUSINESSES.findIndex(d => d.id === id);
      if (!sv || i < 0 || i > rk.tier || sv.roofs.includes(id) || sv.roofs.length >= rk.roofs) return;
      sv.roofs.push(id);
      repAdd(-REP_ROOF);
      haptic('ok'); toast(`☂️ ${BIZ[id].name} теперь под «крышей»`); save(); render();
    },
    'roof-drop': id => {
      if (!S.sil || !S.sil.roofs.includes(id)) return;
      S.sil.roofs = S.sil.roofs.filter(x => x !== id);
      repAdd(REP_ROOF / 2);
      save(); render();
    },
    osb: how => {
      const sv = S.sil;
      if (!sv || !sv.osb) return;
      sv.osb = false;
      closeModal();
      if (how === 'pay') {
        if (!pay(osbPayoff())) { sv.osb = true; return; }
        repAdd(-5);
        toast('Вопрос закрыт');
      } else if (how === 'give') {
        const top = sv.roofs.slice().sort((x, y) => roofPay(y) - roofPay(x))[0];
        if (!top) { sv.osb = true; return; }
        sv.roofs = sv.roofs.filter(x => x !== top);
        repAdd(5);
        toast(`${BIZ[top].name} больше не под твоей «крышей»`);
      } else if (how === 'reprimand') {
        sv.xp = Math.max(0, sv.xp - 100);
        toast('Выговор в личное дело');
      } else if (Math.random() * 100 < denyRisk()) {
        return caught('Проверка нашла переводы от бизнесменов. Отказ не помог.');
      } else { repAdd(-5); toast('Доказательств не нашли. Пронесло'); }
      haptic('medium'); save(); render();
    },
    'plate-reg': id => { S.plateReg = id; closeModal(); save(); render(); },
    'plate-regs': () => showModal(`${sheetHead('Регион номера')}
      <p class="small muted">Чем престижнее регион, тем дороже номера — и наборы тоже.</p>
      <button class="list-btn ${S.plateReg === 'all' ? 'active' : ''}" data-action="plate-reg" data-id="all">
        <span class="grow"><b>Все регионы</b><br><span class="small muted">регион выпадет случайно, цена — средняя</span></span>
        <span class="small gold">${ic('dice-5')}</span></button>
      ${PLATE_REGIONS.map(r => `<button class="list-btn ${r.id === S.plateReg ? 'active' : ''}" data-action="plate-reg" data-id="${r.id}">
        <span class="grow"><b>${r.name}</b><br><span class="small muted">${r.codes.join(', ')}</span></span>
        <span class="small gold">${r.mult > 1 ? '×' + String(r.mult).replace('.', ',') : ''}</span></button>`).join('')}`, true),
    'plate-open': id => openPlate(id),
    'plate-on': id => plateChooseCar(+id),
    'plate-set': v => {
      const [pid, car] = v.split(':'), p = S.plates.find(x => x.id === +pid);
      if (!p || p.svc || !S.inv[car]) return;
      if (isSvcCar(car)) return toast('На служебной — служебный номер');
      for (const x of S.plates) if (x.car === car) x.car = null;
      p.car = car;
      closeModal(); haptic('light'); toast(`Номер на ${ITEM[car].name}`); save(); render();
    },
    'plate-off': id => { const p = S.plates.find(x => x.id === +id); if (p && !p.svc) p.car = null; save(); render(); },
    'plate-sell': id => {
      const p = S.plates.find(x => x.id === +id);
      if (!p || p.svc) return;
      if (sellLock('p:' + p.id)) return toast(`Номер только что списан — продать можно через ${fmtTime(sellLock('p:' + p.id))}`);
      S.plates = S.plates.filter(x => x !== p);
      earn(plateSell(p));
      closeModal(); haptic('light'); toast(`Номер продан +${fmt(plateSell(p))} ₽`); save(); render();
    },
    race: lv => startRace(raceCarId(), +lv),
    tune: id => {
      if (isSvcCar(id)) return toast('Служебную машину тюнинговать нельзя');
      const g = carState(id);
      if (g.stage >= TUNE_STAGES.length) return;
      const c = tuneCost(id, g.stage);
      if (!pay(c)) return;
      g.stage++;
      g.tuneInv = (g.tuneInv || 0) + c;
      haptic('ok'); toast(`🔧 ${TUNE_STAGES[g.stage - 1].name} — Stage ${g.stage}`); save(); render();
    },
    'race-tap': () => raceTap(),
    service: id => {
      const st = carState(id), c = ITEM[id].value * SERVICE_COST;
      if (st.wear <= 0 || !pay(c)) return;
      st.wear = 0;
      haptic('light'); toast('ТО пройдено: износ 0%'); save(); render();
    },
    repair: id => {
      const st = carState(id), c = ITEM[id].value * REPAIR_COST;
      if (!st.broken || !pay(c)) return;
      st.broken = false; st.wear = 0;
      haptic('ok'); toast('Машина отремонтирована'); save(); render();
    },
    'inc-open': id => showBizInc(id),
    'inc-do': v => { const [id, i] = v.split(':'); incDo(id, +i); },
    'biz-slot': id => bizUp(id, () => {
      const b = S.biz[id], c = slotCost(id);
      if (b.slots >= BIZ[id].sMax || !pay(c)) return false;
      b.slots++; b.inv += c;
    }),
    'biz-ad': id => bizUp(id, () => {
      const b = S.biz[id], c = adCost(id);
      if (b.ads >= BIZ[id].sMax - BIZ[id].s0 || !pay(c)) return false;
      b.ads++; b.inv += c;
    }),
    'biz-mgr': id => {
      const b = S.biz[id], d = BIZ[id];
      if (!b) return;
      showModal(`${sheetHead('Управляющий · ' + d.name)}
        <p class="small muted">Чем круче управляющий, тем дороже, но тем больше приносит бизнес и тем чаще сам решает его проблемы.</p>
        ${MANAGERS.map((M, i) => {
          const t = i + 1, cur = b.mgr === t, ok = S.skills.biz >= M.req, delta = bizDelta(id, { mgr: t });
          return `<div class="card ${cur ? 'accent' : ''} ${ok ? '' : 'locked'}"><div class="row"><div class="job-ico">${M.icon}</div>
            <div class="grow"><div class="job-name">${M.name}</div>
              <div class="small">${Math.round(M.eff * 100)}% эффективности${M.solve ? ` · решает проблемы в ${M.solve}%` : ''}</div>
              <div class="small muted">${fmt(ph(mgrSalary(id, t)))} ₽/ч · найм ${fmt(mgrHire(id, t))} ₽${M.req ? ` · Бизнес ${M.req}` : ''}</div></div>
            ${cur ? '<span class="tag">Работает</span>' : ok ? `<button class="btn btn-sm btn-col" data-action="mgr-hire" data-id="${id}:${t}">${delta >= 0 ? '+' : ''}${fmt(ph(delta))}<span class="btn-top">₽/ч</span></button>` : `<span class="tag lock">${ic('lock')}</span>`}</div></div>`;
        }).join('')}
        ${b.mgr ? `<button class="btn btn-ghost full" data-action="mgr-hire" data-id="${id}:0">Уволить — управлять самому (${Math.round(ownerEff() * 100)}%)</button>` : ''}`, true);
    },
    'mgr-hire': v => {
      const [id, t] = v.split(':'), b = S.biz[id], tier = +t;
      if (!b || b.mgr === tier) return;
      if (tier && S.skills.biz < MANAGERS[tier - 1].req) return;
      if (tier && !pay(mgrHire(id, tier))) return;
      b.mgr = tier;
      closeModal(); haptic(tier ? 'ok' : 'light');
      toast(tier ? `${MANAGERS[tier - 1].icon} ${MANAGERS[tier - 1].name} в «${BIZ[id].name}»` : 'Управляешь сам');
      save(); render();
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
    'prof-tab': k => showProfile(k),
    'copy-pid': () => {
      const done = () => { haptic('light'); toast('ID скопирован'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(S.pid).then(done, () => toast(S.pid));
      else toast(S.pid);
    },
    'inc-toggle': () => toast('Сколько ты зарабатываешь за реальный час: работа, аренда, бизнес и «крыша»'),
    'intro-next': () => { introI = Math.min(TUT_SLIDES.length - 1, introI + 1); haptic('light'); showIntro(); },
    'intro-prev': () => { introI = Math.max(0, introI - 1); showIntro(); },
    'intro-start': () => { $('#intro') && $('#intro').remove(); S.tut = 1; tutBase = null; tutProfile = false; save(); tab = 'home'; render(); },
    'tut-next': () => { if (tutOn() && TUTORIAL[S.tut - 1].info) tutNext(); },
    'tut-skip': () => { S.tut = -1; $('#intro') && $('#intro').remove(); tutClear(); save(); },
    'tut-restart': () => { closeModal(); S.tut = 0; save(); tab = 'home'; render(); startTutorial(); },
    'coll-claim': id => {
      const c = COLLECTIONS.find(x => x.id === id);
      if (!c || S.coll[id] || !collState(c).done) return;
      S.coll[id] = true;
      if (c.money) earn(monthsMoney(c.money, 20e3));
      if (c.ticket) giveTicket(c.ticket);
      if (c.badge && !S.badges.includes(c.badge)) { S.badges.push(c.badge); showName(); }
      haptic('ok'); toast(`🏆 ${c.name}: ${collReward(c)}`); save(); render(); showProfile();
    },
    'item-info': v => { const [c, id] = v.split(':'); showItemInfo(c, id); },
    'multi-pick': (i, el) => {
      if (!multi) return;
      i = +i;
      if (multi.picked.has(i)) multi.picked.delete(i); else multi.picked.add(i);
      el.classList.toggle('picked', multi.picked.has(i));
      const b = $('#multi-sel');
      b.disabled = !multi.picked.size;
      b.textContent = multi.picked.size ? `Продать ${multi.picked.size} · ${fmt(multiSum(false))} ₽` : 'Продать выбранное';
      haptic('light');
    },
    'multi-sell': how => {
      if (!multi) return;
      let sum = 0, n = 0;
      multi.list.forEach((r, i) => {
        if (r.sold || r.it.cat === 'conn' || (how !== 'all' && !multi.picked.has(i))) return;
        const v = sellOne(r.it.id);
        if (v) { sum += v; n++; r.sold = true; }
      });
      multi = null;
      closeModal(); haptic('ok'); toast(`Продано ${n} шт. · +${fmt(sum)} ₽`); save(); render();
    },
    'confirm-yes': () => { const cb = confirmCb; confirmCb = null; closeModal(); if (cb) cb(); },
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
      } else if (sp.type === 'ticket') {
        giveTicket(sp.case);
        toast(`${it.icon} ${ticketName(sp.case)}`);
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
      if (f.drag && S.biz[fv.biz]) S.biz[fv.biz].nephew = Date.now() + f.drag.hours * 3600e3;
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
      if (c) c.xp = Math.max(cxp(fv.conn, connLv(fv.conn) - 1), c.xp - FAVOR_FAIL_XP);
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
    'dbg-event': id => { if (!isDebug() || !eventOk(EV[id])) return; S.event = null; closeModal(); startEvent(EV[id]); },
    'dbg-money': v => { if (!isDebug()) return; S.money += +v; save(); render(); showProfile(); toast(`+${fmt(+v)} ₽`); },
    'dbg-favor': () => {
      if (!isDebug()) return;
      if (!Object.keys(S.conn).length) { toast('Сначала нужна хотя бы одна связь'); return; }
      S.favor = null; S.nextFavor = 0; maybeFavor(); closeModal(); tab = 'conn'; render();
    },
    'dbg-free': () => {
      if (!isDebug()) return;
      S.cd = {}; if (S.gig) S.gig.until = 0;
      for (const c of Object.values(S.conn)) { c.cd = {}; c.sp = 0; }
      // всё, что ждёт реального времени: служба, гонки, сделка, номера, бизнес
      S.silBan = 0;
      if (S.sil) {
        S.sil.nextMission = 0; S.sil.specCd = {};
        S.sil.since -= 7 * 86400e3; S.sil.rankAt = 0; S.sil.carAt = 0;   // выслуга +7 суток: хватит на любое звание
      }
      S.pool = { n: RACE_POOL, ts: Date.now() };
      for (const g of Object.values(S.garage)) { g.tank = TANK_RACES; g.ts = Date.now(); }
      if (S.deal) S.deal.until = 0;
      for (const b of Object.values(S.biz)) b.nephew = 0;
      save(); render(); showProfile(); toast('Таймеры сброшены');
    },
    promo: () => redeem(($('#promo-input') || {}).value),
    'dbg-hash': async () => {
      if (!isDebug()) return;
      const code = normCode(($('#dbg-code') || {}).value || '');
      if (!code) { toast('Введи код'); return; }
      const h = await sha256(code);
      $('#dbg-hash-out').textContent = `{ hash: '${h}', label: '${code}', reward: { money: 1e6 } },`;
    },
    credits: () => showModal(`${sheetHead('Авторы фото')}
      <p class="small">Фотографии с Wikimedia Commons: фон удалён, размер уменьшен.</p>
      ${ITEMS.concat(CASES).filter(i => i.credit).map(i => `<div class="kv small"><span>${i.name}</span><b>${i.credit}</b></div>`).join('')}
      <div class="kv small"><span>Погоны армии и полиции</span><b>Wikimedia Commons · общественное достояние</b></div>`, true),
    reset: () => askConfirm('Точно начать заново? Весь прогресс пропадёт.', () => {
      const pid = S.pid;
      S = newState(); S.pid = pid; ensureQuests(); save(); tab = 'home'; closeModal(); render();
    }),
  };

  document.addEventListener('click', e => {
    if (e.target.id === 'modal') { if (race) return; closeModal(); return; }
    const t = e.target.closest('[data-tab],[data-goto],[data-action],[data-sub]');
    if (!t || t.disabled) return;
    // Платные открытия — в два нажатия: первое показывает «Точно?», второе открывает
    if (t.dataset.confirm && !t.classList.contains('armed')) {
      document.querySelectorAll('.armed').forEach(b => { b.classList.remove('armed'); b.innerHTML = b.dataset.html; });
      t.dataset.html = t.innerHTML;
      t.classList.add('armed');
      t.innerHTML = `<span class="btn-top">${t.dataset.confirm}</span>Открыть?`;
      haptic('light');
      clearTimeout(t._arm);
      t._arm = setTimeout(() => { if (t.classList.contains('armed')) { t.classList.remove('armed'); t.innerHTML = t.dataset.html; } }, 3000);
      return;
    }
    if (t.classList.contains('armed')) { clearTimeout(t._arm); t.classList.remove('armed'); }
    if (t.dataset.action) { ACTIONS[t.dataset.action](t.dataset.id, t); return; }
    if (t.dataset.sub) { const [k, v] = t.dataset.sub.split(':'); sub[k] = v; }
    if (t.dataset.tab || t.dataset.goto) {
      tab = t.dataset.tab || t.dataset.goto;
      haptic('light');
      window.scrollTo(0, 0);
    }
    render();
  });
  // Шапка закреплена; тень появляется, только когда под ней уже есть прокрученный контент
  addEventListener('scroll', () => $('.hdr').classList.toggle('scrolled', scrollY > 4), { passive: true });
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

  // v30: служебные машины появились позже — выдаём тем, кто уже на звании
  if (S.sil && S.sil.car && ITEM[S.sil.car] && !ITEM[S.sil.car].svc) { issueSvcCar(); save(); }
  if (S.sil && !svcCar() && !S.sil.reissueAt && SERVICE_CARS[S.sil.s][S.sil.r]) { issueSvcCar(); save(); }
  const away = (Date.now() - S.lastTick) / 1000;
  const first = catchUp();
  ensureQuests();
  render();
  reportPlayer();
  if (S.tut === 0) startTutorial();
  else if (S.event) showEvent();
  else maybeEvent();
  if (away > 60 && first.earned >= 1 && !S.event) showOffline(first);

  setInterval(tick, 1000);
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); cloudSaveSoon(true); } else tick(); });
  cloudLoad();
  window.addEventListener('pagehide', save);
})();
