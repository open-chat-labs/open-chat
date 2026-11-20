<!-- The rules of a group, channel or community, agreed to before joining it (logic/join beginJoin: a
     channel's own rules, then its community's when the user isn't a member of that yet). "Agree and
     join" carries the join on (agreeAndJoin), and the client keeps what was agreed to for the first
     message there to accept. Requirements to meet next take this dialog's place over its backdrop
     (the join gate dialog, DialogStack.handOff); once joined it leaves, and while the join doesn't
     go through it stays, with a toast saying why. Cancel, × and the backdrop join nothing.
     TODO(design): no such dialog in the design; the pre-send RulesDialog's look. -->
<script lang="ts">
    import { type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { agreeAndJoin, joinFailure, rulesToAcceptText } from "@src/logic/join/joinFlow.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { showJoinStep } from "./join";

    let { dialog, onClose, dialogs }: DialogProps<Extract<LocalDialog, { kind: "join_rules" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const rules = $derived(rulesToAcceptText(dialog.rules));
    let joining = $state(false);

    async function agree() {
        if (joining) return;
        joining = true;
        try {
            const step = await agreeAndJoin(client, dialog.target, dialog.rules);
            switch (step.kind) {
                case "evaluate_gates":
                    showJoinStep(step, dialog.target, dialogs, dialog.name, dialog);
                    return;
                case "failed":
                case "gate_check_failed":
                    toastStore.showFailureToast(joinFailure(step));
                    return;
                case "cancelled":
                    return;
                default:
                    onClose();
                    showJoinStep(step, dialog.target, dialogs, dialog.name);
            }
        } finally {
            joining = false;
        }
    }

    function close() {
        if (!joining) onClose();
    }
</script>

<DialogShell
    title={$_("rules.joinTitle", { values: { name: dialog.name } })}
    height="auto"
    onClose={close}>
    <p class="intro">{$_("rules.joinIntro", { values: { name: dialog.name } })}</p>
    <div class="rules">
        <Markdown text={rules} inline={false} />
    </div>
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" disabled={joining} onClick={close} />
        <Button label={$_("rules.agreeAndJoin")} busy={joining} onClick={agree} />
    </div>
</DialogShell>

<style lang="scss">
    .intro {
        margin: 0 0 var(--space-12);
        font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
        color: var(--ink-3);
    }

    .rules {
        max-height: 50vh;
        overflow-y: auto;
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-16);
    }
</style>
