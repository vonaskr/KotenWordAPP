// src/components/Crab.tsx
import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

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
    src: '/crab.riv',               // public配下
    stateMachines: 'CrabMachine',
    autoplay: true,
  });

  const onCorrect = useStateMachineInput(rive, 'CrabMachine', 'onCorrect');
  const onWrong = useStateMachineInput(rive, 'CrabMachine', 'onWrong');
  const isWalking = useStateMachineInput(rive, 'CrabMachine', 'isWalking');
  const tier = useStateMachineInput(rive, 'CrabMachine', 'comboTier');

  // 外部状態を反映
  useEffect(() => { if (isWalking) isWalking.value = walking; }, [walking, isWalking]);
  useEffect(() => { if (tier) tier.value = comboTier; }, [comboTier, tier]);

  // 反応トリガー（親からの合図で一度だけ発火）
  useEffect(() => {
    if (!rive) return;
    // Rive側で onLevelUp を使うなら、StateMachine Inputs に追加してここで fire してください
    if (trigger === 'correct') onCorrect?.fire();
    else if (trigger === 'wrong') onWrong?.fire();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]); // key が変わるたびに実行

  // デバッグ（コンソールから叩けるように）
  useEffect(() => {
    (window as any).crab = {
      correct: () => onCorrect?.fire(),
      wrong: () => onWrong?.fire(),
      walk: (v: boolean) => { if (isWalking) isWalking.value = v; },
      tier: (v: number) => { if (tier) tier.value = v; },
    };
  }, [onCorrect, onWrong, isWalking, tier]);

  return (
    <RiveComponent
      className="w-full max-w-[320px] h-[240px] mx-auto select-none pointer-events-none"
    />
  );
}
