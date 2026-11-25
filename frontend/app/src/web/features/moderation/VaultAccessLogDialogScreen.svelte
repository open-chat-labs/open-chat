<!-- The vault access log of a moderation report's media (L6c), from its card: who quarantined,
     viewed and decided, in order of time, every page of it (logic/moderation's VaultAccessLog, as
     the old VaultAccessLog). Readable by designated vault reviewers only: anyone else gets the
     failure line.
     TODO(design): the design has no access log; DialogShell with the old dialog's words. -->
<script lang="ts">
    import { allUsersStore, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import { VaultAccessLog } from "@src/logic/moderation/vaultAccessLog.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "vault_access_log" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    const accessLog = new VaultAccessLog(client, dialog.blobReferences);

    onMount(() => {
        void accessLog.load();
    });
</script>

<DialogShell title={$_("vaultLog.title")} width={520} height="auto" {onClose}>
    {#if accessLog.loading}
        <p class="text">{$_("vaultLog.loading")}</p>
    {:else if accessLog.failed}
        <p class="text error">{$_("vaultLog.failed")}</p>
    {:else if accessLog.entries.length === 0}
        <p class="text">{$_("vaultLog.empty")}</p>
    {:else}
        <ol class="entries">
            {#each accessLog.entries as entry (`${entry.canisterId}-${entry.index}`)}
                <li class="entry">
                    <span class="time">{new Date(Number(entry.timestamp)).toLocaleString()}</span>
                    <span class="text">
                        {entry.event}
                        {#if entry.userId !== undefined}
                            ({$allUsersStore.get(entry.userId)?.username ??
                                $_("vaultLog.unknownUser")})
                        {/if}
                    </span>
                </li>
            {/each}
        </ol>
    {/if}
    <div class="actions">
        <Button label={$_("vaultViewer.close")} variant="secondary" onClick={onClose} />
    </div>
</DialogShell>

<style lang="scss">
    .entries {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        margin: 0 0 var(--space-16);
        padding: 0;
        list-style: none;
    }

    .entry {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    .time {
        font: var(--weight-regular) var(--text-xs) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .text {
        margin: 0 0 var(--space-16);
        font: var(--weight-regular) var(--text-base) / 1.45 var(--font-sans);
        color: var(--ink-2);

        .entry & {
            margin: 0;
        }
    }

    .error {
        color: var(--status-danger);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
    }
</style>
