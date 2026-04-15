/* ══════════════════════════════════════
   草刈りトラッカー — app.js
   Kusagari Tracker — Main Logic
══════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────
   DATA LAYER（Firebase移行を想定した抽象化）
───────────────────────────────────── */
const DB = {
  _key: k => `kt_${k}`,
  get(k)    { try { return JSON.parse(localStorage.getItem(this._key(k))); } catch { return null; } },
  set(k, v) { localStorage.setItem(this._key(k), JSON.stringify(v)); },
  records()       { return this.get('records') || []; },
  saveRecord(r)   { const a = this.records(); a.unshift(r); this.set('records', a); },
  deleteRecord(id){ this.set('records', this.records().filter(r => r.id !== id)); },
  profile()       { return this.get('profile') || { name: 'ユーザー', weight: 60, defaultEquip: 'kari', defaultSpider: 'SP851' }; },
  saveProfile(p)  { this.set('profile', p); },
  spots()         { return this.get('spots') || DEFAULT_SPOTS; },
  saveSpots(s)    { this.set('spots', s); },
  badges()        { return this.get('badges') || []; },
  saveBadges(b)   { this.set('badges', b); },
};

/* ─────────────────────────────────────
   CONSTANTS
───────────────────────────────────── */
const TERRAIN = {
  flat:    { label: '平地',   labelEn: 'Flat',   icon: '🟢', stars: '★☆☆☆', factor: 1.00 },
  gentle:  { label: '緩傾斜', labelEn: 'Gentle', icon: '🟡', stars: '★★☆☆', factor: 1.20 },
  steep:   { label: '急傾斜', labelEn: 'Steep',  icon: '🟠', stars: '★★★☆', factor: 1.45 },
  extreme: { label: '激急斜面',labelEn: 'Extreme',icon: '🔴', stars: '★★★★', factor: 1.75 },
};

const EQUIP = {
  kari:    { label: '刈払い機',       labelEn: 'Brush Cutter',   met: 4.5, bladeW: 0.90, eff: 0.75 },
  spider:  { label: 'スパイダーモア', labelEn: 'Spider Mower',   met: 3.0, bladeW: null, eff: 0.90 },
  hammer:  { label: 'ハンマーナイフモア', labelEn: 'Hammer Knife', met: 3.2, bladeW: null, eff: 0.92 },
  hand:    { label: '手押しモア',     labelEn: 'Walk-Behind',    met: 3.5, bladeW: 0.55, eff: 0.88 },
  other:   { label: 'その他',         labelEn: 'Other',          met: 3.0, bladeW: 0.80, eff: 0.80 },
};

// 刈払い機：メーカー別モデル一覧
const KARI_MAKERS = {
  orec:     { label: 'オーレック',   labelEn: 'OREC' },
  kyoritsu: { label: '共立(やまびこ)', labelEn: 'Kyoritsu' },
  honda:    { label: 'Honda',        labelEn: 'Honda' },
  kubota:   { label: 'クボタ',       labelEn: 'Kubota' },
  makita:   { label: 'マキタ',       labelEn: 'Makita' },
  husq:     { label: 'ハスクバーナ', labelEn: 'Husqvarna' },
  other:    { label: 'その他',       labelEn: 'Other' },
};

const KARI_MODELS = {
  orec:     [
    { id: 'WM716', label: 'WM716（26cc）', bladeW: 0.90 },
    { id: 'WM721', label: 'WM721（21cc）', bladeW: 0.90 },
    { id: 'BC2611', label: 'BC2611（26cc）', bladeW: 0.90 },
    { id: 'orec_other', label: 'その他オーレック', bladeW: 0.90 },
  ],
  kyoritsu: [
    { id: 'RME262', label: 'RME262（26cc）', bladeW: 0.90 },
    { id: 'RME231', label: 'RME231（23cc）', bladeW: 0.90 },
    { id: 'RME2650', label: 'RME2650（26cc）', bladeW: 0.90 },
    { id: 'kyoritsu_other', label: 'その他共立', bladeW: 0.90 },
  ],
  honda:    [
    { id: 'UMK425', label: 'UMK425（25cc）', bladeW: 0.90 },
    { id: 'UMK435', label: 'UMK435（35cc）', bladeW: 0.90 },
    { id: 'honda_other', label: 'その他Honda', bladeW: 0.90 },
  ],
  kubota:   [
    { id: 'ARS500', label: 'ARS500（50cc）', bladeW: 0.90 },
    { id: 'kubota_other', label: 'その他クボタ', bladeW: 0.90 },
  ],
  makita:   [
    { id: 'MEM2600', label: 'MEM2600（26cc）', bladeW: 0.90 },
    { id: 'MEM3401', label: 'MEM3401（34cc）', bladeW: 0.90 },
    { id: 'makita_other', label: 'その他マキタ', bladeW: 0.90 },
  ],
  husq:     [
    { id: '135R', label: '135R（35cc）', bladeW: 0.90 },
    { id: '545RX', label: '545RX（45cc）', bladeW: 0.90 },
    { id: 'husq_other', label: 'その他ハスクバーナ', bladeW: 0.90 },
  ],
  other:    [
    { id: 'kari_custom', label: 'その他（手動入力）', bladeW: 0.90 },
  ],
};

// スパイダーモア機種
const SPIDER_MODELS_LIST = [
  { id: 'SP851',   label: 'オーレック SP851',   bladeW: 0.85 },
  { id: 'SP852',   label: 'オーレック SP852',   bladeW: 0.85 },
  { id: 'SMP60',   label: 'オーレック SMP60',   bladeW: 0.60 },
  { id: 'SMP80',   label: 'オーレック SMP80',   bladeW: 0.80 },
  { id: 'SPM710',  label: '共立 SPM710',        bladeW: 0.71 },
  { id: 'SPM812',  label: '共立 SPM812',        bladeW: 0.81 },
  { id: 'SZR850',  label: 'クボタ SZR850',      bladeW: 0.85 },
  { id: 'YSM850G', label: 'ヤンマー YSM850G',  bladeW: 0.85 },
  { id: 'spider_custom', label: 'その他（手動入力）', bladeW: 0.85 },
];

// ハンマーナイフモア機種
const HAMMER_MODELS_LIST = [
  { id: 'HRC662',  label: 'オーレック HRC662（62cm）', bladeW: 0.62 },
  { id: 'HRC802',  label: 'オーレック HRC802（80cm）', bladeW: 0.80 },
  { id: 'MHR651',  label: '共立 MHR651（65cm）',      bladeW: 0.65 },
  { id: 'MHR801',  label: '共立 MHR801（80cm）',      bladeW: 0.80 },
  { id: 'KRC800',  label: 'クボタ KRC800（80cm）',    bladeW: 0.80 },
  { id: 'AM30',    label: 'ゼノア AM30（90cm）',       bladeW: 0.90 },
  { id: 'hammer_custom', label: 'その他（手動入力）',  bladeW: 0.80 },
];

// 後方互換のため残す
const SPIDER_MODELS = Object.fromEntries(SPIDER_MODELS_LIST.map(m => [m.id, m.bladeW]));

const BLADE_TYPES = {
  chip255: { label: 'チップソー 255mm', labelEn: 'Chip Saw 255mm' },
  chip230: { label: 'チップソー 230mm', labelEn: 'Chip Saw 230mm' },
  nylon:   { label: 'ナイロンコード',   labelEn: 'Nylon Cord' },
  grass:   { label: '草刈刃',           labelEn: 'Grass Blade' },
};

