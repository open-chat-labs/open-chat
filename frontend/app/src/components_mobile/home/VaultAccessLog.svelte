<script lang="ts">
    import { _ } from "svelte-i18n";
    import { allUsersStore, type BlobReference, type OpenChat, type VaultLogEntry } from "@client";
    import { Body, BodySmall, Column, Sheet, Subtitle } from "component-lib";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blobReferences: BlobReference[];
        onClose: () => void;
    }

    let { blobReferences, onClose }: Props = $props();

    // Log indexes are per-bucket, so entries are keyed by (bucket, index) and ordered by time
    let entries: (VaultLogEntry & { canisterId: string })[] = $state([]);
    let failed = $state(false);
    let loading = $state(true);

    // The vault access-log entries for this report's media: who quarantined, viewed and
    // decided, in order. Readable by designated vault reviewers only.
    // A single report's chain is short, but never silently truncate custody evidence: keep
    // paging until the bucket reports no more entries for this file
    async function fetchAllPages(ref: BlobReference) {
        const acc: (VaultLogEntry & { canisterId: string })[] = [];
        // Cap defends against a misbehaving bucket reporting an inflated total: a single
        // report's chain is tiny, so hitting this means the source is lying
        const MAX_PAGES = 50;
        for (let page = 0; page < MAX_PAGES; page++) {
            const resp = await client.vaultLog(ref.canisterId, BigInt(acc.length), 200, ref.blobId);
            if (resp.kind !== "success") throw new Error(resp.kind);
            acc.push(...resp.entries.map((e) => ({ ...e, canisterId: ref.canisterId })));
            if (resp.entries.length === 0 || BigInt(acc.length) >= resp.total) return acc;
        }
        throw new Error("vault log paging did not terminate");
    }

    onMount(() => {
        Promise.all(blobReferences.map((ref) => fetchAllPages(ref)))
            .then((pages) => {
                entries = pages.flat().sort((a, b) => Number(a.timestamp - b.timestamp));
            })
            .catch(() => (failed = true))
            .finally(() => (loading = false));
    });
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("vaultLog.title")} />
        </Subtitle>
        {#if loading}
            <Body><Translatable resourceKey={i18nKey("vaultLog.loading")} /></Body>
        {:else if failed}
            <Body><Translatable resourceKey={i18nKey("vaultLog.failed")} /></Body>
        {:else if entries.length === 0}
            <Body><Translatable resourceKey={i18nKey("vaultLog.empty")} /></Body>
        {:else}
            {#each entries as entry (`${entry.canisterId}-${entry.index}`)}
                <Column gap={"xs"}>
                    <BodySmall colour={"textSecondary"}>
                        {new Date(Number(entry.timestamp)).toLocaleString()}
                    </BodySmall>
                    <Body>
                        {entry.event}
                        {#if entry.userId !== undefined}
                            ({$allUsersStore.get(entry.userId)?.username ?? $_("vaultLog.unknownUser")})
                        {/if}
                    </Body>
                </Column>
            {/each}
        {/if}
    </Column>
</Sheet>
