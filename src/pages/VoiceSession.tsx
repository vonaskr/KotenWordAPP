// /src/pages/VoiceSession.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";
import { addCorrectId, addWrongId, counts, getWrongIds, makeItemId, moveWrongToCorrect, sampleWithoutReplacement, getVoiceSettings } from "../utils/store";
import SettingsModal from "../components/SettingsModal";

// ====== 読み上げ（TTS）
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

// ====== 正規化関連
function normalizeJa(input: string) {
  if (!input) return "";
  let s = input
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[一二三四]/g, (m) => ({ 一: "1", 二: "2", 三: "3", 四: "4" }[m]!))
    .replace(/[\s。．、，・!！?？~ー－—_（）()\[\]{}"'「」『』\.,/\\:;<>※•…-]/g, "");
  s = s.replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  s = s.replace(/(です|でした|だ|だよ|ですか|だとおもいます|だと思います|かな|かも|でしょう|でしょうか)$/g, "");
  return s;
}
function choiceTokens(choice: string) {
  const tokens = new Set<string>();
  const base = (choice || "").trim();
  if (!base) return [] as string[];
  tokens.add(normalizeJa(base));
  const m = base.match(/[（(]([^）)]+)[)）]/);
  if (m && m[1]) tokens.add(normalizeJa(m[1]));
  return Array.from(tokens);
}
function wordToIndexJa(s: string): number | null {
  const t = normalizeJa(s);
  const map: Record<string, number> = {
    "1": 1, いち: 1, ひとつ: 1, いちばん: 1, だいいち: 1,
    "2": 2, に: 2, ふたつ: 2, にばん: 2, だいに: 2,
    "3": 3, さん: 3, みっつ: 3, さんばん: 3, だいさん: 3,
    "4": 4, よん: 4, し: 4, よっつ: 4, よんばん: 4, だいよん: 4,
  };
  if (map[t]) return map[t];
  const m = t.match(/([1-4])ばん?$/);
  if (m) return Number(m[1]);
  return null;
}

// ====== SE（効果音）
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

function playCorrectSE(ac?: AudioContext, streakLevel: number = 1) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;
  // 連続が伸びるほど音を豪華に（最大3音）
    tone(ctx, 880, t0, 0.12);
    tone(ctx, 1175, t0 + 0.16, 0.16);
    if (streakLevel >= 3) tone(ctx, 1568, t0 + 0.32, 0.18); // 高音追加
    if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 500);
  }
function playWrongSE(ac?: AudioContext) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;
  buzz(ctx, t0, 0.45);
  if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 600);
}

