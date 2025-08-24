// src/components/Crab.tsx
import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import crabFile from '../assets/crab.riv?url';  // ← 追加（Vite の ?url で実ファイルURLになる）

type Props = {
   walking?: boolean;
   comboTier?: number;
   trigger?: 'correct' | 'wrong' | 'levelUp' | null;
   triggerKey?: number; // 値が変わったら毎回発火させるためのノンス
};
export default function Crab({
    walking = false,
    comboTier = 0,
    trigger = null,
    triggerKey = 0,
  }: Props) {
  const { rive, RiveComponent } = useRive({
    src: crabFile, 
    artboard: 'Crab',               // ← RiveのArtboard名を明示
    stateMachines: 'CrabMachine',   // ← State Machine名を明示
    autoplay: true,
    onLoad: () => console.log('[RIVE] loaded .riv / artboard / machine'),
  });
 const onCorrect  = useStateMachineInput(rive, 'CrabMachine', 'onCorrect');
  const onWrong    = useStateMachineInput(rive, 'CrabMachine', 'onWrong');
  const isWalking  = useStateMachineInput(rive, 'CrabMachine', 'isWalking');
  const tier       = useStateMachineInput(rive, 'CrabMachine', 'comboTier'); // Rive側に無ければ null

  // 外部状態を反映
  useEffect(() => { if (isWalking) isWalking.value = walking; }, [walking, isWalking]);
  useEffect(() => { if (tier) tier.value = comboTier; }, [comboTier, tier]);


  // 反応トリガー（親からの合図で一度だけ発火）
  //  - rive/load直後の取りこぼしに備えて最大20回リトライ
  //  - Trigger/Bool どちらでも発火
  //  - どちらも無理なら「アニメ名」を直接再生（フォールバック）
  useEffect(() => {
    if (!rive || !trigger) return;
    let cancelled = false;
    let tries = 0;

    const fireInput = (input: any) => {
      if (!input) return false;
      if (typeof input.fire === "function") {
        input.fire();                      // Trigger
        return true;
      }
      try {
        input.value = true;                // Bool fallback
        setTimeout(() => { try { input.value = false; } catch {} }, 80);
        return true;
      } catch { return false; }
    };

    const fallbackPlay = () => {
      try {
        const anim = trigger === "correct" ? "correct_small" : "wrong";
        rive.reset();
        rive.play(anim);
        setTimeout(() => { try { rive.play("idle"); } catch {} }, 1000);
      } catch {}
    };

    const attempt = () => {
      if (cancelled || !rive) return;
      const input = trigger === "correct" ? onCorrect : onWrong;
      const ok = fireInput(input);
      if (ok) return;
      if (tries < 20) setTimeout(attempt, 50);
      else fallbackPlay();
    };

    // 1tick遅らせてから開始（ロード直後対策）
    requestAnimationFrame(() => setTimeout(attempt, 0));
    return () => { cancelled = true; };
  }, [rive, trigger, triggerKey, onCorrect, onWrong]);



  // デバッグ（コンソールから叩けるように）
  useEffect(() => {
    (window as any).crab = {
      correct: () => onCorrect?.fire(),
      wrong: () => onWrong?.fire(),
      walk: (v: boolean) => { if (isWalking) isWalking.value = v; },
      tier: (v: number) => { if (tier) tier.value = v; },
    };
  }, [onCorrect, onWrong, isWalking, tier]);

  useEffect(() => {
    if (!rive) return;
    try {
        // 取得できる Input 名をログ（スペル確認用）
        const ins = rive.stateMachineInputs('CrabMachine') || [];
        console.log('[RIVE] inputs:', ins.map((i:any)=>i.name));
      } catch {}
  }, [rive]);

  return (
  <div className="mx-auto w-full max-w-[340px]">
    <RiveComponent className="w-full h-[240px] border border-slate-600 rounded-md bg-slate-900/40 select-none pointer-events-none" />
    <div className="mt-1 text-xs text-slate-400 text-center">
      {rive ? 'Rive OK' : 'Loading...'} / inputs:
      {' '}
      {String(!!onCorrect)} {String(!!onWrong)} {String(!!isWalking)} {String(!!tier)}
    </div>
  </div>
  );
}
