export type VocabItem = {
  id: string;
  word: string;
  reading: string;
  polarity: "pos" | "neg" | "";
  pos_label: string; // 機能①のポジ側ラベル（例: 裕福）
  neg_label: string; // 機能①のネガ側ラベル（例: 貧しい）
  choice1: string;
  choice2: string;
  choice3: string;
  choice4: string;
  correct: "1" | "2" | "3" | "4"; // 1..4 文字
  aliases?: string; // ";"区切り
  hint?: string;   // 例文/シノニム
};