import { useEffect, useMemo, useRef, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// MediaPipe assets（オンライン版）。必要に応じて /public に同梱可
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

type Scores = {
  smile: number; // 笑顔度
  frown: number; // 口角下げ（悲しみ）
  browDown: number; // 眉下げ（しかめ）
  eyeSquint: number; // 目細め
  mouthPress: number; // 口結び
  noseSneer: number; // 鼻しわ
  jawOpen: number; // 口を開く
  mouthLowerDown: number; // 下唇下げ
  mouthUpperUp: number; // 上唇上げ
};

type Perm = "idle" | "granted" | "denied";

function useFaceMood() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [permission, setPermission] = useState<Perm>("idle");
  const [error, setError] = useState<string | null>(null);
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);
  const rafId = useRef<number | null>(null);

  // 個人差を減らすため、ニュートラル（基準）を保存
  const base = useRef<Record<string, number>>({});

  const [scores, setScores] = useState<Scores>({
    smile: 0,
    frown: 0,
    browDown: 0,
    eyeSquint: 0,
    mouthPress: 0,
    noseSneer: 0,
    jawOpen: 0,
    mouthLowerDown: 0,
    mouthUpperUp: 0,
  });

  const getCat = (cats: any[], name: string) => cats.find((c) => c.categoryName === name)?.score ?? 0;
  const adj = (name: string, raw: number) => Math.max(0, raw - (base.current[name] ?? 0));

  const calibrateNeutral = () => {
    const v = (window as any).__lastBlends as any[] | undefined;
    if (!v) return;
    const get = (n: string) => v.find((c) => c.categoryName === n)?.score ?? 0;
    [
      "mouthSmileLeft",
      "mouthSmileRight",
      "mouthFrownLeft",
      "mouthFrownRight",
      "browDownLeft",
      "browDownRight",
      "eyeSquintLeft",
      "eyeSquintRight",
      "mouthPressLeft",
      "mouthPressRight",
      "noseSneerLeft",
      "noseSneerRight",
      "jawOpen",
      "mouthLowerDownLeft",
      "mouthLowerDownRight",
      "mouthUpperUpLeft",
      "mouthUpperUpRight",
    ].forEach((k) => (base.current[k] = get(k)));
  };

  const start = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await new Promise((res) => (videoRef.current!.onloadedmetadata = () => res(null)));
      await videoRef.current.play();
      setPermission("granted");

      if (!landmarker) {
        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE);
        const lm = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true,
          numFaces: 1,
        });
        setLandmarker(lm);
      }

      const loop = () => {
        if (!videoRef.current || !landmarker) {
          rafId.current = requestAnimationFrame(loop);
          return;
        }
        const ts = performance.now();
        const res = landmarker.detectForVideo(videoRef.current, ts);
        const blends = res.faceBlendshapes?.[0]?.categories ?? [];
        (window as any).__lastBlends = blends; // 基準取得用

        // ニュートラル補正後のスコア
        const s2: Scores = {
          smile: (adj("mouthSmileLeft", getCat(blends, "mouthSmileLeft")) + adj("mouthSmileRight", getCat(blends, "mouthSmileRight"))) / 2,
          frown: (adj("mouthFrownLeft", getCat(blends, "mouthFrownLeft")) + adj("mouthFrownRight", getCat(blends, "mouthFrownRight"))) / 2,
          browDown: (adj("browDownLeft", getCat(blends, "browDownLeft")) + adj("browDownRight", getCat(blends, "browDownRight"))) / 2,
          eyeSquint: (adj("eyeSquintLeft", getCat(blends, "eyeSquintLeft")) + adj("eyeSquintRight", getCat(blends, "eyeSquintRight"))) / 2,
          mouthPress: (adj("mouthPressLeft", getCat(blends, "mouthPressLeft")) + adj("mouthPressRight", getCat(blends, "mouthPressRight"))) / 2,
          noseSneer: (adj("noseSneerLeft", getCat(blends, "noseSneerLeft")) + adj("noseSneerRight", getCat(blends, "noseSneerRight"))) / 2,
          jawOpen: adj("jawOpen", getCat(blends, "jawOpen")),
          mouthLowerDown: (adj("mouthLowerDownLeft", getCat(blends, "mouthLowerDownLeft")) + adj("mouthLowerDownRight", getCat(blends, "mouthLowerDownRight"))) / 2,
          mouthUpperUp: (adj("mouthUpperUpLeft", getCat(blends, "mouthUpperUpLeft")) + adj("mouthUpperUpRight", getCat(blends, "mouthUpperUpRight"))) / 2,
        };

        // 平滑化（EMA）
        const alpha = 0.8;
        setScores((prev) => ({
          smile: prev.smile * alpha + s2.smile * (1 - alpha),
          frown: prev.frown * alpha + s2.frown * (1 - alpha),
          browDown: prev.browDown * alpha + s2.browDown * (1 - alpha),
          eyeSquint: prev.eyeSquint * alpha + s2.eyeSquint * (1 - alpha),
          mouthPress: prev.mouthPress * alpha + s2.mouthPress * (1 - alpha),
          noseSneer: prev.noseSneer * alpha + s2.noseSneer * (1 - alpha),
          jawOpen: prev.jawOpen * alpha + s2.jawOpen * (1 - alpha),
          mouthLowerDown: prev.mouthLowerDown * alpha + s2.mouthLowerDown * (1 - alpha),
          mouthUpperUp: prev.mouthUpperUp * alpha + s2.mouthUpperUp * (1 - alpha),
        }));

        rafId.current = requestAnimationFrame(loop);
      };
      rafId.current = requestAnimationFrame(loop);
    } catch (e: any) {
      console.error(e);
      setPermission("denied");
      setError("カメラを開始できませんでした（権限/他アプリ使用中を確認）");
    }
  };

  const stop = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setPermission("idle");
  };

  return { videoRef, permission, error, scores, start, stop, calibrateNeutral };
}