export default function VoiceSession() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [qp, setQp] = useState<VocabItem[]>([]); // queue
  const [qi, setQi] = useState(0);               // index

  // スコアリング
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [phase, setPhase] = useState<"loading" | "idle" | "countdown" | "answer" | "done" | "finished">("loading");
  const [selected, setSelected] = useState<number | null>(null);
  const [heard, setHeard] = useState("");
  const [supported, setSupported] = useState<boolean>(false);
  const [noResult, setNoResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [conf, setConf] = useState(getVoiceSettings());   // 設定（自動ON/OFF, 遅延ms）
  const [autoProg, setAutoProg] = useState(0);            // 0..1 自動遷移 
  const autoRaf = useRef<number | null>(null);
  const autoTimeout = useRef<number | null>(null);

  // リトライ回数
  const MAX_TRIES = 3;
  const [tries, setTries] = useState(0);

  const [sp] = useSearchParams();
  const mode = (sp.get("mode") as "all10" | "missed") || "all10";
  const nav = useNavigate();

  // タイミング
  const acRef = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  const recRef = useRef<any>(null);
  const qRef = useRef<VocabItem | null>(null);
  const phaseRef = useRef<"loading" | "idle" | "countdown" | "answer" | "done" | "finished">("loading");
  const selectedRef = useRef<number | null>(null);
  const heardRef = useRef("");

  const q = qp[qi];
  useEffect(() => { qRef.current = q ?? null; }, [q]);
  const choices = useMemo(() => (q ? [q.choice1, q.choice2, q.choice3, q.choice4] : []), [q]);
  const tokensByChoice = useMemo(() => choices.map(choiceTokens), [choices]);
  const correctIdx = useMemo(() => (q ? Number(q.correct) : 0), [q]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { heardRef.current = heard; }, [heard]);

  useEffect(() => { if (!openSettings) setConf(getVoiceSettings()); }, [openSettings]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadVocab();
        setItems(data);
        const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        setSupported(!!SR);


        // キューを構築（設定の出題数を反映）
        const conf = getVoiceSettings();
        const N = conf.questionCount;
        if (mode === "missed") {
          const wrongIds = getWrongIds();
          const pick: VocabItem[] = [];
          for (const it of data) {
            if (wrongIds.has(makeItemId(it.word, it.reading))) pick.push(it);
          }
          const queue = pick.slice(0, N);
          setQp(queue);
          setQi(0);
          setPhase(queue.length ? "idle" : "finished");
        } else {
          const queue = sampleWithoutReplacement(data, N);
          setQp(queue);
          setQi(0);
          setPhase(queue.length ? "idle" : "finished");
        }
      } catch (e: any) {
        setErr(e?.message ?? "読み込みエラー");
        setPhase("finished");
      }
    })();
  }, [mode]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function cancelAutoNext() {
    if (autoRaf.current) { cancelAnimationFrame(autoRaf.current); autoRaf.current = null; }
    if (autoTimeout.current) { clearTimeout(autoTimeout.current); autoTimeout.current = null; }
    setAutoProg(0);
  }

  function startAutoNextTimer(ms: number) {
    cancelAutoNext();
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      setAutoProg(p);
      if (p < 1) autoRaf.current = requestAnimationFrame(tick);
    };
    autoRaf.current = requestAnimationFrame(tick);
    autoTimeout.current = window.setTimeout(() => {
      cancelAutoNext();
      next();
    }, ms);
  }

  // phase が done になったら必ず自動送りを開始（設定ON時）
  // done を抜けたら自動送りは止める（多重起動防止）
  useEffect(() => {
    if (phase === "done") {
      if (conf.autoAdvance) {
        startAutoNextTimer(conf.autoDelayMs);
      } else {
        cancelAutoNext();
      }
    } else {
      // answer / idle / countdown / finished など
      cancelAutoNext();
    }
  }, [phase, conf.autoAdvance, conf.autoDelayMs]);


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

  function stopRecognition() {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
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

  // 問題開始/リトライ
  function startQuestion(opts?: { retry?: boolean }) {
    const curQ = qRef.current;
    if (!curQ) return;
    cleanupAudio();
    stopRecognition(); // ← 取りこぼし防止
    if (opts?.retry) {
      setTries((t) => Math.min(t + 1, MAX_TRIES));
      setNoResult(false);
      setHeard("");
    } else {
      setSelected(null);
      setHeard("");
      setNoResult(false);
      setTries(1);
      // 最新の問題文で読み上げ（古いクロージャ対策）
      speakJa(curQ.word);
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
         if (text && phaseRef.current === "answer") { // ← answer中のみ処理
          setHeard(text);
          setNoResult(false);
          decideByVoice(text); // 早期確定
        }
      };
      rec.onend = () => { };
      recRef.current = rec;

      timers.current.push(
        window.setTimeout(() => {
          try { rec.start(); } catch { }
        }, Math.round((GO_OFFSET - ac.currentTime) * 1000))
      );

      const ANSWER_MS = 3000;
      timers.current.push(
        window.setTimeout(() => {
          stopRecognition(); // ← 確実に停止
          // 既に done 等なら何もしない（古いタイマーの暴発防止）
          if (phaseRef.current !== "answer") return;
          if (selectedRef.current != null) return;
          if (!heardRef.current) {
            setNoResult(true);
            setPhase("answer");
          } else {
            decideByVoice(heardRef.current);
          }
        }, Math.round((GO_OFFSET - ac.currentTime) * 1000) + ANSWER_MS)
      );
    }
  }

  function decideByVoice(raw?: string) {
    if (!q || selected) return;

    const t = normalizeJa(raw ?? heard);
    if (!t || t.length < 2) {
      setNoResult(true);
      setPhase("answer");
      return;
    }

    let guess: number | null = wordToIndexJa(t);
    if (!guess) {
      const ix = tokensByChoice.findIndex((tokens) => tokens.some((nc) => nc && (t === nc || t.includes(nc) || nc.includes(t))));
      if (ix >= 0) guess = ix + 1;
    }

    if (guess) {
      finalize(guess);
    } else {
      setNoResult(true);
      setPhase("answer");
    }
  }

  function finalize(chosenIdx: number) {
    if (!q) return;
    setSelected(chosenIdx);
    setPhase("done");
    stopRecognition();    // ← ここで確実に停止

    const id = makeItemId(q.word, q.reading);
    const correct = chosenIdx === Number(q.correct);

    // スコア：基本100 + 連続ボーナス（20*(streak-1)にキャップ）
    if (correct) {
      const newStreak = streak + 1;
      const bonus = Math.min(200, 20 * (newStreak - 1));
      setScore((s) => s + 100 + bonus);
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      setCorrectCount((c) => c + 1);
      // ストック更新
      if (mode === "missed") moveWrongToCorrect(id); else addCorrectId(id);
      playCorrectSE(acRef.current || undefined, newStreak);
    } else {
      setStreak(0);
      addWrongId(id);
      playWrongSE(acRef.current || undefined);
      setToast("この問題を「間違えた問題」に登録しました");
      setTimeout(() => setToast(null), 1200);
    }
    cleanupAudio(650);
    setNoResult(false); // 判定確定後は再挑戦UIを消す
  }

  function next() {
    cancelAutoNext();
    if (qi + 1 >= qp.length) {
      // 結果へ
      nav("/voice/result", { state: { total: qp.length, correct: correctCount, score, maxStreak, mode } });
      setPhase("finished");
      return;
    }
    setQi(qi + 1);
    setPhase("idle");
    setSelected(null);
    setHeard("");
    setNoResult(false);
    setTries(0);
    // 次の問題は自動で開始（ユーザー操作直後なので再生OK）
    setTimeout(() => startQuestion(), 100);
  }

  // 途中でやめる：回答済み分で結果へ
  function quitNow() {
    cancelAutoNext();
    stopRecognition();
    cleanupAudio();
    // 回答済み数：done中なら +1、それ以外は qi まで
    const answered = phase === "done" ? qi + 1 : qi;
    nav("/voice/result", {
      state: {
        total: answered,
        correct: correctCount,
        score,
        maxStreak,
        mode,
      },
    });
    setPhase("finished");
  }

  useEffect(() => () => cleanupAudio(), []);

  if (err) return <div className="p-6 text-red-500">エラー：{err}</div>;
  if (phase === "finished" && qp.length === 0) return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-2">出題できる問題がありません</h1>
      {mode === "missed" ? (
        <p className="text-slate-300 mb-4">「間違えた問題ストック」が空です。通常の 10問連続をお試しください。</p>
      ) : (
        <p className="text-slate-300 mb-4">CSVの問題が不足しています。</p>
      )}
      <Link to="/voice" className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 inline-block">メインへ戻る</Link>
    </div>
  );

  const total = qp.length;
  const page = qi + 1;
  const c = counts();

  return (
    <div className="w-full max-w-xl p-6">
    <div className="flex items-center justify-between mb-3 text-sm text-slate-300">
        <div>第 <b>{page}</b> / {total} 問</div>
        <div className="flex items-center gap-2">
          <span>スコア <b>{score}</b> ・ 連続 <b>{streak}</b> ・ 正解 {correctCount}</span>
          {streak >= 2 && (
            <span className="ml-1 px-2 py-0.5 rounded-full border border-amber-400 text-amber-200 bg-amber-500/10 animate-pulse">
              COMBO ×{streak}
            </span>
          )}
          <button onClick={() => setOpenSettings(true)} className="ml-2 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">⚙️ 設定</button>
          <button
            onClick={() => { if (confirm("途中で終了しますか？この時点までの結果でリザルトを表示します。")) quitNow(); }}
            className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600"
          >
            やめる
          </button>
        </div>
    </div>

      {q && (
        <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
          <div className="text-sm text-slate-400">{mode === "missed" ? "復習モード" : "通常モード"}</div>
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
                  onClick={() => finalize(idx)}
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
            <button onClick={() => startQuestion()} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500">この問題を開始</button>
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
                    <button onClick={() => startQuestion({ retry: true })} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500">
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
              {selected === correctIdx ? (
                <div className="text-green-400 font-semibold">正解！</div>
              ) : (
                <div className="text-red-400 font-semibold">不正解… 正解は ({correctIdx}) です</div>
              )}

              <div className="mt-4 flex items-center gap-4">
                <button onClick={() => { cancelAutoNext(); next(); }} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500">
                  次へ
                </button>
                {conf.autoAdvance && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <svg width="44" height="44" viewBox="0 0 44 44" className="rotate-[-90deg]">
                      {/* 背景リング */}
                      <circle cx="22" cy="22" r="18" fill="none" className="stroke-slate-600" strokeWidth="6" />
                      {/* 進捗リング */}
                      {
                        (() => {
                          const R = 18;
                          const C = 2 * Math.PI * R;
                          const off = (1 - autoProg) * C;
                          return <circle cx="22" cy="22" r={R} fill="none" strokeWidth="6" className="stroke-emerald-400"
                            strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round" />;
                        })()
                      }
                    </svg>
                    <span className="text-sm">自動で次へ… {Math.ceil((1 - autoProg) * (conf.autoDelayMs / 1000))} 秒</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-slate-400">
        進捗：正解ストック <b>{c.correct}</b> / 間違いストック <b>{c.wrong}</b>
      </div>
      <SettingsModal open={openSettings} onClose={() => setOpenSettings(false)} />
        {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-slate-100 border border-slate-700 px-3 py-2 rounded-lg shadow">
          {toast}
        </div>
      )}
    </div>
  );
}

