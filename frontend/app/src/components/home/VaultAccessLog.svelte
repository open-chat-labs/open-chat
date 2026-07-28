<script lang="ts">
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

    let entries: VaultLogEntry[] = $state([]);
    let failed = $state(false);
    let loading = $state(true);

    // The vault access-log entries for this report's media: who quarantined, viewed and
    // decided, in order. Readable by designated vault reviewers only.
    onMount(() => {
        Promise.all(
            blobReferences.map((ref) =>
                client.vaultLog(ref.canisterId, 0n, 200, ref.blobId).then((resp) => {
                    if (resp.kind !== "success") throw new Error(resp.kind);
                    return resp.entries;
                }),
            ),
        )
            .then((pages) => {
                entries = pages.flat().sort((a, b) => Number(a.index - b.index));
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
                    {#each entries as entry (entry.index)}
                        <div class="entry">
                            <div class="time">
                                {new Date(Number(entry.timestamp)).toLocaleString()}
                            </div>
                            <div>
                                {entry.event}
                                {#if entry.userId !== undefined}
                                    ({$allUsersStore.get(entry.userId)?.username ?? "unknown user"})
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