const BADGES_DEF = [
  { id: 'first',    label: '🌱 はじめての一刈り', labelEn: 'First Cut',         check: (rs) => rs.length >= 1 },
  { id: 'tan',      label: '🌾 一反刈りの達人',   labelEn: '10a Master',        check: (rs) => rs.some(r => r.area >= 1000) },
  { id: 'town',     label: '🏡 一町歩マスター',    labelEn: '1ha Master',        check: (rs) => rs.reduce((a,r)=>a+r.area,0) >= 10000 },
  { id: 'early',    label: '🌅 早起き草刈り名人',  labelEn: 'Early Bird',        check: (rs) => rs.some(r => new Date(r.startTime).getHours() < 6) },
  { id: 'burner',   label: '🔥 カロリーバーナー',  labelEn: 'Calorie Burner',    check: (rs) => rs.some(r => r.calories >= 500) },
  { id: 'streak7',  label: '📅 草刈り7日連続',     labelEn: '7-Day Streak',      check: (rs) => checkStreak(rs, 7) },
  { id: 'spider5',  label: '🕷 スパイダーの使い手', labelEn: 'Spider Master',     check: (rs) => rs.filter(r=>r.equipment==='spider').length >= 5 },
  { id: 'mega',     label: '🏔 里山の守り人',      labelEn: 'Satoyama Guardian', check: (rs) => rs.reduce((a,r)=>a+r.area,0) >= 100000 },
  { id: 'extreme',  label: '⚡ 激急斜面チャレンジ', labelEn: 'Extreme Climber',   check: (rs) => rs.some(r => r.terrain === 'extreme') },
  { id: 'rain',     label: '🌧 雨にも負けず',       labelEn: 'Rain Warrior',      check: (rs) => rs.some(r => r.weather === '雨') },
];

const DEFAULT_SPOTS = [
  { id: 'spot1', name: '高仙の里よの 南法面', color: '#9ee840', targetFreq: 4, terrain: 'steep',  area: 1200, lastMowed: null, memo: '' },
  { id: 'spot2', name: '田んぼ西側畦畔',      color: '#6ab82e', targetFreq: 6, terrain: 'flat',   area: 2500, lastMowed: null, memo: '' },
  { id: 'spot3', name: 'R313沿い道路脇草地',  color: '#e8a020', targetFreq: 3, terrain: 'gentle', area:  800, lastMowed: null, memo: '' },
];

const FOOD_EQUIV = [
  { name: '缶ビール', nameEn: 'Beer (350ml)', kcal: 140 },
  { name: 'ご飯',     nameEn: 'Rice bowl',    kcal: 200 },
  { name: 'おにぎり', nameEn: 'Rice ball',    kcal: 180 },
];

/* ─────────────────────────────────────
   STATE
───────────────────────────────────── */
const state = {
  screen: 'home',
  // work session
  working: false,
  paused: false,
  startTime: null,
  pauseStart: null,
  totalPaused: 0,
  elapsedSec: 0,
  terrain: 'flat',
  equipment: 'kari',
  // 刈払い機
  kariMaker: 'orec',
  kariModel: 'WM716',
  bladeType: 'chip255',
  // スパイダー
  spiderModel: 'SP851',
  // ハンマーナイフ
  hammerModel: 'HRC662',
  // 共通
  modelBladeW: 0.90,
  targetSpotId: null,
  spotName: '',
  weather: '',
  temperature: null,
  tempAuto: false,
  estimatedSlope: null,
  // GPS
  gpsEnabled: false,
  gpsWatcher: null,
  gpsPoints: [],
  gpsDist: 0,
  gpsAccuracyOk: false,
  lastGpsPoint: null,
  // result
  lastRecord: null,
  // new spot temp
  newSpotLat: null,
  newSpotLon: null,
  newSpotColor: '#9ee840',
};

let timerInterval = null;

/* ─────────────────────────────────────
   ROUTER
───────────────────────────────────── */
function navigate(screen) {
  // 地図から離れるときLiveトラッキング停止（作業中は継続）
  if (state.screen === 'map' && screen !== 'map' && !state.working) {
    stopLiveTracking();
  }
  state.screen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.classList.add('active');
  const nb = document.getElementById(`nav-${screen}`);
  if (nb) nb.classList.add('active');
  // render screen
  if (screen === 'home')     renderHome();
  if (screen === 'records')  renderRecords();
  if (screen === 'map')      renderMap();
  if (screen === 'settings') renderSettings();
  if (screen === 'result')   renderResult();
}

/* ─────────────────────────────────────
   HOME
───────────────────────────────────── */
function renderHome() {
  const records = DB.records();
  const profile = DB.profile();
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthRecs = records.filter(r => r.date.startsWith(monthStr));

  // Stats strip
  const totalArea = monthRecs.reduce((a, r) => a + r.area, 0);
  const totalKcal = monthRecs.reduce((a, r) => a + r.calories, 0);
  qs('#stat-month-area').innerHTML = `${(totalArea/100).toFixed(1)}<span class="ast-u">a</span>`;
  qs('#stat-month-count').innerHTML = `${monthRecs.length}<span class="ast-u">回</span>`;
  qs('#stat-month-kcal').innerHTML  = `${totalKcal.toLocaleString()}<span class="ast-u">kcal</span>`;

  // Weather
  fetchWeather();

  // Recent records
  const list = qs('#home-record-list');
  if (records.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">まだ記録がありません<br><small>作業を開始してみましょう！</small></div>`;
    return;
  }
  list.innerHTML = records.slice(0, 5).map(r => recordCardHTML(r)).join('');
}

function recordCardHTML(r) {
  const d = new Date(r.startTime);
  const day = String(d.getDate()).padStart(2,'0');
  const mon = d.toLocaleString('en', {month:'short'}).toUpperCase();
  const eq = EQUIP[r.equipment] || EQUIP.other;
  const te = TERRAIN[r.terrain] || TERRAIN.flat;
  const areaA = (r.area / 100).toFixed(1);

  // 機種ラベルを組み立て
  let modelLabel = eq.label;
  if (r.equipment === 'spider' && r.spiderModel) {
    const m = SPIDER_MODELS_LIST.find(x => x.id === r.spiderModel);
    if (m) modelLabel = m.label;
  } else if (r.equipment === 'hammer' && r.hammerModel) {
    const m = HAMMER_MODELS_LIST.find(x => x.id === r.hammerModel);
    if (m) modelLabel = m.label;
  } else if (r.equipment === 'kari' && r.kariMaker && r.kariModel) {
    const maker = KARI_MAKERS[r.kariMaker]?.label || '';
    const models = KARI_MODELS[r.kariMaker] || [];
    const model = models.find(m => m.id === r.kariModel);
    if (model) modelLabel = `${maker} ${model.label}`;
  }

  return `<div class="record-card" onclick="showRecordDetail('${r.id}')">
    <div class="record-date"><div class="day">${day}</div><div class="mon">${mon}</div></div>
    <div class="record-divider"></div>
    <div class="record-body">
      <div class="record-spot">${escHtml(r.spotName || '作業記録')}</div>
      <div class="record-tags">
        <span class="tag tag-orange">${te.icon} ${te.label} ${te.stars}</span>
        <span class="tag tag-green">${modelLabel}</span>
        ${r.gpsEnabled ? '<span class="tag tag-sky">GPS</span>' : ''}
      </div>
    </div>
    <div class="record-metrics">
      <div class="record-area">${areaA}a</div>
      <div class="record-kcal">${r.calories}kcal</div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────
   WEATHER & SLOPE APIs
───────────────────────────────────── */
async function fetchWeather() {
  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lon } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    state.temperature = temp;
    state.tempAuto = true;
    const wCode = data.current.weathercode;
    const wx = wCode <= 3 ? '☀️' : wCode <= 48 ? '⛅' : wCode <= 67 ? '🌧' : '⛅';
    const wLabel = wCode <= 3 ? '晴れ' : wCode <= 48 ? '曇り' : '雨';
    state.weather = wLabel;
    qs('#weather-icon').textContent = wx;
    qs('#weather-temp').textContent = temp;
    qs('#weather-label').textContent = wLabel;

    // Heat warning
    if (temp >= 30) showToast(`🌡 気温${temp}℃ — 熱中症に注意してください！`);

    // Fetch slope
    fetchSlope(lat, lon);
  } catch {
    // silent fail — user can input manually
  }
}

async function fetchSlope(lat, lon) {
  try {
    const d = 0.0005; // ~55m offset
    const [r1, r2] = await Promise.all([
      fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`).then(r=>r.json()),
      fetch(`https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon+d}&lat=${lat+d}&outtype=JSON`).then(r=>r.json()),
    ]);
    const h1 = parseFloat(r1.elevation);
    const h2 = parseFloat(r2.elevation);
    if (isNaN(h1) || isNaN(h2)) return;
    const dH = Math.abs(h2 - h1);
    const dD = 55; // approx meters
    const slope = Math.round(Math.atan(dH / dD) * 180 / Math.PI);
    state.estimatedSlope = slope;
    // suggest terrain
    const suggest = slope < 5 ? 'flat' : slope < 15 ? 'gentle' : slope < 30 ? 'steep' : 'extreme';
    qs('#slope-hint').textContent = `📐 推定傾斜 約${slope}° → ${TERRAIN[suggest].label}が目安`;
    qs('#slope-hint').classList.remove('hidden');
  } catch { /* silent */ }
}

