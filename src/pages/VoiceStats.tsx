import { useEffect, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";
import { listStats, topWrong, resetStats } from "../utils/store";
import { Link } from "react-router-dom";

export default function VoiceStats() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [onlyWrong, setOnlyWrong] = useState(true); // 既定で「誤答ありのみ」
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"wrong"|"acc"|"total"|"correct">("wrong");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  useEffect(() => {
    (async () => {
      const data = await loadVocab();
      setItems(data);
      setRows(topWrong(data, 200));
    })();
  }, []);

  function loadAll() { setRows(listStats(items).sort((a, b) => b.total - a.total)); }
  function loadWrong() { setRows(topWrong(items, 200)); }

  // 検索・フィルタ・並べ替えの適用（単一テーブル）
  useEffect(() => {
  // もとデータ：全語
  let base = listStats(items);
  // フィルタ：「誤答ありのみ」
  if (onlyWrong) base = base.filter((r:any) => (r.wrong || 0) > 0);

  // 検索（単語・読み）
  const q = query.trim();
  if (q) {
    const lower = q.toLowerCase();
    base = base.filter((r:any) =>
      String(r.word||"").toLowerCase().includes(lower) ||
      String(r.reading||"").toLowerCase().includes(lower)
    );
  }

  // 並べ替え
  base.sort((a:any,b:any) => {
    const key = sortKey;
    let av = a[key], bv = b[key];
    // 正答率は tie-breaker に total を使って安定化
    if (key === "acc") {
      if (bv !== av) return (bv - av);
      return (b.total - a.total);
    }
    return (bv - av);
  });
    if (sortDir === "asc") base.reverse();
    setRows(base);
   }, [items, onlyWrong, query, sortKey, sortDir]);

  return (
    <div className="w-full max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-3">間違えリスト & 統計</h1>
      <div className="mb-3 flex items-center gap-2">

        <label className="ml-2 text-sm inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyWrong}
            onChange={(e)=>setOnlyWrong(e.target.checked)}
          />
          誤答がある語のみ
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/voice/session?mode=missed" className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500">間違いだけで復習</Link>
          <button onClick={()=>{ if(confirm("統計をリセットしますか？")) { resetStats(); location.reload(); }}} className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600">統計をリセット</button>
        </div>
      </div>

      {/* 検索・並べ替えツールバー */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="単語や読みで検索"
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 w-60"
        />
        <div className="text-xs text-slate-400">
          並べ替え：{sortKey}（{sortDir}）
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-3 py-2">単語</th>
              <th className="px-3 py-2">読み</th>
              <th className="px-3 py-2 text-right">
                <button
                  onClick={() => setSortKey(prev => (sortKey==="correct" && sortDir==="desc") ? (setSortDir("asc"), "correct") : (setSortDir("desc"), "correct"))}
                  className="hover:underline"
                  title="正解数で並べ替え"
                >
                  正解 {sortKey==="correct" ? (sortDir==="desc"?"↓":"↑") : ""}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  onClick={() => setSortKey(prev => (sortKey==="wrong" && sortDir==="desc") ? (setSortDir("asc"), "wrong") : (setSortDir("desc"), "wrong"))}
                  className="hover:underline"
                  title="不正解数で並べ替え"
                >
                  不正解 {sortKey==="wrong" ? (sortDir==="desc"?"↓":"↑") : ""}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  onClick={() => setSortKey(prev => (sortKey==="total" && sortDir==="desc") ? (setSortDir("asc"), "total") : (setSortDir("desc"), "total"))}
                  className="hover:underline"
                  title="出題回数で並べ替え"
                >
                  計 {sortKey==="total" ? (sortDir==="desc"?"↓":"↑") : ""}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  onClick={() => setSortKey(prev => (sortKey==="acc" && sortDir==="desc") ? (setSortDir("asc"), "acc") : (setSortDir("desc"), "acc"))}
                  className="hover:underline"
                  title="正答率で並べ替え"
                >
                  正答率 {sortKey==="acc" ? (sortDir==="desc"?"↓":"↑") : ""}
                </button>
              </th>
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
