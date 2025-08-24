// /src/pages/VoiceResult.tsx
import { Link, useLocation } from "react-router-dom";
import Crab from "../components/Crab";
import { getWallet } from "../utils/store";

type ResultState = {
  total: number;
  correct: number;
  score: number;
  maxStreak: number;
  mode: "all10" | "missed";
  walletGain?: number; // ← 追加
};

export default function VoiceResult() {
  const loc = useLocation();
  const s = (loc.state || {}) as Partial<ResultState>;

  const gain = Number(s.walletGain || 0);
  const total = Number(s.total || 0);
  const correct = Number(s.correct || 0);
  const acc = total > 0 ? correct / total : 0;
  const trig: 'correct' | 'wrong' = acc >= 0.6 ? 'correct' : 'wrong';

  const score = s.score ?? 0;
  const maxStreak = s.maxStreak ?? 0;
  
  const ratio = total > 0 ? correct / total : 0;
  const title = ratio >= 0.9 ? "いとめでたし！" : ratio >= 0.6 ? "よきかな" : "むげなり";
  return (
    <div className="w-full max-w-xl p-6">
      {/* リアクション基準：90%以上 → 大喜び、60%以上 → 小喜び、それ未満 → しょんぼり */}
      <h1 className="text-2xl font-bold mb-3">結果</h1>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="text-lg text-slate-200 mb-1">{title}</div>
        <div className="text-4xl font-extrabold mb-2">{score}</div>
        <div className="text-slate-200 mb-1">正答数：{correct} / {total}</div>
        <div className="text-slate-400 text-sm">最大連続：{maxStreak}</div>
      </div>
      
      <Crab
        comboTier={acc >= 0.9 ? 2 : acc >= 0.6 ? 1 : 0}
        trigger={trig}
        triggerKey={Date.now()}
      />
      <div className="mt-6 grid gap-3">
        <Link to="/voice/session?mode=all10" className="block text-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500">もう一度 </Link>
        <Link to="/voice/session?mode=missed" className="block text-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">間違いだけで復習</Link>
        <Link to="/voice" className="block text-center px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500">メインに戻る</Link>
      </div>

      <div className="mt-3 p-3 rounded-lg border border-emerald-700/40 bg-emerald-900/10">
      <div className="text-emerald-300 font-semibold">今回の獲得 +{gain} pt</div>
      <div className="text-slate-300 text-sm">
        ウォレット残高：{getWallet()} pt（カニにあげると友好ゲージが伸びます）
      </div>
      <div className="mt-2">
        <Link to="/crab" className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white">
          カニにエサをあげに行く
        </Link>
      </div>
    </div>

    </div>
  );
}