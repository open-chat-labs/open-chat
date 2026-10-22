<!-- The dialogs the client's bus events ask for (app/src/logic/appEvents): a link to something that
     doesn't exist, can't be seen, or isn't available in this version of the app. Closing goes away
     from it, as the old UI's NotFound / NoAccess modals did. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { dismissedRoute } from "@src/logic/appEvents/appEvents";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "./dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "app_event" }>> = $props();

    const client = getContext<OpenChat>("client");

    function close() {
        onClose();
        navigate(dismissedRoute(client));
    }

    // the old UI's words; the not-found one was never translated
    const copy = $derived.by(() => {
        switch (dialog.event.kind) {
            case "not_found":
                return { title: "Page not found", text: undefined };
            case "no_access":
                return { title: $_("noAccess"), text: $_("noAccessText") };
            case "restricted_content":
                return {
                    title: $_("appStore.notAvailableTitle"),
                    text: $_("appStore.notAvailable"),
                };
        }
    });
</script>

<!-- TODO(design): no not-found, no-access or not-available dialog in the design -->
<DialogShell title={copy.title} onClose={close}>
    {#if copy.text !== undefined}
        <div class="text">
            <Markdown text={copy.text} inline={false} />
        </div>
    {/if}
    <div class="actions">
        <Button label={$_("goHome")} onClick={close} />
    </div>
</DialogShell>

<style>
    .text {
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        margin-block-start: var(--space-16);
    }
</style>