/* ─────────────────────────────────────
   START MODAL
───────────────────────────────────── */
function openStartModal() {
  renderStartModal();
  qs('#modal-start').classList.add('open');
  fetchWeather();
}
function closeStartModal() { qs('#modal-start').classList.remove('open'); }

function renderStartModal() {
  const profile = DB.profile();
  state.equipment   = profile.defaultEquip   || 'kari';
  state.kariMaker   = profile.defaultKariMaker || 'orec';
  state.kariModel   = profile.defaultKariModel || 'WM716';
  state.spiderModel = profile.defaultSpider  || 'SP851';
  state.hammerModel = profile.defaultHammer  || 'HRC662';
  state.terrain     = 'flat';
  state.bladeType   = 'chip255';
  state.targetSpotId = null;
  state.modelBladeW  = getModelBladeW();

  updateEquipUI();
  updateTerrainUI();

  // Spots
  const spots = DB.spots();
  const spotSel = qs('#spot-selector');
  spotSel.innerHTML = spots.map(s =>
    `<div class="spot-option" data-id="${s.id}" onclick="selectSpot('${s.id}')">${s.name}</div>`
  ).join('') + `<div class="spot-option spot-option-new" onclick="selectSpot('new')">＋ 新しい場所を登録</div>`;

  qs('#new-spot-name').value = '';
  qs('#new-spot-row').classList.add('hidden');
  qs('#slope-hint').classList.add('hidden');
}

function getModelBladeW() {
  if (state.equipment === 'spider') {
    return (SPIDER_MODELS_LIST.find(m => m.id === state.spiderModel) || SPIDER_MODELS_LIST[0]).bladeW;
  }
  if (state.equipment === 'hammer') {
    return (HAMMER_MODELS_LIST.find(m => m.id === state.hammerModel) || HAMMER_MODELS_LIST[0]).bladeW;
  }
  if (state.equipment === 'kari') {
    const models = KARI_MODELS[state.kariMaker] || KARI_MODELS.other;
    return (models.find(m => m.id === state.kariModel) || models[0]).bladeW;
  }
  return EQUIP[state.equipment]?.bladeW || 0.80;
}

function selectEquip(eq) {
  state.equipment = eq;
  // デフォルト機種をセット
  if (eq === 'spider')  state.spiderModel = state.spiderModel || 'SP851';
  if (eq === 'hammer')  state.hammerModel = state.hammerModel || 'HRC662';
  if (eq === 'kari') {
    state.kariMaker = state.kariMaker || 'orec';
    state.kariModel = (KARI_MODELS[state.kariMaker]?.[0]?.id) || 'WM716';
  }
  state.modelBladeW = getModelBladeW();
  updateEquipUI();
}

