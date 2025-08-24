import { useEffect, useRef } from "react";
import { useRive } from "@rive-app/react-canvas";
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
  const lastTriggerRef = useRef<{ t: Props["trigger"]; k: number }>({
    t: null,
    k: 0,
  });
  lastTriggerRef.current = { t: trigger, k: triggerKey };

  const { rive, RiveComponent } = useRive({
    src: crabFile,
    artboard: "Crab",
    stateMachines: "CrabMachine",
    autoplay: true, // State Machine を再生開始
  });

  // ==== 最新の Input を毎回取り直す ====
  function getInput(name: "onCorrect" | "onWrong" | "isWalking" | "comboTier") {
    try {
      const list = rive?.stateMachineInputs("CrabMachine") || [];
      return list.find((i: any) => i?.name === name) ?? null;
    } catch {
      return null;
    }
  }

  // ==== Inputs が現れるまで待つ（最大 waitMs）====
  async function waitForInputs(waitMs = 4000) {
    const start = performance.now();
    return new Promise<boolean>((resolve) => {
      const tick = () => {
        const ok =
          !!getInput("onCorrect") &&
          !!getInput("onWrong"); // 必須2種が出たらOK
        if (ok) return resolve(true);
        if (performance.now() - start > waitMs) return resolve(false);
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  // ==== Trigger/Bool どちらでも発火 ====
  function fireInput(input: any) {
    if (!input) return false;
    if (typeof input.fire === "function") {
      input.fire(); // Trigger
      return true;
    }
    try {
      input.value = true; // Bool fallback
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

  // ==== 最終手段：State Machine を一時停止してアニメ直接再生 → idle → SM復帰 ====
  function playTimelineDirect(which: "correct" | "wrong") {
    try {
      const anim = which === "correct" ? "correct_small" : "wrong";
      // 1) SM 一時停止
      try {
        rive?.pause("CrabMachine");
      } catch {}
      // 2) タイムライン再生
      rive?.reset();
      rive?.play(anim);
      // 3) 少し後に idle
      setTimeout(() => {
        try {
          rive?.play("idle");
        } catch {}
      }, 900);
      // 4) 最後に SM 復帰
      setTimeout(() => {
        try {
          rive?.play("CrabMachine");
        } catch {}
      }, 1000);
    } catch {}
  }

  // ==== 反応本体 ====
  function fire(which: "correct" | "wrong") {
    const input = getInput(which === "correct" ? "onCorrect" : "onWrong");
    const ok = fireInput(input);
    // 取りこぼし保険：少し遅らせて直接再生
    setTimeout(() => playTimelineDirect(which), ok ? 80 : 0);
    if (!ok) playTimelineDirect(which);
  }

  // ==== 外部状態（歩行・ティア）反映 ====
  useEffect(() => {
    const inp = getInput("isWalking");
    if (inp) {
      try {
        inp.value = !!walking;
      } catch {}
    }
  }, [walking, rive]);

  useEffect(() => {
    const inp = getInput("comboTier");
    if (inp) {
      try {
        inp.value = Number(comboTier) || 0;
      } catch {}
    }
  }, [comboTier, rive]);

  // ==== 結果画面マウント時に必ず一度発火（Inputs を待ってから） ====
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!rive || !trigger) return;
      // Inputsが現れるまで待つ
      const ok = await waitForInputs(4000);
      console.log("[CRAB ready?]", ok, {
        hasOnCorrect: !!getInput("onCorrect"),
        hasOnWrong: !!getInput("onWrong"),
      });
      if (canceled) return;
      fire(trigger);
    })();
    return () => {
      canceled = true;
    };
    // triggerKey を依存に含める：画面を開き直したとき毎回反応
  }, [rive, trigger, triggerKey]);

  // デバッグ：Input名のログ（ロード後に一度出る）
  useEffect(() => {
    if (!rive) return;
    try {
      const ins = rive.stateMachineInputs("CrabMachine") || [];
      console.log("[RIVE] inputs:", ins.map((i: any) => i.name));
    } catch {}
  }, [rive]);

  // コンソール操作用（あなたの手動確認用）
  useEffect(() => {
    (window as any).crab = {
      correct: () => fire("correct"),
      wrong: () => fire("wrong"),
      walk: (v: boolean) => {
        const i = getInput("isWalking");
        if (i) i.value = v;
      },
      tier: (v: number) => {
        const i = getInput("comboTier");
        if (i) i.value = v;
      },
    };
  }, [rive]);

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <RiveComponent className="w-full h-[240px] border border-slate-600 rounded-md bg-slate-900/40 select-none pointer-events-none" />
      <div className="mt-1 text-xs text-slate-400 text-center">
        {rive ? "Rive OK" : "Loading..."}
      </div>
    </div>
  );
}
