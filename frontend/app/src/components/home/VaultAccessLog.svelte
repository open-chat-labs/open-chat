<script lang="ts">
    import { _ } from "svelte-i18n";
    import { allUsersStore, type BlobReference, type OpenChat } from "@client";
    import { VaultAccessLog } from "@src/logic/moderation/vaultAccessLog.svelte";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        blobReferences: BlobReference[];
        onClose: () => void;
    }

    let { blobReferences, onClose }: Props = $props();

    // The paging and ordering are logic/moderation's (vaultAccessLog), shared with the other
    // tree's dialog and the new web UI's
    const accessLog = new VaultAccessLog(client, blobReferences);

    onMount(() => {
        void accessLog.load();
    });
</script>

<Overlay {onClose} dismissible>
    <ModalContent {onClose}>
        {#snippet header()}
            <Translatable resourceKey={i18nKey("vaultLog.title")} />
        {/snippet}
        {#snippet body()}
            {#if accessLog.loading}
                <p><Translatable resourceKey={i18nKey("vaultLog.loading")} /></p>
            {:else if accessLog.failed}
                <p><Translatable resourceKey={i18nKey("vaultLog.failed")} /></p>
            {:else if accessLog.entries.length === 0}
                <p><Translatable resourceKey={i18nKey("vaultLog.empty")} /></p>
            {:else}
                <div class="entries">
                    {#each accessLog.entries as entry (`${entry.canisterId}-${entry.index}`)}
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