function pickMoodItem(pool: VocabItem[]): VocabItem | null {
  const list = pool.filter((x) => x.polarity === "pos" || x.polarity === "neg");
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export default function Mood() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [q, setQ] = useState<VocabItem | null>(null);
  const [answered, setAnswered] = useState(false);
  const [sel, setSel] = useState<"pos" | "neg" | null>(null);
  const [th, setTh] = useState(0.18); // 判定のしきい値

  const { videoRef, permission, error, scores, start, stop, calibrateNeutral } = useFaceMood();

  useEffect(() => {
    (async () => {
      const data = await loadVocab();
      setItems(data);
      setQ(pickMoodItem(data));
    })();
  }, []);

  // ネガ = 悲しみ / しかめ（眉・目・口・鼻） / 口を開く の最大
  const scowl = useMemo(() => {
    const wB = 0.35,
      wE = 0.25,
      wM = 0.2,
      wN = 0.2;
    return wB * scores.browDown + wE * scores.eyeSquint + wM * scores.mouthPress + wN * scores.noseSneer;
  }, [scores]);

  const openMouthRaw = useMemo(() => 0.6 * scores.jawOpen + 0.2 * scores.mouthLowerDown + 0.2 * scores.mouthUpperUp, [
    scores.jawOpen,
    scores.mouthLowerDown,
    scores.mouthUpperUp,
  ]);

  // 笑顔で大口でもネガに誤判定されないようゲート
  const smileGate = useMemo(() => Math.max(0, 1 - scores.smile / 0.15), [scores.smile]);
  const openMouth = useMemo(() => openMouthRaw * smileGate, [openMouthRaw, smileGate]);

  const neg = useMemo(() => Math.max(scores.frown, scowl, openMouth), [scores.frown, scowl, openMouth]);
  const pos = useMemo(() => scores.smile, [scores.smile]);

  const moodScore = useMemo(() => pos - neg, [pos, neg]);
  const liveGuess: "pos" | "neg" | "wait" = useMemo(() => {
    if (moodScore >= th) return "pos";
    if (moodScore <= -th) return "neg";
    return "wait";
  }, [moodScore, th]);

  // 0.5秒連続で同じ推定なら自動確定
  const AUTO_DWELL_MS = 500 * 2;
  const dwellTimer = useRef<number | null>(null);
  useEffect(() => {
    if (answered || permission !== "granted") return;
    if (liveGuess === "pos" || liveGuess === "neg") {
      if (dwellTimer.current) window.clearTimeout(dwellTimer.current);
      const want = liveGuess;
      dwellTimer.current = window.setTimeout(() => {
        if (want === liveGuess && !answered) {
          setSel(want);
          setAnswered(true);
        }
      }, AUTO_DWELL_MS);
    } else {
      if (dwellTimer.current) {
        window.clearTimeout(dwellTimer.current);
        dwellTimer.current = null;
      }
    }
    return () => {
      if (dwellTimer.current) {
        window.clearTimeout(dwellTimer.current);
        dwellTimer.current = null;
      }
    };
  }, [liveGuess, answered, permission]);

  const decideByFace = () => {
    if (liveGuess === "wait") return;
    setSel(liveGuess);
    setAnswered(true);
  };

  const next = () => {
    setAnswered(false);
    setSel(null);
    setQ(pickMoodItem(items));
  };

  if (!q) return <div>問題を読み込み中…またはネガポジ対象の行がありません。</div>;
  const correct = answered && sel ? sel === q.polarity : null;

  const posHighlight = !answered && liveGuess === "pos" ? "border-emerald-500 ring-2 ring-emerald-500" : "border-slate-600";
  const negHighlight = !answered && liveGuess === "neg" ? "border-rose-500 ring-2 ring-rose-500" : "border-slate-600";

  return (
    <div className="grid gap-4">
      <div className="text-sm text-slate-400">表情ネガポジ（ネガ=悲しみ/しかめ/口を大きく開ける）</div>

      <div className="grid md:grid-cols-[1fr,380px] gap-5 items-start">
        {/* 左：問題カード */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="text-2xl font-semibold">{q.word}</div>
          {q.reading && <div className="text-slate-400 mb-4">（{q.reading}）</div>}

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div className={`px-4 py-3 rounded-lg bg-slate-700/60 border ${posHighlight}`}>😊 {q.pos_label || "ポジティブ"}</div>
            <div className={`px-4 py-3 rounded-lg bg-slate-700/60 border ${negHighlight}`}>😢/😠/😮 {q.neg_label || "ネガティブ"}</div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={decideByFace} disabled={permission !== "granted" || liveGuess === "wait" || answered} className="px-4 py-2 rounded-lg bg-emerald-600 disabled:opacity-50">
              表情で判定
            </button>
            <button onClick={() => { setSel("pos"); setAnswered(true); }} disabled={answered} className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 hover:border-slate-400">
              代替：ポジ
            </button>
            <button onClick={() => { setSel("neg"); setAnswered(true); }} disabled={answered} className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 hover:border-slate-400">
              代替：ネガ
            </button>
            {answered && (
              <button onClick={next} className="px-3 py-2 rounded-lg bg-sky-600">次の問題</button>
            )}
          </div>

          {answered && (
            <div className="mt-4">
              {correct ? (
                <div className="text-green-400 font-semibold">正解！</div>
              ) : (
                <div className="text-red-400 font-semibold">不正解… 正解は {q.polarity === "pos" ? "ポジティブ" : "ネガティブ"}</div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-400 mt-3">※ コツ：ネガは「眉を下げる/目を細める/口を強く結ぶ」か「口を大きく開ける」。困ったらニュートラル基準を記録→しきい値を微調整。</div>
        </div>

        {/* 右：カメラとメーター */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">カメラ</div>
            <div className="flex gap-2">
              {permission !== "granted" ? (
                <button onClick={start} className="px-3 py-1.5 rounded-lg bg-emerald-600">カメラON</button>
              ) : (
                <button onClick={stop} className="px-3 py-1.5 rounded-lg bg-slate-600">停止</button>
              )}
              <button onClick={calibrateNeutral} className="px-3 py-1.5 rounded-lg bg-indigo-600">ニュートラル基準を記録</button>
            </div>
          </div>
          {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

          <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" muted playsInline />

          <div className="mt-4 grid gap-2 text-sm">
            <div>😊 笑顔度: <span className="font-mono">{scores.smile.toFixed(2)}</span></div>
            <div>😢 悲しみ（口角下げ）: <span className="font-mono">{scores.frown.toFixed(2)}</span></div>
            <div>😠 しかめ合成: <span className="font-mono">{(0.35 * scores.browDown + 0.25 * scores.eyeSquint + 0.2 * scores.mouthPress + 0.2 * scores.noseSneer).toFixed(2)}</span></div>
            <div>😮 口を開く合成: <span className="font-mono">{(0.6 * scores.jawOpen + 0.2 * scores.mouthLowerDown + 0.2 * scores.mouthUpperUp).toFixed(2)}</span></div>
            <div>ネガ採用値（max）: <span className="font-mono">{Math.max(
              scores.frown,
              0.35 * scores.browDown + 0.25 * scores.eyeSquint + 0.2 * scores.mouthPress + 0.2 * scores.noseSneer,
              0.6 * scores.jawOpen + 0.2 * scores.mouthLowerDown + 0.2 * scores.mouthUpperUp
            ).toFixed(2)}</span></div>
            <div>しきい値：<span className="font-mono">±{th.toFixed(2)}</span></div>
            <input type="range" min={0.05} max={0.4} step={0.01} value={th} onChange={(e) => setTh(parseFloat(e.target.value))} className="w-full" />
            <div>推定：{{ pos: "ポジ", neg: "ネガ", wait: "…判定中" }[liveGuess]}</div>
            <div className="text-slate-400">※ 0.5秒以上 同じ表情が続くと自動で確定します</div>
          </div>
        </div>
      </div>
    </div>
  );
}
