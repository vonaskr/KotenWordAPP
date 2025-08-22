import type { VocabItem } from "../types";

// 超シンプルCSVパーサ（フィールド内にカンマが無い前提）
function parseSimpleCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

export async function loadVocab(): Promise<VocabItem[]> {
  const res = await fetch("/vocab.csv", { cache: "no-store" });
  if (!res.ok) throw new Error("vocab.csv を読み込めませんでした");
  const text = await res.text();
  const rows = parseSimpleCsv(text);
  return rows
    .filter(
      (r) =>
        r.word &&
        r.choice1 &&
        r.choice2 &&
        r.choice3 &&
        r.choice4 &&
        r.correct
    )
    .map((r) => ({
      id: r.id ?? "",
      word: r.word ?? "",
      reading: r.reading ?? "",
      polarity: (r.polarity as VocabItem["polarity"]) ?? "",
      pos_label: r.pos_label ?? "",
      neg_label: r.neg_label ?? "",
      choice1: r.choice1 ?? "",
      choice2: r.choice2 ?? "",
      choice3: r.choice3 ?? "",
      choice4: r.choice4 ?? "",
      correct: (r.correct as VocabItem["correct"]) ?? "1",
      aliases: r.aliases ?? "",
    }));
}
  
// import type { VocabItem } from "../types";

// /** 超シンプルCSVパーサ（ダブルクオートやカンマ埋め込みは未対応） */
// function parseSimpleCsv(text: string): Record<string, string>[] {
//   const lines = text.trim().split(/\r?\n/).filter(Boolean);
//   const headers = lines[0].split(",").map(h => h.trim());
//   return lines.slice(1).map(line => {
//     const cells = line.split(","); // ← フィールドにカンマが無い前提
//     const row: Record<string, string> = {};
//     headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
//     return row;
//   });
// }

// export async function loadVocab(): Promise<VocabItem[]> {
//   const res = await fetch("/vocab.csv", { cache: "no-store" });
//   if (!res.ok) throw new Error("vocab.csv を読み込めませんでした");
//   const text = await res.text();
//   const rows = parseSimpleCsv(text);
//   // 必須キーがある行だけ返す
//   return rows
//     .filter(r => r.word && r.choice1 && r.choice2 && r.choice3 && r.choice4 && r.correct)
//     .map(r => ({
//       id: r.id ?? "",
//       word: r.word ?? "",
//       reading: r.reading ?? "",
//       polarity: (r.polarity as VocabItem["polarity"]) ?? "",
//       choice1: r.choice1 ?? "",
//       choice2: r.choice2 ?? "",
//       choice3: r.choice3 ?? "",
//       choice4: r.choice4 ?? "",
//       correct: (r.correct as VocabItem["correct"]) ?? "1",
//       aliases: r.aliases ?? ""
//     }));
// }
