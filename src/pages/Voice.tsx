import { useEffect, useMemo, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";

export default function Voice() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null); // 1..4
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadVocab();
        setItems(data);
      } catch (e: any) {
        setErr(e?.message ?? "読み込みエラー");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = items[0]; // まずは1問
  const choices = useMemo(() => (q ? [q.choice1, q.choice2, q.choice3, q.choice4] : []), [q]);
  const correctIdx = useMemo(() => (q ? Number(q.correct) : 0), [q]);

  if (loading) return <div className="p-6 text-lg">読み込み中…</div>;
  if (err) return <div className="p-6 text-red-600">エラー：{err}</div>;
  if (!q) return <div className="p-6">問題がありません（vocab.csv を確認）</div>;

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-1">音声4択（いまはクリックでテスト）</h1>
      <p className="text-slate-300 mb-6">後で読み上げ・リズム・音声認識を追加します。</p>

      <div className="bg-slate-800 rounded-xl p-5 mb-5 border border-slate-700">
        <div className="text-sm text-slate-400">第1問</div>
        <div className="text-3xl font-semibold my-2">{q.word}</div>
        {q.reading && <div className="text-slate-400 mb-4">（{q.reading}）</div>}

        <div className="grid grid-cols-1 gap-3">
          {choices.map((c, i) => {
            const idx = i + 1;
            const isSelected = selected === idx;
            const isCorrect = answered && idx === correctIdx;
            const isWrong = answered && isSelected && idx !== correctIdx;

            return (
              <button
                key={idx}
                disabled={answered}
                onClick={() => { setSelected(idx); setAnswered(true); }}
                className={[
                  "w-full text-left px-4 py-3 rounded-lg border transition",
                  isCorrect
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

        {answered && (
          <div className="mt-4">
            {selected === correctIdx ? (
              <div className="text-green-400 font-semibold">正解！</div>
            ) : (
              <div className="text-red-400 font-semibold">不正解… 正解は ({correctIdx}) です</div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400">データ元：<code>/public/vocab.csv</code></div>
    </div>
  );
}