function updateEquipUI() {
  document.querySelectorAll('.equip-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.equip === state.equipment));

  // 各機材の追加選択行の表示切替
  qs('#kari-maker-row').classList.toggle('hidden', state.equipment !== 'kari');
  qs('#kari-model-row').classList.toggle('hidden', state.equipment !== 'kari');
  qs('#blade-row').classList.toggle('hidden', state.equipment !== 'kari');
  qs('#spider-model-row').classList.toggle('hidden', state.equipment !== 'spider');
  qs('#hammer-model-row').classList.toggle('hidden', state.equipment !== 'hammer');

  // 刈払い機：メーカーボタン更新
  if (state.equipment === 'kari') {
    renderKariMakerBtns();
    renderKariModelBtns();
  }
  // スパイダー：機種リスト更新
  if (state.equipment === 'spider') renderSpiderModelBtns();
  // ハンマー：機種リスト更新
  if (state.equipment === 'hammer') renderHammerModelBtns();

  updateModelLabel();
}

function renderKariMakerBtns() {
  const wrap = qs('#kari-maker-btns');
  wrap.innerHTML = Object.entries(KARI_MAKERS).map(([k, m]) =>
    `<button class="form-select-btn maker-btn${state.kariMaker === k ? ' selected' : ''}"
      data-maker="${k}" onclick="selectKariMaker('${k}')">${m.label}</button>`
  ).join('');
}

function renderKariModelBtns() {
  const models = KARI_MODELS[state.kariMaker] || KARI_MODELS.other;
  const wrap = qs('#kari-model-btns');
  wrap.innerHTML = models.map(m =>
    `<button class="form-select-btn model-btn${state.kariModel === m.id ? ' selected' : ''}"
      data-model="${m.id}" onclick="selectKariModel('${m.id}')">${m.label}</button>`
  ).join('');
}

function renderSpiderModelBtns() {
  const wrap = qs('#spider-model-btns');
  wrap.innerHTML = SPIDER_MODELS_LIST.map(m =>
    `<button class="form-select-btn smodel-btn${state.spiderModel === m.id ? ' selected' : ''}"
      data-model="${m.id}" onclick="selectSpiderModel('${m.id}')">${m.label}（${(m.bladeW*100).toFixed(0)}cm）</button>`
  ).join('');
}

function renderHammerModelBtns() {
  const wrap = qs('#hammer-model-btns');
  wrap.innerHTML = HAMMER_MODELS_LIST.map(m =>
    `<button class="form-select-btn hmodel-btn${state.hammerModel === m.id ? ' selected' : ''}"
      data-model="${m.id}" onclick="selectHammerModel('${m.id}')">${m.label}</button>`
  ).join('');
}

function selectKariMaker(maker) {
  state.kariMaker = maker;
  // そのメーカーの最初のモデルを自動選択
  state.kariModel = KARI_MODELS[maker]?.[0]?.id || 'kari_custom';
  state.modelBladeW = getModelBladeW();
  renderKariMakerBtns();
  renderKariModelBtns();
  updateModelLabel();
}

function selectKariModel(modelId) {
  state.kariModel = modelId;
  state.modelBladeW = getModelBladeW();
  document.querySelectorAll('.model-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.model === modelId));
  updateModelLabel();
}

function selectSpiderModel(modelId) {
  state.spiderModel = modelId;
  state.modelBladeW = getModelBladeW();
  document.querySelectorAll('.smodel-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.model === modelId));
  updateModelLabel();
}

function selectHammerModel(modelId) {
  state.hammerModel = modelId;
  state.modelBladeW = getModelBladeW();
  document.querySelectorAll('.hmodel-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.model === modelId));
  updateModelLabel();
}

function updateModelLabel() {
  const el = qs('#model-summary');
  if (!el) return;
  const eq = EQUIP[state.equipment];
  let detail = '';
  if (state.equipment === 'kari') {
    const maker = KARI_MAKERS[state.kariMaker]?.label || '';
    const models = KARI_MODELS[state.kariMaker] || [];
    const model = models.find(m => m.id === state.kariModel);
    detail = `${maker} ${model?.label || ''} ／ 刈幅 ${(state.modelBladeW*100).toFixed(0)}cm`;
  } else if (state.equipment === 'spider') {
    const m = SPIDER_MODELS_LIST.find(x => x.id === state.spiderModel);
    detail = `${m?.label || ''} ／ 刈幅 ${(state.modelBladeW*100).toFixed(0)}cm`;
  } else if (state.equipment === 'hammer') {
    const m = HAMMER_MODELS_LIST.find(x => x.id === state.hammerModel);
    detail = `${m?.label || ''} ／ 刈幅 ${(state.modelBladeW*100).toFixed(0)}cm`;
  }
  el.textContent = detail ? `✓ ${detail}` : '';
}

function selectBlade(bt) {
  state.bladeType = bt;
  document.querySelectorAll('.blade-btn').forEach(b => b.classList.toggle('selected', b.dataset.blade === bt));
}

function selectModalTerrain(t) {
  state.terrain = t;
  updateTerrainUI();
}
function updateTerrainUI() {
  document.querySelectorAll('.modal-terrain-btn').forEach(b => b.classList.toggle('selected', b.dataset.terrain === state.terrain));
  updateSafetyHint();
}

function selectSpot(id) {
  state.targetSpotId = id;
  state.newSpotLat = null;
  state.newSpotLon = null;
  state.newSpotColor = '#9ee840';
  document.querySelectorAll('.spot-option').forEach(o =>
    o.classList.toggle('selected', o.dataset.id === id));
  qs('#new-spot-row').classList.toggle('hidden', id !== 'new');
  if (id === 'new') {
    qs('#location-status').textContent = '';
    qs('#btn-attach-location').style.borderColor = 'rgba(158,232,64,.3)';
    qs('#btn-attach-location').style.color = 'var(--neon)';
  }
}

function selectSpotColor(color) {
  state.newSpotColor = color;
  document.querySelectorAll('.spot-color-opt').forEach(el => {
    el.style.border = el.dataset.color === color ? '2px solid white' : '2px solid transparent';
  });
}

async function attachCurrentLocation() {
  const btn = qs('#btn-attach-location');
  const status = qs('#location-status');
  btn.textContent = '📡 位置情報を取得中…';
  btn.style.opacity = '.6';
  status.textContent = '';

  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    state.newSpotLat = lat;
    state.newSpotLon = lon;

    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 📍 位置情報を登録しました`;
    btn.style.background = 'rgba(158,232,64,.2)';
    btn.style.borderColor = 'rgba(158,232,64,.7)';
    btn.style.opacity = '1';
    status.textContent = `緯度 ${lat.toFixed(5)} / 経度 ${lon.toFixed(5)} ／ 精度 ±${Math.round(accuracy)}m`;
    status.style.color = 'var(--lime)';
  } catch (e) {
    btn.innerHTML = `⚠️ 位置情報の取得に失敗しました`;
    btn.style.opacity = '1';
    btn.style.borderColor = 'rgba(217,79,42,.4)';
    btn.style.color = 'var(--danger)';
    status.textContent = '設定 → プライバシー → 位置情報サービスを確認してください';
    status.style.color = 'rgba(255,255,255,.35)';
  }
}

function updateSafetyHint() {
  const el = qs('#modal-safety');
  if (state.terrain === 'steep' || state.terrain === 'extreme') {
    el.textContent = state.terrain === 'extreme'
      ? '⚠️ 激急斜面：転倒・滑落に十分注意し、安全装備を必ず着用してください。'
      : '⚠️ 急傾斜：チャップス・フェイスガードの着用を推奨します。';
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function startWork() {
  // Validate
  const spotName = state.targetSpotId === 'new'
    ? qs('#new-spot-name').value.trim()
    : (DB.spots().find(s => s.id === state.targetSpotId)?.name || '');
  if (!spotName && !state.targetSpotId) {
    showToast('作業場所を選択してください'); return;
  }
  state.spotName = spotName || (DB.spots().find(s => s.id === state.targetSpotId)?.name || '作業記録');

  if (state.targetSpotId === 'new' && spotName) {
    const freq = parseInt(qs('#new-spot-freq')?.value || '3', 10);
    const newSpot = {
      id: `spot_${Date.now()}`,
      name: spotName,
      color: state.newSpotColor || '#9ee840',
      targetFreq: freq,
      terrain: state.terrain,
      area: 0,
      lat: state.newSpotLat,   // null のときは地図表示なし（後で更新可）
      lon: state.newSpotLon,
      lastMowed: null,
      memo: '',
    };
    const spots = DB.spots();
    spots.push(newSpot);
    DB.saveSpots(spots);
    state.targetSpotId = newSpot.id;
    if (newSpot.lat) showToast(`📍 「${spotName}」の位置情報を登録しました`);
  }

  closeStartModal();
  navigate('work');
  beginSession();
}

/* ─────────────────────────────────────
   WORK SESSION
───────────────────────────────────── */
function beginSession() {
  state.working = true;
  state.paused = false;
  state.startTime = new Date();
  state.totalPaused = 0;
  state.elapsedSec = 0;
  state.gpsPoints = [];
  state.gpsDist = 0;
  state.lastGpsPoint = null;

  renderWorkScreen();
  startTimerLoop();
  startGPS();
}

function renderWorkScreen() {
  const eq = EQUIP[state.equipment];
  const te = TERRAIN[state.terrain];

  // 機種詳細ラベルを組み立て
  let modelDetail = '';
  if (state.equipment === 'kari') {
    const maker = KARI_MAKERS[state.kariMaker]?.label || '';
    const models = KARI_MODELS[state.kariMaker] || [];
    const model = models.find(m => m.id === state.kariModel);
    modelDetail = model ? ` ${maker} ${model.label}` : '';
  } else if (state.equipment === 'spider') {
    const m = SPIDER_MODELS_LIST.find(x => x.id === state.spiderModel);
    modelDetail = m ? ` ${m.label}` : '';
  } else if (state.equipment === 'hammer') {
    const m = HAMMER_MODELS_LIST.find(x => x.id === state.hammerModel);
    modelDetail = m ? ` ${m.label}` : '';
  }

  qs('#work-equipment-label').textContent =
    `${eq.label}${modelDetail} ／ ${te.label} ${te.stars}`;

  // Terrain grid
  const grid = qs('#work-terrain-grid');
  grid.innerHTML = Object.entries(TERRAIN).map(([k, t]) =>
    `<button class="terrain-btn${state.terrain === k ? ' active' : ''}" data-terrain="${k}" onclick="changeWorkTerrain('${k}')">
      <span class="t-icon">${t.icon}</span>${t.label}<br><small>${t.stars}</small>
    </button>`
  ).join('');
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (state.paused) return;
  const now = new Date();
  state.elapsedSec = Math.floor((now - state.startTime - state.totalPaused) / 1000);
  updateTimerDisplay();
  updateWorkMetrics();
}

function updateTimerDisplay() {
  const s = state.elapsedSec;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const str = h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  const el = qs('#timer-display');
  el.textContent = str;
  el.classList.toggle('paused', state.paused);

  // Ring: based on 2hr target
  const pct = Math.min(state.elapsedSec / 7200, 1);
  const offset = 628 - pct * 628;
  const ring = qs('#ring-prog');
  ring.style.strokeDashoffset = offset;
  ring.classList.toggle('paused', state.paused);
}

function updateWorkMetrics() {
  const hrs = state.elapsedSec / 3600;
  const eq = EQUIP[state.equipment];
  const te = TERRAIN[state.terrain];
  const profile = DB.profile();

  // Area from GPS or estimate
  let areaM2 = 0;
  if (state.gpsEnabled && state.gpsDist > 0) {
    const bladeW = state.modelBladeW || eq.bladeW || 0.85;
    areaM2 = state.gpsDist * bladeW * eq.eff;
  }

  // Calories
  let kcal = Math.floor(eq.met * te.factor * profile.weight * hrs * 1.05);
  if (state.temperature !== null && state.temperature >= 30) kcal = Math.floor(kcal * 1.1);

  qs('#metric-area').textContent  = (areaM2 / 100).toFixed(1);
  qs('#metric-kcal').textContent  = kcal;
  qs('#metric-efficiency').textContent = hrs > 0 ? ((areaM2 / 100) / hrs).toFixed(1) : '—';

  // Fun bar
  const food = FOOD_EQUIV[0]; // beer
  const beers = (kcal / food.kcal).toFixed(1);
  qs('#fun-bar-text').innerHTML = `<strong>${food.name} 約${beers}本分！ / ~${beers} beers</strong>${state.temperature !== null ? `🌡 ${state.temperature}℃ ${state.tempAuto ? '自動取得' : '手動入力'}` : ''}${state.estimatedSlope !== null ? ` ／ 📐 推定傾斜 ${state.estimatedSlope}°` : ''}`;

  // Safety
  const sw = qs('#work-safety');
  const danger = state.terrain === 'extreme' || state.terrain === 'steep';
  const heat = state.temperature !== null && state.temperature >= 30;
  if (danger && heat) {
    sw.textContent = '🔴 激暑＋急傾斜：熱中症・転倒リスク最大。無理せず休憩を！';
    sw.classList.add('show');
  } else if (danger) {
    sw.textContent = '⚠️ 急傾斜：転倒・滑落に注意。安全装備を確認してください。';
    sw.classList.add('show');
  } else if (heat) {
    sw.textContent = `🌡 気温${state.temperature}℃ — こまめな水分補給を！`;
    sw.classList.add('show');
  } else {
    sw.classList.remove('show');
  }
}

function changeWorkTerrain(t) {
  state.terrain = t;
  qs('#work-equipment-label').textContent = `${EQUIP[state.equipment].label} / ${TERRAIN[t].label} ${TERRAIN[t].stars}`;
  document.querySelectorAll('.terrain-btn').forEach(b => b.classList.toggle('active', b.dataset.terrain === t));
  updateWorkMetrics();
}

function togglePause() {
  if (!state.paused) {
    state.paused = true;
    state.pauseStart = new Date();
    qs('#btn-pause').innerHTML = '▶ 再開';
    qs('#btn-pause').style.color = 'var(--neon)';
    showToast('⏸ 一時停止中 / Paused');
  } else {
    state.totalPaused += (new Date() - state.pauseStart);
    state.paused = false;
    state.pauseStart = null;
    qs('#btn-pause').innerHTML = '⏸ 休憩';
    qs('#btn-pause').style.color = '';
    showToast('▶ 作業再開 / Resumed');
  }
}

function endWork() {
  if (!state.working) return;
  if (state.elapsedSec < 10) { showToast('作業時間が短すぎます'); return; }
  if (!confirm('作業を終了して記録を保存しますか？')) return;
  stopGPS();
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  const eq = EQUIP[state.equipment];
  const te = TERRAIN[state.terrain];
  const profile = DB.profile();
  const hrs = state.elapsedSec / 3600;

  // Final area calc
  let areaM2 = 0;
  if (state.gpsEnabled && state.gpsDist > 0) {
    const bw = state.modelBladeW || eq.bladeW || 0.85;
    areaM2 = Math.round(state.gpsDist * bw * eq.eff);
  }

  let kcal = Math.floor(eq.met * te.factor * profile.weight * hrs * 1.05);
  if (state.temperature !== null && state.temperature >= 30) kcal = Math.floor(kcal * 1.1);

  const record = {
    id: `rec_${Date.now()}`,
    date: dateStr(new Date()),
    startTime: state.startTime.toISOString(),
    endTime: new Date().toISOString(),
    workDuration: state.elapsedSec,
    equipment: state.equipment,
    equipmentLabel: EQUIP[state.equipment]?.label || state.equipment,
    kariMaker: state.equipment === 'kari' ? state.kariMaker : null,
    kariModel: state.equipment === 'kari' ? state.kariModel : null,
    spiderModel: state.equipment === 'spider' ? state.spiderModel : null,
    hammerModel: state.equipment === 'hammer' ? state.hammerModel : null,
    modelBladeW: state.modelBladeW,
    bladeType: state.bladeType,
    terrain: state.terrain,
    terrainFactor: te.factor,
    area: areaM2,
    calories: kcal,
    weather: state.weather,
    temperature: state.temperature,
    temperatureAuto: state.tempAuto,
    estimatedSlope: state.estimatedSlope,
    spotId: state.targetSpotId,
    spotName: state.spotName,
    memo: '',
    gpsEnabled: state.gpsEnabled,
    gpsPoints: state.gpsEnabled ? state.gpsPoints.slice(-500) : [], // 最大500点
    gpsDist: Math.round(state.gpsDist),
    gpsArea: areaM2,
    gpsSamples: state.gpsPoints.length,
    badges: [],
  };

  // Update spot lastMowed & 位置情報（未登録の場合のみ自動付与）
  if (state.targetSpotId && state.targetSpotId !== 'new') {
    const spots = DB.spots();
    const sp = spots.find(s => s.id === state.targetSpotId);
    if (sp) {
      sp.lastMowed = record.date;
      // GPS有効かつ位置未登録 → 最初のGPS点を位置として登録
      if (state.gpsEnabled && state.gpsPoints.length > 0 && !sp.lat) {
        const firstPt = state.gpsPoints[0];
        sp.lat = firstPt.lat;
        sp.lon = firstPt.lon;
        showToast(`📍 「${sp.name}」に位置情報を自動登録しました`);
      }
      DB.saveSpots(spots);
    }
  }

  DB.saveRecord(record);

  // Badge check
  const newBadges = checkBadges(record);
  record.badges = newBadges;

  state.lastRecord = record;
  state.working = false;
  navigate('result');
}

/* ─────────────────────────────────────
   GPS
───────────────────────────────────── */
function startGPS() {
  if (!('geolocation' in navigator)) {
    qs('#gps-status').textContent = '📵 GPS非対応 / GPS N/A';
    qs('#gps-status').classList.add('no-gps');
    return;
  }
  state.gpsWatcher = navigator.geolocation.watchPosition(
    pos => onGPSUpdate(pos),
    err => onGPSError(err),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );
}

function onGPSUpdate(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;
  state.gpsEnabled = true;
  state.gpsAccuracyOk = accuracy <= 20;

  qs('#gps-status').textContent = state.gpsAccuracyOk
    ? `📍 GPS計測中 ±${Math.round(accuracy)}m / Tracking`
    : `⚠️ GPS精度不足 ±${Math.round(accuracy)}m`;
  qs('#gps-status').classList.toggle('no-gps', !state.gpsAccuracyOk);

  if (!state.gpsAccuracyOk || state.paused) return;

  const pt = { lat, lon, t: Date.now() };
  if (state.lastGpsPoint) {
    const dist = haversine(state.lastGpsPoint.lat, state.lastGpsPoint.lon, lat, lon);
    const dt = (pt.t - state.lastGpsPoint.t) / 1000;
    const speed = dist / dt;
    // filter: too slow (standing) or too fast (noise)
    if (speed > 0.3 && speed < 5.0) {
      state.gpsDist += dist;
      state.gpsPoints.push(pt);
    }
  } else {
    state.gpsPoints.push(pt);
  }
  state.lastGpsPoint = pt;
}

function onGPSError(err) {
  qs('#gps-status').textContent = '📵 GPS取得失敗 / GPS Error';
  qs('#gps-status').classList.add('no-gps');
}

function stopGPS() {
  if (state.gpsWatcher !== null) {
    navigator.geolocation.clearWatch(state.gpsWatcher);
    state.gpsWatcher = null;
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getPosition() {
  return new Promise((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
  );
}

/* ─────────────────────────────────────
   RESULT
───────────────────────────────────── */
function renderResult() {
  const r = state.lastRecord;
  if (!r) { navigate('home'); return; }

  const d = new Date(r.startTime);
  const te = TERRAIN[r.terrain] || TERRAIN.flat;
  const eq = EQUIP[r.equipment] || EQUIP.other;
  const h = Math.floor(r.workDuration / 3600);
  const m = Math.floor((r.workDuration % 3600) / 60);
  const timeStr = h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m}分`;
  const timeUnit = h > 0 ? 'h:m' : 'min';

  qs('#result-date').textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]}`;
  qs('#result-spot').textContent = r.spotName || '作業記録';
  qs('#result-terrain-tag').className = `tag ${r.terrain==='steep'||r.terrain==='extreme'?'tag-red':'tag-orange'}`;
  qs('#result-terrain-tag').textContent = `${te.icon} ${te.label} ${te.stars}`;
  qs('#result-equip-tag').textContent = eq.label;

  qs('#result-time-val').textContent  = timeStr;
  qs('#result-time-unit').textContent = timeUnit;
  qs('#result-area-val').textContent  = (r.area / 100).toFixed(1);
  qs('#result-kcal-val').textContent  = r.calories;

  // Badges
  const badgeEl = qs('#result-badges');
  if (r.badges.length > 0) {
    badgeEl.innerHTML = r.badges.map(id => {
      const bd = BADGES_DEF.find(b => b.id === id);
      return bd ? `<div class="badge-chip new">${bd.label}</div>` : '';
    }).join('') + `<div class="badge-chip">🌿 累計 ${((DB.records().reduce((a,rec)=>a+rec.area,0))/100).toFixed(1)}a</div>`;
  } else {
    badgeEl.innerHTML = `<div class="badge-chip">🌿 累計 ${((DB.records().reduce((a,rec)=>a+rec.area,0))/100).toFixed(1)}a</div>`;
  }

  // Food equiv
  const beers = (r.calories / 140).toFixed(1);
  const rice  = (r.calories / 200).toFixed(1);
  qs('#result-equiv').textContent = `🍺 缶ビール約${beers}本分 ／ 🍚 ご飯 約${rice}杯分を消費！`;

  // Share text
  qs('#share-text-preview').textContent = generateShareText(r);
}

function generateShareText(r) {
  const te = TERRAIN[r.terrain] || TERRAIN.flat;
  const eq = EQUIP[r.equipment] || EQUIP.other;
  const h = Math.floor(r.workDuration/3600), m = Math.floor((r.workDuration%3600)/60);
  const tStr = h > 0 ? `${h}時間${m}分` : `${m}分`;
  return `今日の草刈り完了🌿 刈り面積：${(r.area/100).toFixed(1)}a ／ 作業時間：${tStr} ／ 消費カロリー：${r.calories}kcal（缶ビール${(r.calories/140).toFixed(1)}本分！）【${te.label}${te.stars} ${eq.label}】${r.spotName?` #${r.spotName}`:''} #草刈りトラッカー #里山 #真庭`;
}

function shareToX() {
  const r = state.lastRecord;
  if (!r) return;
  const text = encodeURIComponent(generateShareText(r));
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
}

function copyShareText() {
  const text = qs('#share-text-preview').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('✓ コピーしました！'));
}

/* ─────────────────────────────────────
   BADGES
───────────────────────────────────── */
function checkBadges(newRecord) {
  const records = DB.records();
  const earned = DB.badges();
  const newlyEarned = [];
  for (const bd of BADGES_DEF) {
    if (!earned.includes(bd.id) && bd.check(records)) {
      earned.push(bd.id);
      newlyEarned.push(bd.id);
    }
  }
  DB.saveBadges(earned);
  return newlyEarned;
}

function checkStreak(records, days) {
  if (records.length < days) return false;
  const dates = [...new Set(records.map(r => r.date))].sort().reverse();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const d1 = new Date(dates[i-1]), d2 = new Date(dates[i]);
    const diff = (d1 - d2) / 86400000;
    if (Math.round(diff) === 1) { if (++streak >= days) return true; }
    else streak = 1;
  }
  return false;
}

