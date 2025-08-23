// /src/utils/store.ts
// localStorage を使った正解/間違いストックとユーティリティ

const K_CORRECT = "kogoto.correctIds";
const K_WRONG = "kogoto.wrongIds";

function getSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key) || "[]";
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function getCorrectIds() { return getSet(K_CORRECT); }
export function getWrongIds() { return getSet(K_WRONG); }

export function addCorrectId(id: string) {
  const c = getCorrectIds();
  c.add(id);
  saveSet(K_CORRECT, c);
  // 正解したら wrong からは除く
  const w = getWrongIds();
  if (w.delete(id)) saveSet(K_WRONG, w);
  clearWrongMeta(id);
  bumpStat(id, "correct");
}

export function addWrongId(id: string) {
  const w = getWrongIds();
  w.add(id);
  saveSet(K_WRONG, w);
  markWrongFirstDate(id);
  bumpStat(id, "wrong");
}

export function moveWrongToCorrect(id: string) {
  const w = getWrongIds();
  if (w.delete(id)) saveSet(K_WRONG, w);
  const c = getCorrectIds();
  c.add(id);
  saveSet(K_CORRECT, c);
  clearWrongMeta(id);
  bumpStat(id, "correct");
}

export function counts() {
  return { correct: getCorrectIds().size, wrong: getWrongIds().size };
}

// 同一IDで重複しないようにするための識別子（word#reading）
export function makeItemId(word: string, reading?: string) {
  return `${word}#${reading || ""}`;
}

export function sampleWithoutReplacement<T>(arr: T[], n: number) {
  const src = [...arr];
  const out: T[] = [];
  while (out.length < n && src.length) {
    const i = Math.floor(Math.random() * src.length);
    out.push(src.splice(i, 1)[0]);
  }
  return out;
}

// ---- 設定（出題数・自動移行） ----
const K_SETTINGS = "kogoto.voiceSettings";
export type VoiceSettings = { questionCount: 5 | 10; autoAdvance: boolean; autoDelayMs: number };

export function getVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(K_SETTINGS);
    if (raw) {
      const p = JSON.parse(raw) || {};
      const q = [5, 10].includes(p.questionCount) ? p.questionCount : 10;
      const adv = !!p.autoAdvance;
      const delay = Number(p.autoDelayMs) || 3000;
      return { questionCount: q, autoAdvance: adv, autoDelayMs: delay };
    }
  } catch { }
  return { questionCount: 10, autoAdvance: false, autoDelayMs: 3000 };
}

export function saveVoiceSettings(s: VoiceSettings) {
  localStorage.setItem(K_SETTINGS, JSON.stringify(s));
}
// ---- 統計（累積の正解/不正解回数） ----
const K_STATS = "kogoto.stats";
export type Stat = { correct: number; wrong: number };
export type StatsMap = Record<string, Stat>;

function getStats(): StatsMap {
  try { return JSON.parse(localStorage.getItem(K_STATS) || "{}") || {}; } catch { return {}; }
}
function saveStats(m: StatsMap) { localStorage.setItem(K_STATS, JSON.stringify(m)); }
export function bumpStat(id: string, key: "correct" | "wrong") {
  const m = getStats();
  const cur = m[id] || { correct: 0, wrong: 0 };
  cur[key] += 1;
  m[id] = cur;
  saveStats(m);
}
export function listStats(vocabs: Array<{ word: string; reading?: string }>) {
  const stats = getStats();
  return vocabs.map(v => {
    const id = makeItemId(v.word, v.reading);
    const s = stats[id] || { correct: 0, wrong: 0 };
    const total = s.correct + s.wrong;
    const acc = total ? s.correct / total : 0;
    return { id, word: v.word, reading: v.reading, ...s, total, acc };
  });
}
export function topWrong(vocabs: any[], limit = 50) {
  return listStats(vocabs).sort((a, b) => b.wrong - a.wrong).slice(0, limit);
}
export function resetStats() { localStorage.removeItem(K_STATS); }

// ---- 未回収の「初回間違い日」管理 ----
const K_WRONG_META = "kogoto.wrongMeta"; // { [id]: { firstWrongDate: "YYYY-MM-DD" } }
type WrongMeta = Record<string, { firstWrongDate: string }>;

function loadWrongMeta(): WrongMeta {
  try { return JSON.parse(localStorage.getItem(K_WRONG_META) || "{}") || {}; } catch { return {}; }
}
function saveWrongMeta(m: WrongMeta) { localStorage.setItem(K_WRONG_META, JSON.stringify(m)); }

// ローカル日付（端末のタイムゾーンでOK）
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// 昨日までを判定するためのユーティリティ
function isBeforeToday(dateStr: string): boolean {
  return (dateStr || "") < todayStr();
}

// 間違い記録時に初回日を刻む（既にあれば維持）
export function markWrongFirstDate(id: string) {
  const meta = loadWrongMeta();
  if (!meta[id]) {
    meta[id] = { firstWrongDate: todayStr() };
    saveWrongMeta(meta);
  }
}
// 正解で回収したらメタも消す
export function clearWrongMeta(id: string) {
  const meta = loadWrongMeta();
  if (meta[id]) {
    delete meta[id];
    saveWrongMeta(meta);
  }
}

// 「今日の復習」件数（＝昨日までに間違え、まだ回収できてない語の数）
export function countReviewToday(): number {
  const wrong = getWrongIds(); // まだ“未回収”
  const meta = loadWrongMeta();
  let n = 0;
  wrong.forEach((id) => {
    const d = meta[id]?.firstWrongDate || "";
    if (d && isBeforeToday(d)) n++;
  });
  return n;
}
