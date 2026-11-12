<!-- Suspend user from someone's card (UserDialogScreen): the suspend dialog in the card's place
     over the same backdrop, its back arrow handing back to the card the same way
     (DialogStack.handOff). ×, the backdrop and Esc close it, with nothing to go back to. -->
<script lang="ts">
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import SuspendUserDialog from "./SuspendUserDialog.svelte";

    let {
        dialog,
        onClose,
        dialogs,
    }: DialogProps<Extract<LocalDialog, { kind: "suspend_user" }>> = $props();
</script>

<SuspendUserDialog
    userId={dialog.userId}
    {onClose}
    onBack={() => dialogs.handOff(dialog, dialog.card)} />
