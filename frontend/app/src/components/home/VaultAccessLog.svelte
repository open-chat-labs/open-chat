<script lang="ts">
    import { _ } from "svelte-i18n";
    import { allUsersStore, type BlobReference, type OpenChat, type VaultLogEntry } from "@client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
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

<Overlay {onClose} dismissible>
    <ModalContent {onClose}>
        {#snippet header()}
            <Translatable resourceKey={i18nKey("vaultLog.title")} />
        {/snippet}
        {#snippet body()}
            {#if loading}
                <p><Translatable resourceKey={i18nKey("vaultLog.loading")} /></p>
            {:else if failed}
                <p><Translatable resourceKey={i18nKey("vaultLog.failed")} /></p>
            {:else if entries.length === 0}
                <p><Translatable resourceKey={i18nKey("vaultLog.empty")} /></p>
            {:else}
                <div class="entries">
                    {#each entries as entry (`${entry.canisterId}-${entry.index}`)}
                        <div class="entry">
                            <div class="time">
                                {new Date(Number(entry.timestamp)).toLocaleString()}
                            </div>
                            <div>
                                {entry.event}
                                {#if entry.userId !== undefined}
                                    ({$allUsersStore.get(entry.userId)?.username ?? $_("vaultLog.unknownUser")})
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/snippet}
        {#snippet footer()}
            <ButtonGroup>
                <Button secondary small onClick={onClose}>
                    <Translatable resourceKey={i18nKey("vaultViewer.close")} />
                </Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .entries {
        display: flex;
        flex-direction: column;
        gap: $sp3;
    }
    .entry .time {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
</style>
