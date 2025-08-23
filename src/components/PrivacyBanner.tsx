import { useState } from "react";

const KEY = "kogoto.privacyAck";
export default function PrivacyBanner() {
  const [ok, setOk] = useState(() => localStorage.getItem(KEY) === "true");
  if (ok) return null;
  return (
    <div className="mb-4 p-3 rounded-xl border border-slate-600 bg-slate-800 text-slate-100">
      <div className="text-sm">
        このアプリは <b>音声（マイク）や表情（カメラ）</b> を使います。<br />
        データは <b>端末内（ブラウザ）にのみ保存</b> され、サーバへ送信しません。
      </div>
      <div className="mt-2">
        <button
          onClick={() => { localStorage.setItem(KEY, "true"); setOk(true); }}
          className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500"
        >
          OK
        </button>
      </div>
    </div>
  );
}
