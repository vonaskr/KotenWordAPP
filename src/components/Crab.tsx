import { useEffect, useRef } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import crabFile from "../assets/crab.riv?url";

type Props = {
  walking?: boolean;
  comboTier?: number;
  /** 正答なら "correct"、誤答なら "wrong"。null で何もしない */
  trigger?: "correct" | "wrong" | null;
  /** 値が変わるたびに反応させるためのノンス（結果画面を開くたびにユニークでOK） */
  triggerKey?: number;
};

export default function Crab({
  walking = false,
  comboTier = 0,
  trigger = null,
  triggerKey = 0,
}: Props) {
  // 直近のトリガーを保持（onLoad直後に使う）
  const lastTriggerRef = useRef<{ t: Props["trigger"]; k: number }>({
    t: null,
    k: 0,
  });
  lastTriggerRef.current = { t: trigger, k: triggerKey };

  const { rive, RiveComponent } = useRive({
    src: crabFile,
    artboard: "Crab",
    stateMachines: "CrabMachine",
    autoplay: true,
    onLoad: () => {
      // 読み込み直後に直近のトリガーを一度発火（取りこぼし防止）
      try {
        const t = lastTriggerRef.current.t;
        if (t) queueMicrotask(() => fire(t));
      } catch {}
    },
  });

  const onCorrect = useStateMachineInput(rive, "CrabMachine", "onCorrect");
  const onWrong = useStateMachineInput(rive, "CrabMachine", "onWrong");
  const isWalking = useStateMachineInput(rive, "CrabMachine", "isWalking");
  const tier = useStateMachineInput(rive, "CrabMachine", "comboTier");

  // 外部状態の反映
  useEffect(() => {
    if (isWalking) isWalking.value = walking;
  }, [walking, isWalking]);
  useEffect(() => {
    if (tier) tier.value = comboTier;
  }, [comboTier, tier]);

  // Trigger/Bool どちらでも発火できる関数 + 最終手段の直接再生
  function fireInput(input: any) {
    if (!input) return false;
    if (typeof input.fire === "function") {
      input.fire(); // Trigger型
      return true;
    }
    try {
      // Boolフォールバック
      input.value = true;
      setTimeout(() => {
        try {
          input.value = false;
        } catch {}
      }, 80);
      return true;
    } catch {
      return false;
    }
  }
  function playFallback(which: "correct" | "wrong") {
    try {
      const anim = which === "correct" ? "correct_small" : "wrong";
      rive?.reset();
      rive?.play(anim);
      setTimeout(() => {
        try {
          rive?.play("idle");
        } catch {}
      }, 1000);
    } catch {}
  }
  function fire(which: "correct" | "wrong") {
    const ok = fireInput(which === "correct" ? onCorrect : onWrong);
    if (!ok) playFallback(which);
  }

  // propsの変化/キーの変化で必ず発火（ロード直後対策にリトライあり）
  useEffect(() => {
    if (!rive || !trigger) return;
    let tries = 0,
      canceled = false;

    const attempt = () => {
      if (canceled) return;
      const ok = fireInput(trigger === "correct" ? onCorrect : onWrong);
      if (ok) return;
      if (tries++ < 20) setTimeout(attempt, 50);
      else playFallback(trigger);
    };

    requestAnimationFrame(() => setTimeout(attempt, 0));
    return () => {
      canceled = true;
    };
  }, [rive, trigger, triggerKey, onCorrect, onWrong]);

  // デバッグ：利用可能な入力名をログ
  useEffect(() => {
    if (!rive) return;
    try {
      const ins = rive.stateMachineInputs("CrabMachine") || [];
      console.log("[RIVE] inputs:", ins.map((i: any) => i.name));
    } catch {}
  }, [rive]);

  // コンソール操作用
  useEffect(() => {
    (window as any).crab = {
      correct: () => fire("correct"),
      wrong: () => fire("wrong"),
      walk: (v: boolean) => {
        if (isWalking) isWalking.value = v;
      },
      tier: (v: number) => {
        if (tier) tier.value = v;
      },
    };
  }, [onCorrect, onWrong, isWalking, tier]);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <RiveComponent className="w-full h-[240px] border border-slate-600 rounded-md bg-slate-900/40 select-none pointer-events-none" />
      <div className="mt-1 text-xs text-slate-400 text-center">
        {rive ? "Rive OK" : "Loading..."} / inputs:{" "}
        {String(!!onCorrect)} {String(!!onWrong)} {String(!!isWalking)}{" "}
        {String(!!tier)}
      </div>
    </div>
  );
}
