// /src/pages/VoiceHub.tsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { counts } from "../utils/store";

export default function VoiceHub() {
  const [c, setC] = useState({ correct: 0, wrong: 0 });
  useEffect(() => { setC(counts()); }, []);

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-2">音声4択クイズ</h1>
      <p className="text-slate-300 mb-6">モードを選んでください。</p>

      <div className="grid gap-4">
        <Link to="/voice/session?mode=all10" className="block bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl text-center">
          10問連続出題（ランダム）
        </Link>
        <Link to="/voice/session?mode=missed" className="block bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl text-center">
          間違えた問題のみ出題
        </Link>
      </div>

      <div className="mt-6 text-slate-400 text-sm">
        【現在の学習状況】正解した問題：<b>{c.correct}</b> 件 / 間違えた問題：<b>{c.wrong}</b> 件
      </div>
    </div>
  );
}