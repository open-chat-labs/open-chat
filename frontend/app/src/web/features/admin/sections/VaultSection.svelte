<!-- Vault log: a storage bucket's tamper-evident evidence vault access log, 100 entries at a time.
     The bucket is picked from those listed (a select when there are several) or pasted, then
     loaded; the log is a table with Load more. Only vault reviewers may read it. -->
<script lang="ts">
    import type { VaultLogEntry } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DataTable from "@openchat/ui/src/lib/components/DataTable.svelte";
    import SelectInput from "@openchat/ui/src/lib/components/SelectInput.svelte";
    import SettingsCard from "@openchat/ui/src/lib/components/SettingsCard.svelte";
    import TextInput from "@openchat/ui/src/lib/components/TextInput.svelte";
    import { principalProblem } from "@src/logic/admin/fieldChecks";
    import { shortHash } from "@src/logic/admin/vaultLog.svelte";
    import { onMount } from "svelte";
    import type { AdminConsole } from "../adminConsole.svelte";

    interface Props {
        admin: AdminConsole;
    }

    let { admin }: Props = $props();

    const log = $derived(admin.vault);
    onMount(() => void log.loadBuckets());

    const COLUMNS = [
        { key: "index", label: "#", width: "72px" },
        { key: "time", label: "Time", width: "200px", nowrap: true },
        { key: "event", label: "Event" },
        { key: "hash", label: "Prev hash", width: "140px" },
    ];

    const tableState = $derived(
        log.total === undefined
            ? log.busy
                ? "loading"
                : log.error !== undefined
                  ? "error"
                  : undefined
            : log.entries.length === 0
              ? "empty"
              : "ready",
    );
</script>

<SettingsCard
    title="Storage bucket"
    help="The bucket is picked for you; paste a canister id if it isn’t listed."
    icon="lock"
    outcome={log.busy
        ? { kind: "busy", text: "Loading…" }
        : log.error !== undefined && log.total !== undefined
          ? { kind: "failed", text: log.error }
          : undefined}>
    {#if log.buckets.length > 1}
        <SelectInput
            value={log.bucketCanisterId}
            options={log.buckets.map((b) => ({ value: b, label: b }))}
            ariaLabel="Bucket"
            mono
            onChange={(v) => (log.bucketCanisterId = v)} />
    {:else}
        <TextInput
            value={log.bucketCanisterId}
            placeholder="Bucket canister id"
            mono
            paste
            copy
            error={principalProblem(log.bucketCanisterId)}
            onInput={(v) => (log.bucketCanisterId = v)} />
    {/if}
    {#snippet actions()}
        <Button
            label="Load"
            busy={log.busy}
            disabled={!log.canLoad}
            onClick={() => void log.load()} />
    {/snippet}
</SettingsCard>

{#if tableState !== undefined}
    <DataTable
        title="Entries"
        count={log.total === undefined ? undefined : String(log.total)}
        columns={COLUMNS}
        rows={log.entries}
        rowKey={(e: VaultLogEntry) => String(e.index)}
        state={tableState}
        emptyTitle="No entries"
        emptyBody="Nothing has been vaulted in this bucket."
        errorTitle="Couldn’t load the log"
        errorBody={log.error ?? ""}
        onRetry={() => void log.load()}
        minWidth={720}
        footer={log.hasMore ? more : undefined}>
        {#snippet cell(e: VaultLogEntry, key: string)}
            {#if key === "index"}
                <span class="mono">{e.index}</span>
            {:else if key === "time"}
                {new Date(Number(e.timestamp)).toLocaleString()}
            {:else if key === "event"}
                {e.event}
            {:else if key === "hash"}
                <span class="mono hash" title={e.prevHash}>{shortHash(e.prevHash)}</span>
            {/if}
        {/snippet}
    </DataTable>
{/if}

{#snippet more()}
    <Button
        label="Load more"
        variant="secondary"
        busy={log.busy}
        disabled={log.busy}
        onClick={() => void log.loadMore()} />
{/snippet}

<style lang="scss">
    .mono {
        font-family: var(--font-mono);
    }

    .hash {
        color: var(--ink-3);
    }
</style>
