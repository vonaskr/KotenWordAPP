// /src/pages/VoiceSession.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";
import { addCorrectId, addWrongId, counts, getWrongIds, makeItemId, moveWrongToCorrect, sampleWithoutReplacement, getVoiceSettings, topWrong } from "../utils/store";
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

// ---- ユーティリティ：シャッフル（配列をランダム並べ替え）----
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// ---- 連続数に応じた紙吹雪（遅延ロード） ----
let _confetti: any = null;

async function fireConfettiTier(tier: 0|1|2|3) {
  if (tier <= 0) return;
  try {
    if (!_confetti) {
      const mod = await import("canvas-confetti");
      _confetti = mod.default || mod;
    }
    // tierごとのパラメータ
    const profile = [
      { count: 0,  spread: 0,  vel: 0,  scalar: 1.0, ticks: 120 },
      { count: 80, spread: 55, vel: 40, scalar: 0.9, ticks: 140 },
      { count: 120,spread: 70, vel: 50, scalar: 0.95,ticks: 160 },
      { count: 160,spread: 90, vel: 55, scalar: 1.0, ticks: 180 },
    ][tier];

    // メインバースト
    _confetti({
      particleCount: profile.count,
      spread: profile.spread,
      startVelocity: profile.vel,
      scalar: profile.scalar,
      ticks: profile.ticks,
      origin: { x: 0.5, y: 0.3 },
      //disableForReducedMotion: true,
    });

    // ちょいリッチ：tier2以上で左右から小バースト
    if (tier >= 2) {
      _confetti({
        particleCount: Math.round(profile.count * 0.35),
        spread: profile.spread - 10,
        startVelocity: profile.vel - 10,
        scalar: profile.scalar * 0.9,
        ticks: profile.ticks - 20,
        angle: 60,
        origin: { x: 0.15, y: 0.4 },
        disableForReducedMotion: true,
      });
      _confetti({
        particleCount: Math.round(profile.count * 0.35),
        spread: profile.spread - 10,
        startVelocity: profile.vel - 10,
        scalar: profile.scalar * 0.9,
        ticks: profile.ticks - 20,
        angle: 120,
        origin: { x: 0.85, y: 0.4 },
        disableForReducedMotion: true,
      });
    }
  } catch { /* 失敗時は静かに無視 */ }
}

function playCorrectSE(ac?: AudioContext, streakLevel: number = 1) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;

  // ベースの2音
  tone(ctx, 880, t0, 0.12);
  tone(ctx, 1175, t0 + 0.16, 0.16);

  // 3連続以上で高音を1つ
  if (streakLevel >= 3) tone(ctx, 1568, t0 + 0.32, 0.18);

  // 5連続以上で和音追加（軽く）
  if (streakLevel >= 5) {
    tone(ctx, 1319, t0 + 0.12, 0.12);
    tone(ctx, 1760, t0 + 0.36, 0.16);
  }

  // 7連続以上でフィニッシュ小音
  if (streakLevel >= 7) {
    tone(ctx, 2093, t0 + 0.52, 0.12);
  }

  if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 700);
}

function playWrongSE(ac?: AudioContext) {
  const ctx = ac ?? new (window.AudioContext || (window as any).webkitAudioContext)();
  const t0 = ctx.currentTime + 0.01;
  buzz(ctx, t0, 0.45);
  if (!ac) setTimeout(() => { try { ctx.close(); } catch { } }, 600);
}

