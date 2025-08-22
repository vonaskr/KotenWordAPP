import { useEffect, useMemo, useRef, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";

// === 読み上げ（TTS） ===
function speakJa(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const ja = voices.find((v) => v.lang?.toLowerCase().startsWith("ja"));
    if (ja) u.voice = ja;
    u.lang = "ja-JP";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { }
}

// === 正規化（数字・空白・句読点・全半角・カタカナ→ひらがな・語尾ちょい削り） ===
function normalizeJa(input: string) {
  if (!input) return "";
  let s = input
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // 全角→半角
    .replace(/[一二三四]/g, (m) => ({ 一: "1", 二: "2", 三: "3", 四: "4" }[m]!)) // 漢数字→数字
    .replace(/[\s。、．，・!！?？~ー－—_（）()\[\]{}"'「」『』.,/\\:;<>※•…-]/g, ""); // 空白・記号除去
  // カタカナ→ひらがな
  s = s.replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  // よくある語尾
  s = s.replace(/(です|でした|だ|だよ|ですか|だとおもいます|だと思います|かな|かも|でしょう|でしょうか)$/g, "");
  return s;
}

// ()や（）内の内容も候補に含める（例：悲しい（かなしい）→ ["悲しい（かなしい）","かなしい"]）
function choiceTokens(choice: string) {
  const tokens = new Set<string>();
  const base = (choice || "").trim();
  if (!base) return [] as string[];
  tokens.add(normalizeJa(base));
  const m = base.match(/[（(]([^）)]+)[)）]/);
  if (m && m[1]) tokens.add(normalizeJa(m[1]));
  return Array.from(tokens);
}

// 数字ワード→インデックス（1..4）
function wordToIndexJa(s: string): number | null {
  const t = normalizeJa(s);
  const map: Record<string, number> = {
    "1": 1, いち: 1, ひとつ: 1, いちばん: 1, だいいち: 1,
    "2": 2, に: 2, ふたつ: 2, にばん: 2, だいに: 2,
    "3": 3, さん: 3, みっつ: 3, さんばん: 3, だいさん: 3,
    "4": 4, よん: 4, し: 4, よっつ: 4, よんばん: 4, だいよん: 4,
  };
  if (map[t]) return map[t];
  const m = t.match(/([1-4])ばん?$/); // 1番,2番…
  if (m) return Number(m[1]);
  return null;
}

// === SE（効果音） ===
// 短いトーン
function tone(ctx: AudioContext, freq: number, t: number, dur = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ブザー（低音で減衰）
function buzz(ctx: AudioContext, t: number, dur = 0.4) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(90, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.02);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 正解SE：ピン → ポン（上がる2音）
function playCorrectSE(ac?: AudioContext) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;
  tone(ctx, 880, t0, 0.12);      // A5
  tone(ctx, 1175, t0 + 0.16, 0.16); // D6-ish
  if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 500);
}

// 不正解SE：ブブー
function playWrongSE(ac?: AudioContext) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;
  buzz(ctx, t0, 0.45);
  if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 600);
}

