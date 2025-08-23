import { useEffect, useState } from "react";
import Crab from "../components/Crab";
import FriendBadge from "../components/FriendBadge";
import { getFriend, addFriendPoints, getWallet, spendWallet } from "../utils/store";

export default function CrabHub() {
  const [wallet, setWallet] = useState(getWallet());
  const [amt, setAmt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onUpd = () => setWallet(getWallet());
    window.addEventListener("wallet:update", onUpd);
    window.addEventListener("friend:update", onUpd);
    return () => {
      window.removeEventListener("wallet:update", onUpd);
      window.removeEventListener("friend:update", onUpd);
    };
  }, []);

  function feed() {
    if (amt <= 0) return;
    const { spent } = spendWallet(amt);
    if (spent > 0) {
      addFriendPoints(spent); // 将来 leveledUp 使うなら res = addFriendPoints(...) に
      setToast(`エサ ${spent} pt をあげた！`);
      setTimeout(() => setToast(null), 1200);
      // leveledUp を使って Rive の levelUp を fire する拡張も可
    }
    setAmt(0);
  }

  const fv = getFriend();

  return (
    <div className="w-full max-w-xl p-6">
      <h1 className="text-2xl font-bold mb-2">カニとあそぶ</h1>

      <div className="mb-2">
        <Crab trigger={null} triggerKey={fv.total} comboTier={fv.level >= 5 ? 2 : fv.level >= 3 ? 1 : 0} />
      </div>

      <FriendBadge />

      <div className="mb-4 p-3 rounded-lg border border-slate-700 bg-slate-800/70">
        <div className="flex items-center justify-between">
          <div className="text-slate-200">ウォレット残高</div>
          <div className="text-emerald-300 font-semibold">{wallet} pt</div>
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={wallet}
            value={amt}
            onChange={(e) => setAmt(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-sm text-slate-300">あげる量：{amt} pt</div>
          <div className="mt-2 flex gap-2">
            {[10, 50, 100].map(v => (
              <button key={v} disabled={wallet < v} onClick={() => setAmt(v)}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                {v}
              </button>
            ))}
            <button disabled={wallet <= 0} onClick={feed}
              className="ml-auto px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
              カニにあげる
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-slate-100 border border-slate-700 px-3 py-2 rounded-lg shadow">
          {toast}
        </div>
      )}
    </div>
  );
}