/* ─────────────────────────────────────
   MAP
───────────────────────────────────── */
/* ─────────────────────────────────────
   LEAFLET MAP
───────────────────────────────────── */

let leafletMap = null;        // Leaflet map instance
let liveMarker = null;        // 現在地マーカー
let liveAccCircle = null;     // 精度円
let liveTrailPolyline = null; // リアルタイム軌跡
let liveTrailCoords = [];     // 軌跡座標バッファ
let mowedLayers = [];         // 刈取ポリゴン/ポリライン層
let mapFilter = 'all';        // 'all' | 'month' | 'live'
let watchLiveId = null;       // geolocation watch ID (map画面用)

// Leaflet カスタム現在地アイコン
function makeLiveDotIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="live-dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function initLeafletMap() {
  if (leafletMap) return; // 既に初期化済み

  leafletMap = L.map('leaflet-map', {
    zoomControl: false,
    attributionControl: true,
  }).setView([35.07, 133.92], 15); // 真庭市付近を初期表示

  // 国土地理院 標準地図タイル（日本語・無料）
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
    maxZoom: 18,
    opacity: 1.0,
  }).addTo(leafletMap);

  // ズームコントロール（右下）
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  // 地図タップで現在地取得
  leafletMap.on('click', () => {});
}

function renderMap() {
  initLeafletMap();
  renderMapStats();
  renderCalendar();
  renderSpotList();
  drawMowedPolygons();
  startLiveTracking();

  // 地図サイズを正しく再計算（画面切り替え後に必要）
  setTimeout(() => leafletMap && leafletMap.invalidateSize(), 120);
}

