import { useEffect, useState } from "react";
import { getVoiceSettings, saveVoiceSettings, type VoiceSettings } from "../utils/store";

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [s, setS] = useState<VoiceSettings>(() => getVoiceSettings());

  useEffect(() => { if (open) setS(getVoiceSettings()); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">設定</h2>

        <div className="space-y-4">
          <div>
            <div className="text-slate-300 mb-2">出題数</div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input type="radio" name="qcnt" checked={s.questionCount === 5} onChange={() => setS({
                  ...s, questionCount: 5
                })}
                />
                <span>5問</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="qcnt" checked={s.questionCount === 10} onChange={() => setS({
                  ...s, questionCount:
                    10
                })}
                />
                <span>10問</span>
              </label>
            </div>
          </div>

          <div>
            <div className="text-slate-300 mb-2">自動で次へ（後で有効化）</div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={s.autoAdvance} onChange={(e) => setS({
                ...s, autoAdvance: e.target.checked
              })}
              />
              <span>ON（待ち時間 {Math.round(s.autoDelayMs / 1000)}秒）</span>
            </label>
            {/* ここでは保存のみ。次ステップで挙動を反映 */}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500">キャンセル</button>
          <button onClick={() => { saveVoiceSettings(s); onClose(); }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}