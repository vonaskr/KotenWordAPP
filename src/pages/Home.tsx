import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">古典単語アプリ（体験版）</h1>
      <p className="text-slate-300">学び方で2つのモードを用意しました。どちらからでも始められます。</p>
      <p className="bg-primary-50 text-primary-700 shadow-card rounded-xl p-3
">test</p>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold mb-2">① 表情でネガ/ポジ</h2>
          <p className="text-sm text-slate-400 mb-3">笑顔=ポジ / 悲しい顔=ネガ で2択回答（後でカメラ対応）。今はボタンで動作確認します。</p>
          <Link className="inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500" to="/mood">はじめる</Link>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <h2 className="font-semibold mb-2">② 音声で4択</h2>
          <p className="text-sm text-slate-400 mb-3">読み上げ→3,2,1→発話で回答（後で音声認識を追加）。今はクリックで確認します。</p>
          <Link className="inline-block px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500" to="/voice">はじめる</Link>
        </div>
      </div>
    </div>
  );
}

