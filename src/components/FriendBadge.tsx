import { useEffect, useState } from "react";
import { getFriend, type FriendView } from "../utils/store";

export default function FriendBadge() {
  const [fv, setFv] = useState<FriendView>(getFriend());

  useEffect(() => {
    const onUpd = () => setFv(getFriend());
    window.addEventListener("friend:update", onUpd);
    return () => window.removeEventListener("friend:update", onUpd);
  }, []);

  return (
    <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-800/70">
      <div className="flex items-end justify-between">
        <div className="text-slate-200 font-semibold">
          カニ友好レベル <span className="text-emerald-300">Lv.{fv.level}</span>
        </div>
        <div className="text-sm text-slate-300">合計 {fv.total} pt</div>
      </div>
      <div className="mt-2 h-3 rounded bg-slate-700 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${Math.round(fv.progress * 100)}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-400">次まで {fv.need - fv.cur} pt</div>
    </div>
  );
}
