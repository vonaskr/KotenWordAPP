// /src/pages/VoiceResult.tsx
import { Link, useLocation } from "react-router-dom";

type ResultState = {
  total: number;
  correct: number;
  score: number;
  maxStreak: number;
  mode: "all10" | "missed";
};

export default function VoiceResult() {
  const loc = useLocation();
  const s = (loc.state || {}) as Partial<ResultState>;

  const total = s.total ?? 0;
  const correct = s.correct ?? 0;
  const score = s.score ?? 0;
  const maxStreak = s.maxStreak ?? 0;
  const mode = (s.mode as any) ?? "all10";
  const ratio = total > 0 ? correct / total : 0;
  const title = ratio >= 0.9 ? "いとめでたし！" : ratio >= 0.6 ? "よきかな" : "むげなり";

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-3">結果</h1>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="text-lg text-slate-200 mb-1">{title}</div>
        <div className="text-4xl font-extrabold mb-2">{score}</div>
        <div className="text-slate-200 mb-1">正答数：{correct} / {total}</div>
        <div className="text-slate-400 text-sm">最大連続：{maxStreak}</div>
      </div>

      <div className="mt-6 grid gap-3">
        <Link to="/voice/session?mode=all10" className="block text-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500">もう一度 </Link>
        <Link to="/voice/session?mode=missed" className="block text-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">間違いだけで復習</Link>
        <Link to="/voice" className="block text-center px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500">メインに戻る</Link>
      </div>
    </div>
  );
}