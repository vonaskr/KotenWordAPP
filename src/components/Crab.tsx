import { useEffect } from "react";
import { useRive } from "@rive-app/react-canvas";
import crabFile from "../assets/crab.riv?url";

type Props = {
  walking?: boolean;
  comboTier?: number; // 0=弱, 1=中, 2=強
  trigger?: "correct" | "wrong" | null;
  triggerKey?: number; // 変化時に必ずリアクション
};

export default function Crab({
  walking = false,
  comboTier = 0,
  trigger = null,
  triggerKey = 0,
}: Props) {
  const { rive, RiveComponent } = useRive({
    src: crabFile,
    artboard: "Crab",
    stateMachines: "CrabMachine",
    autoplay: true,
  });

  // --- 最新の SM 入力を毎回名前で取得 ---
  function getInput(name: "onCorrect" | "onWrong" | "isWalking" | "comboTier") {
    try {
      const list = rive?.stateMachineInputs("CrabMachine") || [];
      return list.find((i: any) => i?.name === name) ?? null;
    } catch {
      return null;
    }
  }

  // --- 入力が現れるまで最大 waitMs 待機 ---
  async function waitForInputs(waitMs = 4000) {
    const t0 = performance.now();
    return new Promise<boolean>((resolve) => {
      const tick = () => {
        const ok = !!getInput("onCorrect") && !!getInput("onWrong");
        if (ok) return resolve(true);
        if (performance.now() - t0 > waitMs) return resolve(false);
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  // --- Trigger/Bool どちらでも一度だけ発火。成功しなければ false ---
  function fireSM(which: "correct" | "wrong"): boolean {
    const input = getInput(which === "correct" ? "onCorrect" : "onWrong");
    if (!input) return false;
    // Trigger 型優先
    if (typeof (input as any).fire === "function") {
      try {
        (input as any).fire();
        return true;
      } catch {
        /* fallthrough */
      }
    }
    // Bool フォールバック
    try {
      (input as any).value = true;
      setTimeout(() => {
        try {
          (input as any).value = false;
        } catch { }
      }, 80);
      return true;
    } catch {
      return false;
    }
  }

  // --- 最終手段：SM を一時停止し、タイムライン名で直接再生して idle に戻す ---
  function playTimelineDirect(which: "correct" | "wrong") {
    try {
      const anim = which === "correct" ? "correct_small" : "wrong";
      try {
        rive?.pause("CrabMachine");
      } catch { }
      rive?.reset();
      rive?.play(anim);
      setTimeout(() => {
        try {
          rive?.play("idle");
        } catch { }
      }, 900);
      setTimeout(() => {
        try {
          rive?.play("CrabMachine");
        } catch { }
      }, 1000);
    } catch { }
  }

  // --- “一回分”の発火（SMが効けばSMのみ。失敗した時だけ直再生） ---
  function fireOnce(which: "correct" | "wrong") {
    const ok = fireSM(which);
    if (!ok) playTimelineDirect(which);
  }

  // --- 自然に見えるスケジュールで何回か繰り返す ---
  function scheduleReaction(which: "correct" | "wrong", opts?: { firstDelay?: number; repeats?: number; gap?: number }) {
    const firstDelay = opts?.firstDelay ?? 500; // 初回までの“間”
    const repeats = Math.max(1, Math.min(4, opts?.repeats ?? 1));
    const gap = opts?.gap ?? 650; // 2発目以降のインターバル

    // 1発目
    setTimeout(() => fireOnce(which), firstDelay);
    // 2発目以降
    for (let i = 1; i < repeats; i++) {
      setTimeout(() => fireOnce(which), firstDelay + i * gap);
    }
  }

  // --- 外部状態の反映（歩行／ティア）。無理のない範囲で更新 ---
  useEffect(() => {
    const i = getInput("isWalking");
    if (i) {
      try {
        (i as any).value = !!walking;
      } catch { }
    }
  }, [walking, rive]);

  useEffect(() => {
    const i = getInput("comboTier");
    if (i) {
      try {
        (i as any).value = Number(comboTier) || 0;
      } catch { }
    }
  }, [comboTier, rive]);

  // --- 結果画面：Inputs が現れてから、自然なタイミングで 1〜数回反応 ---
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!rive || !trigger) return;
      const ready = await waitForInputs();
      console.log("[CRAB ready?]", ready, {
        hasOnCorrect: !!getInput("onCorrect"),
        hasOnWrong: !!getInput("onWrong"),
      });
      if (canceled) return;

      // 正答率の強度（comboTier）に合わせて回数やテンポを変える
      if (trigger === "correct") {
        // tier 0: 1回 / tier 1: 2回 / tier 2+: 3回、ちょい速め
        const rep = comboTier >= 2 ? 3 : comboTier >= 1 ? 2 : 1;
        const gap = comboTier >= 2 ? 580 : 650;
        scheduleReaction("correct", { firstDelay: 520, repeats: rep, gap });
      } else {
        // wrong は 1回だけ、少し溜めてから
        scheduleReaction("wrong", { firstDelay: 560, repeats: 1 });
      }
    })();
    return () => {
      canceled = true;
    };
  }, [rive, trigger, triggerKey, comboTier]);

  // デバッグ：ロード後に一度入力名を表示
  useEffect(() => {
    if (!rive) return;
    try {
      const ins = rive.stateMachineInputs("CrabMachine") || [];
      console.log("[RIVE] inputs:", ins.map((i: any) => i.name));
    } catch { }
  }, [rive]);

  // コンソールから手動確認
  useEffect(() => {
    (window as any).crab = {
      correct: () => fireOnce("correct"),
      wrong: () => fireOnce("wrong"),
      walk: (v: boolean) => {
        const i = getInput("isWalking");
        if (i) (i as any).value = v;
      },
      tier: (v: number) => {
        const i = getInput("comboTier");
        if (i) (i as any).value = v;
      },
    };
  }, [rive]);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <RiveComponent className="w-full h-[240px] border border-slate-600 rounded-md bg-slate-900/40 select-none pointer-events-none" />
    </div>
  );
}
