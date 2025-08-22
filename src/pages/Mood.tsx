import { useEffect, useMemo, useState } from "react";
import { loadVocab } from "../utils/loadVocab";
import type { VocabItem } from "../types";

function pickMoodItem(pool: VocabItem[]): VocabItem | null {
  const list = pool.filter((x) => x.polarity === "pos" || x.polarity === "neg");
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export default function Mood() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [q, setQ] = useState<VocabItem | null>(null);
  const [sel, setSel] = useState<"pos" | "neg" | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await loadVocab();
      setItems(data);
      setQ(pickMoodItem(data));
    })();
  }, []);

  const isCorrect = useMemo(() => sel && q ? sel === q.polarity : null, [sel, q]);

  if (!q) return <div>問題を読み込み中…またはネガポジ対象の行がありません。</div>;

  return (
    <div className="grid gap-4">
      <div className="text-sm text-slate-400">表情ネガポジ（いまはボタンでテスト）</div>
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div className="text-2xl font-semibold">{q.word}</div>
        {q.reading && <div className="text-slate-400 mb-4">（{q.reading}）</div>}

        <div className="grid md:grid-cols-2 gap-3">
          <button
            disabled={answered}
            onClick={() => { setSel("pos"); setAnswered(true); }}
            className={["px-4 py-3 rounded-lg border transition text-left",
              answered && q.polarity === "pos" ? "bg-green-600/20 border-green-500" : "bg-slate-700/60 border-slate-600 hover:border-slate-400"
            ].join(" ")}
          >
            😊 {q.pos_label || "ポジティブ"}
          </button>

          <button
            disabled={answered}
            onClick={() => { setSel("neg"); setAnswered(true); }}
            className={["px-4 py-3 rounded-lg border transition text-left",
              answered && q.polarity === "neg" ? "bg-green-600/20 border-green-500" : "bg-slate-700/60 border-slate-600 hover:border-slate-400"
            ].join(" ")}
          >
            😢 {q.neg_label || "ネガティブ"}
          </button>
        </div>

        {answered && (
          <div className="mt-4">
            {isCorrect ? (
              <div className="text-green-400 font-semibold">正解！</div>
            ) : (
              <div className="text-red-400 font-semibold">不正解… {q.polarity === "pos" ? "ポジティブ" : "ネガティブ"} が正解</div>
            )}
            <button
              className="mt-3 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500"
              onClick={() => { setAnswered(false); setSel(null); setQ(pickMoodItem(items)); }}
            >次の問題</button>
          </div>
        )}

        <div className="text-xs text-slate-400 mt-3">※ 後でカメラ表情判定に差し替えます（笑顔=ポジ/悲しい=ネガ）。</div>
      </div>
    </div>
  );
}
