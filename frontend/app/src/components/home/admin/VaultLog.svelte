<script lang="ts">
    import type { OpenChat } from "@client";
    import { Row } from "component-lib";
    import { getContext, onMount } from "svelte";
    import { VaultLog, shortHash } from "../../../logic/admin/vaultLog.svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Select from "../../Select.svelte";

    const client = getContext<OpenChat>("client");
    const log = new VaultLog(client);

    let buckets = $derived(log.buckets);
    let entries = $derived(log.entries);
    let total = $derived(log.total);
    let busy = $derived(log.busy);
    let error = $derived(log.error);

    onMount(() => {
        void log.loadBuckets();
    });

    function load() {
        void log.load();
    }

    function loadMore() {
        void log.loadMore();
    }
</script>

<div class="vault-log">
    <div class="hint">
        The tamper-evident access log of a storage bucket's evidence vault: every quarantine,
        review, verdict and destruction, with each entry chained to the previous by hash. The bucket
        is selected automatically; paste a canister id if it is not listed.
    </div>
    <Row crossAxisAlignment="center" gap="md">
        <div class="canisterId">
            {#if buckets.length > 1}
                <Select bind:value={log.bucketCanisterId}>
                    {#each buckets as bucket (bucket)}
                        <option value={bucket}>{bucket}</option>
                    {/each}
                </Select>
            {:else}
                <Input bind:value={log.bucketCanisterId} />
            {/if}
        </div>
        <Button
            tiny
            disabled={busy || log.bucketCanisterId.trim() === ""}
            loading={busy}
            onClick={load}
        >
            Load
        </Button>
    </Row>

    {#if total !== undefined}
        <div class="summary">{total} entries</div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Prev hash</th>
                </tr>
            </thead>
            <tbody>
                {#each entries as entry (entry.index)}
                    <tr>
                        <td>{entry.index}</td>
                        <td>{new Date(Number(entry.timestamp)).toLocaleString()}</td>
                        <td>{entry.event}</td>
                        <td class="hash" title={entry.prevHash}>{shortHash(entry.prevHash)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if BigInt(entries.length) < total}
            <Button tiny disabled={busy} loading={busy} onClick={loadMore}>Load more</Button>
        {/if}
    {/if}

    {#if error !== undefined}
        <ErrorMessage>{error}</ErrorMessage>
    {/if}
</div>

<style lang="scss">
    .canisterId {
        flex: 1;
    }
    .vault-log {
        flex: auto;
        @include nice-scrollbar();
        padding: $sp4;
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }
    .hint {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
    .summary {
        @include font(bold, normal, fs-90);
    }
    table {
        border-collapse: collapse;
        width: 100%;
        @include font(book, normal, fs-80);

        th,
        td {
            text-align: left;
            padding: $sp2 $sp3;
            border-bottom: var(--bw) solid var(--bd);
        }
    }
    .hash {
        font-family: monospace;
    }
</style>
