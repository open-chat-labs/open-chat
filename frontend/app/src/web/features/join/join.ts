import { i18nKey, type OpenChat } from "@client";
import {
    joinTargetName,
    startJoin,
    type JoinStep,
    type JoinTarget,
} from "@src/logic/join/joinFlow.svelte";
import { toastStore } from "@src/stores/toast";
import type { DialogStack } from "../../shell/dialogStack.svelte";
import type { LocalDialog } from "../app/dialogs";

// Joining in the web tree (8b): the preview bar's Join, `?autojoin` and a guest's join replayed
// after sign-in all come here. The flow is logic/join's; this is what the web tree shows for each
// step.

/**
 * What the web tree shows for a join's next step: the requirements in the join gate dialog (in
 * place of one already open), "You joined …", or why it failed. A guest's join opens sign-in by
 * itself (the client moves the identity state to logging_in), and a dismissed PIN prompt says
 * nothing.
 */
export function showJoinStep(
    step: JoinStep,
    target: JoinTarget,
    dialogs: DialogStack<LocalDialog>,
): void {
    switch (step.kind) {
        case "evaluate_gates":
            dialogs.replace(
                { kind: "join_gate", target, gates: step.gates },
                (open) => open.kind === "join_gate",
            );
            break;
        case "joined":
            toastStore.showSuccessToast(i18nKey("access.joined", { name: joinTargetName(target) }));
            break;
        case "gate_check_failed":
            // TODO(design): which gates weren't met (the old AccessGateCheckFailed); GAPS.md
            toastStore.showFailureToast(i18nKey("access.gateCheckFailed"));
            break;
        case "failed":
            toastStore.showFailureToast(step.message);
            break;
        case "not_sent":
        case "cancelled":
            break;
        default:
            step satisfies never;
    }
}

/** Joins a group, channel or community, and shows what comes of it. */
export async function join(
    client: Pick<OpenChat, "joinGroup" | "joinCommunity">,
    target: JoinTarget,
    dialogs: DialogStack<LocalDialog>,
): Promise<void> {
    showJoinStep(await startJoin(client, target), target, dialogs);
}
