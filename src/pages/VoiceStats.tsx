import { useEffect, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";
import { listStats, topWrong, resetStats } from "../utils/store";
import { Link } from "react-router-dom";

export default function VoiceStats() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<"wrong" | "all">("wrong");

  useEffect(() => {
    (async () => {
      const data = await loadVocab();
      setItems(data);
      setRows(topWrong(data, 200));
    })();
  }, []);

  function loadAll() { setRows(listStats(items).sort((a, b) => b.total - a.total)); }
  function loadWrong() { setRows(topWrong(items, 200)); }

  useEffect(() => { tab === "all" ? loadAll() : loadWrong(); }, [tab, items]);

  return (
    <div className="w-full max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-3">間違えリスト & 統計</h1>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setTab("wrong")} className={`px-3 py-1.5 rounded ${tab === "wrong" ? "bg-indigo-600" : "bg-slate-700 hover:bg-slate-600"}`}>間違いが多い順</button>
        <button onClick={() => setTab("all")} className={`px-3 py-1.5 rounded ${tab === "all" ? "bg-indigo-600" : "bg-slate-700 hover:bg-slate-600"}`}>全単語</button>
        <Link to="/voice/session?mode=missed" className="ml-auto px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500">間違いだけで復習</Link>
        <button onClick={() => { if (confirm("統計をリセットしますか？")) { resetStats(); loadWrong(); loadAll(); } }} className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600">統計をリセット</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-3 py-2">単語</th>
              <th className="px-3 py-2">読み</th>
              <th className="px-3 py-2 text-right">正解</th>
              <th className="px-3 py-2 text-right">不正解</th>
              <th className="px-3 py-2 text-right">計</th>
              <th className="px-3 py-2 text-right">正答率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="odd:bg-slate-900/40">
                <td className="px-3 py-2">{r.word}</td>
                <td className="px-3 py-2">{r.reading || ""}</td>
                <td className="px-3 py-2 text-right">{r.correct}</td>
                <td className="px-3 py-2 text-right text-rose-300">{r.wrong}</td>
                <td className="px-3 py-2 text-right">{r.total}</td>
                <td className="px-3 py-2 text-right">{r.total ? Math.round(r.acc * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Link to="/voice" className="px-3 py-1.5 rounded bg-slate-600 hover:bg-slate-500">戻る</Link>
      </div>
    </div>
  );
}