export default function VoiceSession() {
  //const [items, setItems] = useState<VocabItem[]>([]);
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
  //const [supported, setSupported] = useState<boolean>(false);
  const [noResult, setNoResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  const [openSettings, setOpenSettings] = useState(false);
  const [conf, setConf] = useState(getVoiceSettings());   // 設定（自動ON/OFF, 遅延ms）
  const [autoProg, setAutoProg] = useState(0);            // 0..1 自動遷移 
  const autoRaf = useRef<number | null>(null);
  const autoTimeout = useRef<number | null>(null);

  // リトライ回数
  const MAX_TRIES = 3;
  const [tries, setTries] = useState(0);

  // 回線と音声認識の可否
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const srSupported = useMemo(
    () => !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition),
    []
  );
  const voiceUsable = isOnline && srSupported; // これが false なら音声UIを出さない

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
  const autoStartedRef = useRef(false); // 初回だけ自動開始

  const q = qp[qi];

  // 初回マウント時に canvas-confetti を読み込んでおく（初回の遅延防止）
  useEffect(() => {
    (async () => {
      try {
        if (!_confetti) {
          const mod = await import("canvas-confetti");
          _confetti = (mod as any).default || mod;
        }
      } catch {}
    })();
  }, []);


  useEffect(() => { qRef.current = q ?? null; }, [q]);
  const choices = useMemo(() => (q ? [q.choice1, q.choice2, q.choice3, q.choice4] : []), [q]);
  const tokensByChoice = useMemo(() => choices.map(choiceTokens), [choices]);
  const correctIdx = useMemo(() => (q ? Number(q.correct) : 0), [q]);
  useEffect(() => {
    if (phase === "idle" && q && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setTimeout(() => startQuestion(), 120); // 少し遅らせてTTS/Audioの準備待ち
    }
  }, [phase, q]);

  // online offlineのイベントで状態更新
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { heardRef.current = heard; }, [heard]);

  useEffect(() => { if (!openSettings) setConf(getVoiceSettings()); }, [openSettings]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadVocab();
        //setItems(data);
        //const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        //setSupported(!!SR);


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
          autoStartedRef.current = false; // ← ここで毎回リセット
          setQp(queue);
          setQi(0);
          setPhase(queue.length ? "idle" : "finished");
        } else {
          // 通常モード：不正解回数の多い順に苦手注入＋残りランダム
          const queueCount = N; // 直前で getVoiceSettings() から取得済み
          const wrongSet = getWrongIds();

          // 1) 不正解の多い順ランキングを取得（最大200件など十分に）
          const ranked = topWrong(data, 200); // => [{id, word, reading, correct, wrong, total, acc}, ...]

          // 2) 「今のCSVに存在」かつ「現在も wrong ストックに居るもの」に絞る
          const rankedWrongIds = ranked
            .map(r => makeItemId(r.word, r.reading))
            .filter(id => wrongSet.has(id));

          // 3) 注入数を決定（5問モードは最大2、10問モードは最大3）
          const injectMax = queueCount >= 10 ? 3 : 2;
          const injectNum = Math.min(injectMax, rankedWrongIds.length, queueCount);

          // 4) 注入対象の VocabItem を取り出す（上位から injectNum 件）
          const id2item = new Map(data.map(it => [makeItemId(it.word, it.reading), it]));
          const injected: VocabItem[] = rankedWrongIds
            .slice(0, injectNum)
            .map(id => id2item.get(id)!)
            .filter(Boolean);

          // 5) 残りは、注入した単語を除いてランダム抽出
          const injectedIds = new Set(injected.map(it => makeItemId(it.word, it.reading)));
          const restPool = data.filter(it => !injectedIds.has(makeItemId(it.word, it.reading)));
          const restNeed = Math.max(0, queueCount - injected.length);
          const rest = sampleWithoutReplacement(restPool, restNeed);

          // 6) 出題順を軽くシャッフルして完成
          const queue = shuffle([...injected, ...rest]); // shuffle は前段で追加済みのユーティリティ

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
    try { recRef.current?.stop(); } catch { }
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
    // ★ レース防止：参照される可能性がある ref を即クリア
    selectedRef.current = null;
    heardRef.current = "";
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
    if (SR && voiceUsable) {
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
        else {
          // 音声が使えないときは、答え時間だけ可視メッセージを出して手動回答へ誘導
          // （phase は既に countdown→answer に遷移します）
          setNoResult(false); // 「聞き取れませんでした」は出さない
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
    // ★ state は非同期反映なので ref を見る
    if (!q || selectedRef.current != null) return;

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
    selectedRef.current = chosenIdx; // ★ 即座に“確定済み”を共有
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
      // ストック更新
      if (mode === "missed") moveWrongToCorrect(id); else addCorrectId(id);
      playCorrectSE(acRef.current || undefined, newStreak);

      // ★ 連続数に応じて祝福強度を段階化
      const tier: 0|1|2|3 =
        newStreak >= 7 ? 3 :
        newStreak >= 5 ? 2 :
        newStreak >= 3 ? 1 : 0;
      fireConfettiTier(tier);

    } else {
      setStreak(0);
      addWrongId(id);
      playWrongSE(acRef.current || undefined);
      setToast("この問題を「間違えた問題」に登録しました");
      setTimeout(() => setToast(null), 1200);
    }
    // ヒント自動チラ見せ（邪魔しない程度に 1 秒後・自動送りがONでもOK）
    const hasHint = !!q.hint?.trim();
    if (hasHint) {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = window.setTimeout(() => setShowHint(true), 1000);
    }
    cleanupAudio(650);
    setNoResult(false); // 判定確定後は再挑戦UIを消す
  }

  function next() {
    cancelAutoNext();
    setShowHint(false);
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

  useEffect(() => () => {
    cleanupAudio();
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

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
  const isLast = page >= total && total > 0;
  const c = counts();

  return (
    <div className="w-full max-w-xl p-6">
      <div className="flex items-center justify-between mb-3 text-sm text-slate-300">
        <div>第 <b>{page}</b> / {total} 問</div>
        <div className="flex items-center gap-2">
          <span>スコア <b>{score}</b> ・ 連続 <b>{streak}</b> ・ 正解 {correctCount}</span>
          {!isOnline && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-700 border border-slate-500 text-xs">
              オフライン（音声なし）
            </span>
          )}
          {isOnline && !srSupported && (
            <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-700 border border-slate-500 text-xs">
              この端末は音声認識に非対応
            </span>
          )}

          {(() => {
            const tier = streak >= 7 ? 3 : streak >= 5 ? 2 : streak >= 3 ? 1 : 0;
            return (streak >= 2 && (
              <span
                className={[
                  "ml-1 px-2 py-0.5 rounded-full border text-amber-100 bg-amber-500/10",
                  tier >= 2 ? "border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.35)]" : "border-amber-400",
                  tier >= 3 ? "animate-bounce" : "animate-pulse",
                ].join(" ")}
              >
                COMBO ×{streak}
              </span>
            ));
          })()}
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
              {!voiceUsable && (
                <div className="mt-2 text-slate-300">
                  ※ 現在 <b>音声回答は使えません</b>。下の<span className="underline">選択肢ボタン</span>をタップして答えてください。
                </div>
              )}
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
                  {voiceUsable && tries < MAX_TRIES && (
                    <button onClick={() => startQuestion({ retry: true })} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500">
                      音声で再挑戦（あと {MAX_TRIES - tries} 回）
                    </button>
                  )}
                  <div className="text-slate-300">
                    または、<b>選択肢を手動でタップ</b>してください。
                  </div>
                </div>
              )}
              {/* ヒントトグル（任意表示） */}
              {q.hint && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowHint((v) => !v)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700/60 hover:bg-slate-600"
                  >
                    {showHint ? "ヒントを閉じる" : "ヒントを見る"}
                  </button>
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
                <button
                  onClick={() => { cancelAutoNext(); next(); }}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500"
                >
                  {isLast ? "結果を表示" : "次へ"}
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
                    <span className="text-sm">
                      自動で{isLast ? "結果へ" : "次へ"}… {Math.ceil((1 - autoProg) * (conf.autoDelayMs / 1000))} 秒
                    </span>
                  </div>
                )}
              </div>
              {/* ヒントトグル（任意表示） */}
              {q.hint && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowHint((v) => !v)}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700/60 hover:bg-slate-600"
                  >
                    {showHint ? "ヒントを閉じる" : "ヒントを見る"}
                  </button>
                </div>
              )}
            </div>
          )}
          {showHint && q.hint && (
            <div className="mt-3 p-3 rounded-lg border border-indigo-500/50 bg-indigo-900/20 text-indigo-200">
              <div className="text-xs mb-1 opacity-80">ヒント</div>
              <div className="leading-relaxed">{q.hint}</div>
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