function setMapFilter(f) {
  mapFilter = f;
  ['all','month','live'].forEach(k => {
    const el = qs(`#filter-${k}`);
    if (el) el.classList.toggle('active', k === f);
  });
  drawMowedPolygons();
  if (f === 'live') startLiveTracking();
}

/* ── 現在地追跡（地図画面用） ── */
function startLiveTracking() {
  if (!('geolocation' in navigator)) return;
  if (watchLiveId !== null) return; // 既に起動中

  watchLiveId = navigator.geolocation.watchPosition(
    pos => onLiveMapUpdate(pos),
    err => {},
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
  );
}

function stopLiveTracking() {
  if (watchLiveId !== null) {
    navigator.geolocation.clearWatch(watchLiveId);
    watchLiveId = null;
  }
  liveTrailCoords = [];
}

function onLiveMapUpdate(pos) {
  const { latitude: lat, longitude: lon, accuracy } = pos.coords;
  if (!leafletMap) return;

  const latlng = [lat, lon];

  // 精度円
  if (liveAccCircle) {
    liveAccCircle.setLatLng(latlng).setRadius(accuracy);
  } else {
    liveAccCircle = L.circle(latlng, {
      radius: accuracy,
      className: 'live-accuracy-circle',
      weight: 1.5,
    }).addTo(leafletMap);
  }

  // 現在地ドット
  if (liveMarker) {
    liveMarker.setLatLng(latlng);
  } else {
    liveMarker = L.marker(latlng, { icon: makeLiveDotIcon(), zIndexOffset: 1000 })
      .addTo(leafletMap)
      .bindPopup(`<b>現在地</b><br>精度 ±${Math.round(accuracy)}m`);

    // 初回だけ現在地にフォーカス
    leafletMap.setView(latlng, 17);
  }

  // リアルタイム軌跡（作業中のみ）
  if (state.working && !state.paused && accuracy <= 25) {
    liveTrailCoords.push(latlng);
    if (liveTrailPolyline) {
      liveTrailPolyline.setLatLngs(liveTrailCoords);
    } else if (liveTrailCoords.length >= 2) {
      liveTrailPolyline = L.polyline(liveTrailCoords, {
        color: '#9ee840',
        weight: 4,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: null,
      }).addTo(leafletMap);
    }
  }
}

function locateMe() {
  if (!leafletMap) return;
  if (liveMarker) {
    leafletMap.setView(liveMarker.getLatLng(), 17);
  } else {
    navigator.geolocation.getCurrentPosition(pos => {
      leafletMap.setView([pos.coords.latitude, pos.coords.longitude], 17);
    }, () => showToast('位置情報を取得できませんでした'));
  }
}

/* ── 刈取ポリゴン描画 ── */
function drawMowedPolygons() {
  if (!leafletMap) return;

  // 既存レイヤーを削除
  mowedLayers.forEach(l => leafletMap.removeLayer(l));
  mowedLayers = [];

  const records = DB.records();
  const now = new Date();

  // フィルタリング
  const filtered = records.filter(r => {
    if (mapFilter === 'month') {
      const ms = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      return r.date.startsWith(ms);
    }
    return true;
  });

  filtered.forEach(r => {
    const age = (now - new Date(r.date)) / 86400000;

    // GPS軌跡があればポリラインバッファ、なければスポット位置に円
    if (r.gpsPoints && r.gpsPoints.length >= 2) {
      // GPS軌跡 → ポリライン
      const coords = r.gpsPoints.map(p => [p.lat, p.lon]);
      const color = age < 7 ? '#9ee840' : age < 30 ? '#6ab82e' : '#3d7a22';
      const opacity = age < 7 ? 0.85 : age < 30 ? 0.6 : 0.35;
      const weight = age < 7 ? 5 : age < 30 ? 4 : 3;

      // ポリライン（軌跡）
      const line = L.polyline(coords, {
        color, weight, opacity,
        lineJoin: 'round', lineCap: 'round',
      }).addTo(leafletMap);

      line.bindPopup(buildPopup(r));
      mowedLayers.push(line);

      // 軌跡バッファ（刈幅で膨らませた塗りつぶし風）
      // Leafletは真のバッファ非対応なので、軌跡を太くして擬似的に表現
      const buf = L.polyline(coords, {
        color,
        weight: Math.max(12, (r.modelBladeW || 0.85) * 14),
        opacity: opacity * 0.25,
        lineJoin: 'round',
      }).addTo(leafletMap);
      mowedLayers.push(buf);

    } else {
      // GPS軌跡なし → スポット中心に推定面積の円を表示
      const spot = DB.spots().find(s => s.id === r.spotId);
      if (!spot || !spot.lat || !spot.lon) return; // 座標未登録はスキップ

      const color = age < 7 ? '#9ee840' : age < 30 ? '#6ab82e' : '#3d7a22';
      const fillOp = age < 7 ? 0.3 : age < 30 ? 0.18 : 0.09;
      const radius = Math.sqrt(r.area / Math.PI); // ㎡ → 半径m

      const circle = L.circle([spot.lat, spot.lon], {
        radius: Math.max(radius, 5),
        color,
        weight: 2,
        opacity: age < 7 ? 0.9 : 0.5,
        fillColor: color,
        fillOpacity: fillOp,
      }).addTo(leafletMap);

      circle.bindPopup(buildPopup(r));
      mowedLayers.push(circle);
    }
  });

  // スポットマーカー（名前付きピン）
  const spots = DB.spots().filter(s => s.lat && s.lon);
  spots.forEach(s => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${s.color||'#9ee840'};
        width:12px;height:12px;
        border-radius:50%;
        border:2.5px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.5)
      "></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    const m = L.marker([s.lat, s.lon], { icon })
      .addTo(leafletMap)
      .bindPopup(`<b>${s.name}</b><br>目標 年${s.targetFreq}回`);
    mowedLayers.push(m);
  });
}