export default function Voice() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // 出題（まずは1問目）
  const [idx] = useState(0);
  const q = items[idx];
  const choices = useMemo(() => (q ? [q.choice1, q.choice2, q.choice3, q.choice4] : []), [q]);
  const tokensByChoice = useMemo(() => choices.map(choiceTokens), [choices]);
  const correctIdx = useMemo(() => (q ? Number(q.correct) : 0), [q]);

  // 再挑戦回数（最大3トライ）
  const MAX_TRIES = 3;
  const [tries, setTries] = useState(0);

  // 進行
  const [phase, setPhase] = useState<"idle" | "countdown" | "answer" | "done">("idle");
  const [selected, setSelected] = useState<number | null>(null);
  const [heard, setHeard] = useState("");
  const [supported, setSupported] = useState<boolean>(false);
  const [noResult, setNoResult] = useState(false); // 聞き取れなかった/マッチしない

  // タイミング
  const acRef = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);

  // 音声認識
  const recRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadVocab();
        setItems(data);
      } catch (e: any) {
        setErr(e?.message ?? "読み込みエラー");
      }
    })();
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    setSupported(!!SR);
  }, []);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  // ビープ（リズム）
  function beepAt(ac: AudioContext, t: number, dur = 0.09) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function startQuestion(opts?: { retry?: boolean }) {
    if (!q) return;
    
    // 既存のタイマー/AudioContextをクリア
    cleanupAudio();
    if (opts?.retry) {
      // リトライ：TTSは省略、回数を+1（上限MAX_TRIES）
      setTries((t) => Math.min(t + 1, MAX_TRIES));
      setNoResult(false);
      setHeard("");
    } else {
      // 初回：状態リセット＋TTSあり、回数=1
      setSelected(null);
      setHeard("");
      setNoResult(false);
      setTries(1);
      speakJa(q.word);
    }
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    acRef.current = ac;
    const now = ac.currentTime + 0.25;
    const BEAT = 0.6;
    const GO_OFFSET = now + BEAT * 3;

    beepAt(ac, now);
    beepAt(ac, now + BEAT);
    beepAt(ac, now + BEAT * 2);
    beepAt(ac, now + BEAT * 3);

    setPhase("countdown");

    timers.current.push(
      window.setTimeout(() => setPhase("answer"), Math.round((GO_OFFSET - ac.currentTime) * 1000))
    );

    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "ja-JP";
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.onerror = () => { };
      rec.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript || "";
        if (text) {
          setHeard(text);
          setNoResult(false);   // ← 聞き取れたのでフラグ解除
          decideByVoice(text);  // 早期確定
        }
      };
      rec.onend = () => { };
      recRef.current = rec;

      // GOで start()
      timers.current.push(
        window.setTimeout(() => {
          try { rec.start(); } catch { }
        }, Math.round((GO_OFFSET - ac.currentTime) * 1000))
      );

      // 締切（3秒）で stop() → 判定（未マッチなら「聞き取れませんでした」を表示）
      const ANSWER_MS = 3000;
      timers.current.push(
        window.setTimeout(() => {
          try { rec.stop(); } catch { }
          if (!selected) {
            if (!heard) {
              setNoResult(true);
              setPhase("answer"); // ×にせず待機（クリック回答OK）
            } else {
              decideByVoice(heard);
            }
          }
        }, Math.round((GO_OFFSET - ac.currentTime) * 1000) + ANSWER_MS)
      );
    }
  }

  // SE後に遅延クローズ（自動再生ブロック回避のため）
  function cleanupAudio(delayMs = 0) {
    clearTimers();
    const ctx = acRef.current;
    if (ctx && delayMs > 0) {
      setTimeout(() => { try { ctx.close(); } catch { } }, delayMs);
      acRef.current = null;
    } else {
      try { ctx?.close(); } catch { }
      acRef.current = null;
    }
  }

  useEffect(() => () => cleanupAudio(), []);

  function decideByVoice(raw?: string) {
    if (!q || selected) return;

    const t = normalizeJa(raw ?? heard);

    // 0) 空や短すぎは判定しない（(1)事故防止）
    if (!t || t.length < 2) {
      setNoResult(true);
      setPhase("answer");
      return;
    }

    // 1) 数字系（いち/に/さん/よん, 1番 等）
    let guess: number | null = wordToIndexJa(t);

    // 2) テキスト一致（choice本体 or （）内の別表記）
    if (!guess) {
      const ix = tokensByChoice.findIndex((tokens) =>
        tokens.some((nc) => nc && (t === nc || t.includes(nc) || nc.includes(t)))
      );
      if (ix >= 0) guess = ix + 1;
    }

    if (guess) {
      setSelected(guess);
      setPhase("done");
      // ----- SE（正解/不正解） -----
      if (guess === correctIdx) playCorrectSE(acRef.current || undefined);
      else playWrongSE(acRef.current || undefined);
      cleanupAudio(650); // SEが鳴り終わってから閉じる
    } else {
      setNoResult(true);
      setPhase("answer"); // クリック回答へ
    }
  }

  if (err) return <div className="p-6 text-red-500">エラー：{err}</div>;
  if (!q) return <div className="p-6">問題がありません（vocab.csv を確認）</div>;

  const isCorrect = selected != null && selected === correctIdx;

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-1">音声4択（読み上げ→3,2,1→発話）</h1>
      <p className="text-slate-300 mb-4">
        {supported ? "※ Chrome 推奨。GO から約3秒が回答受付です。" : "※ このブラウザは音声認識に対応していません（クリックで回答してください）。"}
      </p>

      <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
        <div className="text-sm text-slate-400">第1問</div>
        <div className="text-3xl font-semibold my-2">{q.word}</div>
        {q.reading && <div className="text-slate-400 mb-4">（{q.reading}）</div>}

        <div className="grid grid-cols-1 gap-3 mb-4">
          {choices.map((c, i) => {
            const idx = i + 1;
            const isSel = selected === idx;
            const isCorr = selected != null && idx === correctIdx;
            const isWrong = selected != null && isSel && idx !== correctIdx;
            return (
              <button
                key={idx}
                disabled={selected != null}
                onClick={() => {
                  setSelected(idx);
                  setPhase("done");
                  if (idx === correctIdx) playCorrectSE(acRef.current || undefined);
                  else playWrongSE(acRef.current || undefined);
                  cleanupAudio(650);
                }}
                className={[
                  "w-full text-left px-4 py-3 rounded-lg border transition",
                  isCorr
                    ? "bg-green-600/20 border-green-500"
                    : isWrong
                      ? "bg-red-600/20 border-red-500"
                      : "bg-slate-700/60 border-slate-600 hover:border-slate-400",
                ].join(" ")}
              >
                <span className="mr-2 text-slate-400">({idx})</span>
                {c || "（空）"}
              </button>
            );
          })}
        </div>

        {phase === "idle" && (
          <button onClick={() => startQuestion()} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500">
            この問題を開始
          </button>
        )}
        {phase === "countdown" && <div className="text-sky-300">カウントダウン中…（3→2→1→GO）</div>}
        {phase === "answer" && (
          <div className="text-amber-300">
            GO！いま答えてください（約3秒）。
            {heard && (
              <div className="mt-2 text-slate-200">
                あなたの回答：<span className="font-semibold">「{heard}」</span>
              </div>
            )}
            {noResult && (
              <div className="mt-2 space-y-2">
                <div className="text-slate-300">
                  ※ うまく聞き取れませんでした。数字で「2番」や、選択肢の
                  <span className="underline">（ ）内の読み</span>を入れると通りやすいです。
                </div>
                {tries < MAX_TRIES && (
                  <button
                    onClick={() => startQuestion({ retry: true })}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500"
                  >
                    音声で再挑戦（あと {MAX_TRIES - tries} 回）
                  </button>
                )}
                <div className="text-slate-300">
                  または、<b>選択肢を手動でタップ</b>してください。
                </div>
              </div>
            )}
          </div>
        )}
        {phase === "done" && (
          <div className="mt-3">
            {heard && (
              <div className="mb-2 text-slate-200">
                あなたの回答：<span className="font-semibold">「{heard}」</span>
              </div>
            )}
            {isCorrect ? (
              <div className="text-green-400 font-semibold">正解！</div>
            ) : (
              <div className="text-red-400 font-semibold">不正解… 正解は ({correctIdx}) です</div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400">
        データ元：<code>/public/vocab.csv</code><br />
        ● 音声で当てやすくするコツ：選択肢に「（かな）」や「（別表記）」を足す（例：<code>まずしい（貧しい）</code>）。<br />
        ● それでも難しいときは「<b>番号で回答</b>」もOK（例：「<b>2番</b>」「<b>にばん</b>」）。
      </div>
    </div>
  );
}
