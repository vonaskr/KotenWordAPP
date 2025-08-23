// /src/pages/VoiceHub.tsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { counts, countReviewToday } from "../utils/store";
import SettingsModal from "../components/SettingsModal";
import { getVoiceSettings } from "../utils/store";


export default function VoiceHub() {
  const [c, setC] = useState({ correct: 0, wrong: 0 });
  const [rev, setRev] = useState(0);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(() => getVoiceSettings());
  useEffect(() => {
  setC(counts());
  setRev(countReviewToday());
  }, []);
  useEffect(() => { setSummary(getVoiceSettings()); }, [open]);

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-2">音声4択クイズ</h1>
      <p className="text-slate-300 mb-2">モードを選んでください。</p>
      {rev > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-100">
          今日の復習：<b>{rev}</b> 件
          <Link to="/voice/session?mode=missed" className="ml-2 underline">今すぐ復習する</Link>
        </div>
      )}
      <button onClick={() => setOpen(true)} className="mb-4 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600">
        ⚙️ 設定（問題数，自動送り）
      </button>
      <div className="grid gap-4">
        <Link to="/voice/session?mode=all10" className="block bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl text-center">
          通常問題
        </Link>
        <Link to="/voice/session?mode=missed" className="block bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl text-center">
          間違えた問題のみ出題
        </Link>
        <Link to="/voice/stats" className="block bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl text-center">
          間違えリスト & 統計
        </Link>
      </div>

      <div className="mt-6 text-slate-400 text-sm">
        【現在の学習状況】正解した問題：<b>{c.correct}</b> 件 / 間違えた問題：<b>{c.wrong}</b> 件
        <div className="mt-1">出題数：<b>{summary.questionCount}</b> ・ 自動で次へ：<b>{summary.autoAdvance ? "ON" : "OFF"}</b></div>
      </div>
      <SettingsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}