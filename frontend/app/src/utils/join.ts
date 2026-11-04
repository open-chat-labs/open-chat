import { publish } from "@client";
import type { JoinStep } from "@src/logic/join/joinFlow.svelte";
import { toastStore } from "@src/stores/toast";

/**
 * What the old desktop and mobile trees do with a join's next step (logic/join), as
 * utils/preview.svelte.ts did: the gates' evaluator (mobile opens its sliding page on the event;
 * desktop's overlay follows the flow's `gatesToEvaluate`), a failure toast. The gates the backend
 * found unmet show from the flow's `gateCheckFailed`.
 */
export function showJoinStep(step: JoinStep, level: "group" | "community"): void {
    switch (step.kind) {
        case "evaluate_gates":
            publish(level === "group" ? "evaluateGroupAccessGate" : "evaluateCommunityAccessGate");
            break;
        case "failed":
            toastStore.showFailureToast(step.message);
            break;
        case "joined":
        case "not_sent":
        case "gate_check_failed":
        case "cancelled":
            break;
        default:
            step satisfies never;
    }
}
