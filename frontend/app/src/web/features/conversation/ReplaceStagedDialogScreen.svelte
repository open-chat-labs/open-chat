<!-- Asking before something takes a staged prize, transfer or swap offer's place in the draft
     (replaceNeedsConfirm, logic/composer/replaceStaged): what's staged, what would take its place,
     then Cancel or Replace. Replace opens another builder in this dialog's place over the same
     backdrop (DialogStack.handOff, as the user card's Suspend user), or attaches the file or GIF
     held back and closes; Cancel, × and the backdrop keep what's staged.
     TODO(design): the design has no such confirm; ConfirmDialog, as Delete message's. -->
<script lang="ts">
    import { interpolate } from "@src/i18n/i18n";
    import { replaceQuestionText } from "@src/logic/composer/replaceStaged";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import ConfirmDialog from "./ConfirmDialog.svelte";

    let {
        dialog,
        onClose,
        dialogs,
    }: DialogProps<Extract<LocalDialog, { kind: "replace_staged" }>> = $props();

    const text = $derived(replaceQuestionText(dialog.question));

    // the builder keeps this dialog's backdrop, the theme's scrim as its own is, so it doesn't
    // change under the hand-off (nor under the swap offer's confirmation, its scrim too)
    function replace() {
        const next = dialog.next;
        if (next.kind === "open") {
            dialogs.handOff(dialog, next.dialog, "scrim");
        } else {
            onClose();
            next.attach();
        }
    }
</script>

<ConfirmDialog
    title={interpolate($_, text.title)}
    message={interpolate($_, text.message)}
    confirmLabel={$_("builders.replace.confirm")}
    onConfirm={replace}
    {onClose} />
