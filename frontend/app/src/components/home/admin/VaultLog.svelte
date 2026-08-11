<script lang="ts">
    import type { OpenChat, VaultLogEntry } from "@client";
    import { Row } from "component-lib";
    import { getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Input from "../../Input.svelte";
    import Select from "../../Select.svelte";

    const client = getContext<OpenChat>("client");

    const PAGE_SIZE = 100;

    let bucketCanisterId = $state("");
    let buckets: string[] = $state([]);
    let entries: VaultLogEntry[] = $state([]);
    let total = $state<bigint | undefined>(undefined);
    let busy = $state(false);
    let error = $state<string | undefined>(undefined);

    onMount(() => {
        client.vaultBuckets().then((b) => {
            buckets = b;
            if (bucketCanisterId === "" && b.length > 0) {
                bucketCanisterId = b[0];
            }
        });
    });

    // The vault access log is readable only by designated vault reviewers: the chain of
    // custody evidence. prev_hash of each entry is the hash of the one before it, so the
    // chain can be verified externally.
    // The bucket whose entries are currently loaded: loadMore must page the SAME bucket even
    // if the select has since changed, or entries from two buckets (with clashing per-bucket
    // indexes) end up interleaved in one list
    let loadedCanisterId = $state("");

    function load() {
        const canisterId = bucketCanisterId.trim();
        if (canisterId === "" || busy) return;
        busy = true;
        error = undefined;
        entries = [];
        total = undefined;
        loadedCanisterId = canisterId;
        client
            .vaultLog(canisterId, 0n, PAGE_SIZE, undefined)
            .then((resp) => {
                if (resp.kind === "success") {
                    entries = resp.entries;
                    total = resp.total;
                } else {
                    error = "Not authorized - the vault log is readable by vault reviewers only";
                }
            })
            .catch(() => (error = "Failed to fetch the vault log"))
            .finally(() => (busy = false));
    }

    function loadMore() {
        if (busy || total === undefined || BigInt(entries.length) >= total) return;
        busy = true;
        error = undefined;
        client
            .vaultLog(loadedCanisterId, BigInt(entries.length), PAGE_SIZE, undefined)
            .then((resp) => {
                if (resp.kind === "success") {
                    entries = [...entries, ...resp.entries];
                    total = resp.total;
                } else {
                    error = "Not authorized - the vault log is readable by vault reviewers only";
                }
            })
            .catch(() => (error = "Failed to fetch more of the vault log"))
            .finally(() => (busy = false));
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
                <Select bind:value={bucketCanisterId}>
                    {#each buckets as bucket (bucket)}
                        <option value={bucket}>{bucket}</option>
                    {/each}
                </Select>
            {:else}
                <Input bind:value={bucketCanisterId} />
            {/if}
        </div>
        <Button
            tiny
            disabled={busy || bucketCanisterId.trim() === ""}
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
                        <td class="hash" title={entry.prevHash}>{entry.prevHash.slice(0, 12)}…</td>
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
