<!-- The operator console's Vault log tab (the old `VaultLog`): a storage bucket's tamper-evident
     evidence vault access log, a page of 100 at a time. The bucket is picked from those listed (a
     menu when there are several), or pasted. Only vault reviewers may read it. TODO(design): no
     design; a plain field and table. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import { shortHash, type VaultLog } from "@src/logic/admin/vaultLog.svelte";
    import { onMount } from "svelte";

    interface Props {
        log: VaultLog;
    }

    let { log }: Props = $props();

    onMount(() => void log.loadBuckets());
</script>

<div class="vault-log">
    <p class="admin-hint">
        The tamper-evident access log of a storage bucket's evidence vault: every quarantine,
        review, verdict and destruction, with each entry chained to the previous by hash. The bucket
        is selected automatically; paste a canister id if it is not listed.
    </p>
    <div class="admin-row">
        {#if log.buckets.length > 1}
            <select
                class="admin-input admin-mono"
                aria-label="Bucket"
                value={log.bucketCanisterId}
                onchange={(e) => (log.bucketCanisterId = e.currentTarget.value)}>
                {#each log.buckets as bucket (bucket)}
                    <option value={bucket}>{bucket}</option>
                {/each}
            </select>
        {:else}
            <input
                class="admin-input admin-mono"
                aria-label="Bucket canister id"
                value={log.bucketCanisterId}
                oninput={(e) => (log.bucketCanisterId = e.currentTarget.value)} />
        {/if}
        <Button
            label="Load"
            busy={log.busy}
            disabled={!log.canLoad}
            onClick={() => void log.load()} />
    </div>

    {#if log.total !== undefined}
        <h3 class="admin-card-title">{log.total} entries</h3>
        <table class="admin-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Prev hash</th>
                </tr>
            </thead>
            <tbody>
                {#each log.entries as entry (entry.index)}
                    <tr>
                        <td>{entry.index}</td>
                        <td>{new Date(Number(entry.timestamp)).toLocaleString()}</td>
                        <td>{entry.event}</td>
                        <td class="admin-mono" title={entry.prevHash}>{shortHash(entry.prevHash)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if log.hasMore}
            <div>
                <Button
                    label="Load more"
                    variant="secondary"
                    busy={log.busy}
                    disabled={log.busy}
                    onClick={() => void log.loadMore()} />
            </div>
        {/if}
    {/if}

    {#if log.error !== undefined}
        <p class="admin-error" role="alert">{log.error}</p>
    {/if}
</div>

<style lang="scss">
    .vault-log {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        max-width: 900px;
    }
</style>
