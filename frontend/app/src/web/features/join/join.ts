import { i18nKey, type OpenChat } from "@client";
import {
    beginJoin,
    joinFailure,
    joinTargetName,
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
 * place of one already open, or of the rules dialog `from`, over its backdrop), "You joined …"
 * (`name`: what the user joined from, the target's own name unless given), or why it failed. A
 * guest's join opens sign-in by itself (the client moves the identity state to logging_in), and a
 * dismissed PIN prompt says nothing.
 */
export function showJoinStep(
    step: JoinStep,
    target: JoinTarget,
    dialogs: DialogStack<LocalDialog>,
    name: string = joinTargetName(target),
    from?: LocalDialog,
): void {
    switch (step.kind) {
        case "evaluate_gates": {
            const gate: LocalDialog = { kind: "join_gate", target, gates: step.gates, name };
            if (from !== undefined) dialogs.handOff(from, gate, "scrim");
            else dialogs.replace(gate, (open) => open.kind === "join_gate");
            break;
        }
        case "joined":
            toastStore.showSuccessToast(i18nKey("access.joined", { name }));
            break;
        case "gate_check_failed":
            toastStore.showFailureToast(joinFailure(step));
            break;
        case "failed":
            toastStore.showFailureToast(joinFailure(step));
            break;
        case "not_sent":
        case "cancelled":
            break;
        default:
            step satisfies never;
    }
}

/**
 * Joins a group, channel or community, and shows what comes of it (`name`: as `showJoinStep`):
 * its rules first, if it has any to agree to (the rules dialog, whose "Agree and join" carries the
 * join on), else the join's next step.
 */
export async function join(
    client: Pick<OpenChat, "joinGroup" | "joinCommunity" | "rulesToAcceptBeforeJoining">,
    target: JoinTarget,
    dialogs: DialogStack<LocalDialog>,
    name: string = joinTargetName(target),
): Promise<void> {
    const start = await beginJoin(client, target);
    if (start.kind === "agree_to_rules") {
        dialogs.replace(
            { kind: "join_rules", target, rules: start.rules, name },
            (open) => open.kind === "join_rules" || open.kind === "join_gate",
        );
        return;
    }
    showJoinStep(start, target, dialogs, name);
}