function buildPopup(r) {
  const te = TERRAIN[r.terrain] || TERRAIN.flat;
  const eq = EQUIP[r.equipment] || EQUIP.other;
  const h = Math.floor(r.workDuration/3600), m = Math.floor((r.workDuration%3600)/60);
  const tStr = h > 0 ? `${h}時間${m}分` : `${m}分`;
  return `<b>${escHtml(r.spotName||'作業記録')}</b><br>
    ${r.date} ${te.icon}${te.label}<br>
    ${eq.label} ／ ${(r.area/100).toFixed(1)}a ／ ${r.calories}kcal<br>
    作業時間 ${tStr}`;
}

function renderMapStats() {
  const records = DB.records();
  const now = new Date();
  const year = now.getFullYear();
  const yearRecs = records.filter(r => r.date.startsWith(String(year)));
  const totalArea = yearRecs.reduce((a, r) => a + r.area, 0);
  const spots = DB.spots();

  qs('#map-total-area').textContent = `${(totalArea/100).toFixed(0)}a`;
  qs('#map-spot-count').textContent = spots.length;
  qs('#map-work-count').textContent = yearRecs.length;
}

function renderCalendar() {
  const records = DB.records();
  const now = new Date();
  const year = now.getFullYear();
  const months = Array.from({length:12}, (_,i) => i+1);
  const calEl = qs('#cal-months');
  calEl.innerHTML = months.map(m => {
    const ms = `${year}-${String(m).padStart(2,'0')}`;
    const recs = records.filter(r => r.date.startsWith(ms));
    const cls = recs.length === 0 ? '' : recs.length >= 3 ? ' has-work heavy' : ' has-work';
    return `<div class="cal-month${cls}" title="${m}月: ${recs.length}回">${m}</div>`;
  }).join('');
}

