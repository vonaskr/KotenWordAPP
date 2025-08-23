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
}

export function addWrongId(id: string) {
  const w = getWrongIds();
  w.add(id);
  saveSet(K_WRONG, w);
}

export function moveWrongToCorrect(id: string) {
  const w = getWrongIds();
  if (w.delete(id)) saveSet(K_WRONG, w);
  const c = getCorrectIds();
  c.add(id);
  saveSet(K_CORRECT, c);
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