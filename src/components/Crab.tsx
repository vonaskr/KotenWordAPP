// src/components/Crab.tsx
import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

type Props = { walking?: boolean; comboTier?: number };

export default function Crab({ walking = false, comboTier = 0 }: Props) {
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

  // デバッグ（コンソールから叩けるように）
  useEffect(() => {
    (window as any).crab = {
      correct: () => onCorrect?.fire(),
      wrong: () => onWrong?.fire(),
      walk: (v: boolean) => { if (isWalking) isWalking.value = v; },
      tier: (v: number) => { if (tier) tier.value = v; },
    };
  }, [onCorrect, onWrong, isWalking, tier]);

  return <RiveComponent className="w-full max-w-[320px] h-[240px]" />;
}