function renderSpotList() {
  const spots = DB.spots();
  const records = DB.records();
  const now = new Date();
  const el = qs('#spot-list');

  el.innerHTML = spots.map(s => {
    const lastRecs = records.filter(r => r.spotId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    const last = lastRecs[0];
    const daysSince = last ? Math.floor((now - new Date(last.date)) / 86400000) : 999;
    const yearCount = records.filter(r => r.spotId === s.id && r.date.startsWith(String(now.getFullYear()))).length;
    const daysPerVisit = 365 / s.targetFreq;
    const statusCls = daysSince > daysPerVisit * 1.5 ? 'status-due' : daysSince > daysPerVisit ? 'status-warn' : 'status-ok';
    const statusTxt = daysSince > daysPerVisit * 1.5 ? '🔴 要刈り！' : daysSince > daysPerVisit ? '⚠ 要確認' : '✓ 完了';
    return `<div class="spot-card" onclick="showSpotDetail('${s.id}')">
      <div class="spot-color" style="background:${s.color}"></div>
      <div class="spot-body">
        <div class="spot-name">${escHtml(s.name)}</div>
        <div class="spot-info">目標：年${s.targetFreq}回 ／ ${last ? `最終：${daysSince}日前` : '未作業'} ／ ${TERRAIN[s.terrain]?.label||''}</div>
      </div>
      <div class="spot-status ${statusCls}">${statusTxt}</div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────
   RECORDS
───────────────────────────────────── */
function renderRecords() {
  const records = DB.records();
  const now = new Date();

  // Summary
  const totalArea = records.reduce((a,r) => a+r.area, 0);
  const totalKcal = records.reduce((a,r) => a+r.calories, 0);
  const totalTime = records.reduce((a,r) => a+r.workDuration, 0);
  qs('#rec-total-area').innerHTML  = `${(totalArea/100).toFixed(0)}<span class="summary-card-unit">a</span>`;
  qs('#rec-total-kcal').innerHTML  = `${(totalKcal/1000).toFixed(1)}<span class="summary-card-unit">Mcal</span>`;
  qs('#rec-total-time').innerHTML  = `${Math.floor(totalTime/3600)}<span class="summary-card-unit">h</span>`;
  qs('#rec-total-count').innerHTML = `${records.length}<span class="summary-card-unit">回</span>`;

  // Monthly chart (last 6 months)
  const chart = qs('#month-chart');
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: `${d.getMonth()+1}月` };
  });
  const maxA = Math.max(...months.map(m => records.filter(r=>r.date.startsWith(m.key)).reduce((a,r)=>a+r.area,0)), 1);
  chart.innerHTML = months.map(m => {
    const a = records.filter(r=>r.date.startsWith(m.key)).reduce((a,r)=>a+r.area,0);
    const pct = a / maxA;
    return `<div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${Math.max(pct*52,2)}px"></div>
      <div class="chart-bar-lbl">${m.label}</div>
    </div>`;
  }).join('');

  // All records
  const list = qs('#all-records');
  if (records.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">記録がありません</div>`;
    return;
  }
  list.innerHTML = records.map(r => recordCardHTML(r)).join('');
}

function exportCSV() {
  const records = DB.records();
  if (records.length === 0) { showToast('エクスポートするデータがありません'); return; }
  const header = ['日付','開始時刻','終了時刻','作業時間(秒)','場所','機材','地形','地形係数','面積(㎡)','面積(a)','カロリー(kcal)','気温(℃)','GPS使用','移動距離(m)','メモ'];
  const rows = records.map(r => [
    r.date, r.startTime, r.endTime, r.workDuration,
    r.spotName||'', EQUIP[r.equipment]?.label||r.equipment,
    TERRAIN[r.terrain]?.label||r.terrain, r.terrainFactor,
    r.area, (r.area/100).toFixed(2), r.calories,
    r.temperature??'', r.gpsEnabled?'○':'×', r.gpsDist||0, r.memo||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kusagari_${dateStr(new Date())}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('✓ CSV出力完了！');
}

/* ─────────────────────────────────────
   SETTINGS
───────────────────────────────────── */
function renderSettings() {
  const p = DB.profile();
  qs('#setting-name').value       = p.name || '';
  qs('#setting-weight').value     = p.weight || 60;
  qs('#setting-equip').value      = p.defaultEquip || 'kari';
  qs('#setting-kari-maker').value = p.defaultKariMaker || 'orec';
  qs('#setting-spider').value     = p.defaultSpider || 'SP851';
  qs('#setting-hammer').value     = p.defaultHammer || 'HRC662';
  qs('#setting-badges').textContent = `${DB.badges().length} / ${BADGES_DEF.length} 獲得`;
}

function saveSettings() {
  const p = {
    name:             qs('#setting-name').value.trim() || 'ユーザー',
    weight:           parseFloat(qs('#setting-weight').value) || 60,
    defaultEquip:     qs('#setting-equip').value,
    defaultKariMaker: qs('#setting-kari-maker').value,
    defaultSpider:    qs('#setting-spider').value,
    defaultHammer:    qs('#setting-hammer').value,
  };
  DB.saveProfile(p);
  showToast('✓ 設定を保存しました / Saved');
}

function clearAllData() {
  if (!confirm('すべてのデータを削除しますか？\nThis will delete ALL records. Are you sure?')) return;
  ['records','profile','spots','badges'].forEach(k => localStorage.removeItem(`kt_${k}`));
  showToast('データを削除しました');
  navigate('home');
}

/* ─────────────────────────────────────
   RECORD / SPOT DETAIL (simple modal)
───────────────────────────────────── */
function showRecordDetail(id) {
  const r = DB.records().find(rec => rec.id === id);
  if (!r) return;
  const te = TERRAIN[r.terrain] || TERRAIN.flat;
  const eq = EQUIP[r.equipment] || EQUIP.other;
  const h = Math.floor(r.workDuration/3600), m = Math.floor((r.workDuration%3600)/60);
  const tStr = h > 0 ? `${h}時間${m}分` : `${m}分`;
  qs('#detail-modal-content').innerHTML = `
    <div class="modal-title">${escHtml(r.spotName||'作業記録')}</div>
    <div style="color:rgba(255,255,255,.5);font-size:12px;margin-bottom:14px">${r.date}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="metric-card"><div class="metric-val">${tStr}</div><div class="metric-lbl">作業時間</div></div>
      <div class="metric-card"><div class="metric-val">${(r.area/100).toFixed(1)}a</div><div class="metric-lbl">刈取面積</div></div>
      <div class="metric-card"><div class="metric-val">${r.calories}</div><div class="metric-unit">kcal</div><div class="metric-lbl">消費カロリー</div></div>
      <div class="metric-card"><div class="metric-val">${r.temperature??'—'}</div><div class="metric-unit">${r.temperature!==null?'℃':''}</div><div class="metric-lbl">気温</div></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      <span class="tag tag-orange">${te.icon} ${te.label} ${te.stars}</span>
      <span class="tag tag-green">${eq.label}</span>
      ${r.gpsEnabled?`<span class="tag tag-sky">GPS ${(r.gpsDist/1000).toFixed(2)}km</span>`:''}
      ${r.weather?`<span class="tag tag-gray">${r.weather}</span>`:''}
    </div>
    ${r.badges.length > 0 ? `<div style="margin-bottom:14px">${r.badges.map(id=>{const b=BADGES_DEF.find(x=>x.id===id);return b?`<span class="badge-chip new">${b.label}</span>`:''}).join(' ')}</div>` : ''}
    <button class="btn-danger-full" onclick="deleteRecord('${r.id}')">🗑 この記録を削除</button>
  `;
  qs('#modal-detail').classList.add('open');
}

function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  DB.deleteRecord(id);
  qs('#modal-detail').classList.remove('open');
  showToast('削除しました');
  if (state.screen === 'home') renderHome();
  if (state.screen === 'records') renderRecords();
}

function showSpotDetail(id) {
  const spot = DB.spots().find(s => s.id === id);
  if (!spot) return;
  const records = DB.records().filter(r => r.spotId === id);
  const totalArea = records.reduce((a,r) => a + r.area, 0);

  const hasLoc = spot.lat && spot.lon;
  const locLabel = hasLoc
    ? `📍 ${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)}`
    : '📍 位置情報未登録';
  const locColor = hasLoc ? 'var(--lime)' : 'rgba(255,255,255,.35)';

  qs('#detail-modal-content').innerHTML = `
    <div class="modal-title">${escHtml(spot.name)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="metric-card"><div class="metric-val">${records.length}</div><div class="metric-lbl">作業回数</div></div>
      <div class="metric-card"><div class="metric-val">${(totalArea/100).toFixed(0)}a</div><div class="metric-lbl">累計面積</div></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <span class="tag tag-orange">${TERRAIN[spot.terrain]?.label || '—'}</span>
      <span class="tag tag-gray">目標 年${spot.targetFreq}回</span>
      <span class="tag tag-gray" style="color:${locColor}">${locLabel}</span>
    </div>

    <!-- 位置情報更新ボタン -->
    <button onclick="updateSpotLocation('${id}')" id="btn-update-loc"
      style="width:100%;height:42px;background:rgba(158,232,64,.09);border:1px solid rgba(158,232,64,.28);border-radius:12px;color:var(--neon);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;margin-bottom:10px;transition:.2s">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
      ${hasLoc ? '📍 位置情報を現在地に更新' : '📍 現在地を位置情報として登録'}
    </button>
    <div id="spot-loc-status" style="font-size:11px;color:rgba(255,255,255,.38);text-align:center;margin-bottom:12px;min-height:14px"></div>

    ${records.length > 0 ? `<div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:rgba(255,255,255,.32);text-transform:uppercase;margin-bottom:8px">最近の作業</div>` : ''}
    ${records.slice(0,3).map(r => recordCardHTML(r)).join('')}
  `;
  qs('#modal-detail').classList.add('open');
}

async function updateSpotLocation(spotId) {
  const btn = qs('#btn-update-loc');
  const status = qs('#spot-loc-status');
  if (!btn || !status) return;

  btn.innerHTML = '📡 位置情報を取得中…';
  btn.style.opacity = '.6';

  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;

    // DBのスポットを更新
    const spots = DB.spots();
    const sp = spots.find(s => s.id === spotId);
    if (sp) {
      sp.lat = lat;
      sp.lon = lon;
      DB.saveSpots(spots);
    }

    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ✅ 位置情報を更新しました`;
    btn.style.background = 'rgba(158,232,64,.2)';
    btn.style.borderColor = 'rgba(158,232,64,.6)';
    btn.style.opacity = '1';
    status.textContent = `緯度 ${lat.toFixed(5)} / 経度 ${lon.toFixed(5)} ／ 精度 ±${Math.round(accuracy)}m`;
    status.style.color = 'var(--lime)';

    // 地図に反映
    if (state.screen === 'map') drawMowedPolygons();
    showToast(`📍 「${sp?.name || 'スポット'}」の位置情報を更新しました`);

  } catch (e) {
    btn.innerHTML = '⚠️ 位置情報の取得に失敗';
    btn.style.opacity = '1';
    btn.style.borderColor = 'rgba(217,79,42,.4)';
    btn.style.color = 'var(--danger)';
    status.textContent = '設定 → プライバシー → 位置情報サービスを確認してください';
  }
}

/* ─────────────────────────────────────
   UTILITIES
───────────────────────────────────── */
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

let toastTimeout = null;
function showToast(msg) {
  const el = qs('#toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Nav
  qsa('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.screen));
  });

  // Start modal
  qs('#btn-start-work').addEventListener('click', openStartModal);
  qs('#modal-start-close').addEventListener('click', closeStartModal);
  qs('#modal-start').addEventListener('click', e => { if (e.target === qs('#modal-start')) closeStartModal(); });

  // Detail modal close
  qs('#modal-detail-close').addEventListener('click', () => qs('#modal-detail').classList.remove('open'));
  qs('#modal-detail').addEventListener('click', e => { if (e.target === qs('#modal-detail')) qs('#modal-detail').classList.remove('open'); });

  // Equip buttons in modal
  qsa('.equip-btn').forEach(b => b.addEventListener('click', () => selectEquip(b.dataset.equip)));
  qsa('.blade-btn').forEach(b => b.addEventListener('click', () => selectBlade(b.dataset.blade)));
  qsa('.modal-terrain-btn').forEach(b => b.addEventListener('click', () => selectModalTerrain(b.dataset.terrain)));

  // Work controls
  qs('#btn-pause').addEventListener('click', togglePause);
  qs('#btn-end').addEventListener('click', endWork);

  // Share
  qs('#btn-share-x').addEventListener('click', shareToX);
  qs('#btn-copy-share').addEventListener('click', copyShareText);

  // Settings
  qs('#btn-save-settings').addEventListener('click', saveSettings);
  qs('#btn-clear-data').addEventListener('click', clearAllData);

  // CSV
  qs('#btn-export-csv').addEventListener('click', exportCSV);

  // Add spot button
  qs('#btn-add-spot').addEventListener('click', () => {
    openStartModal();
  });

  // Initial render
  navigate('home');
});
