<script lang="ts">
    import { _ } from "svelte-i18n";
    import { allUsersStore, type BlobReference, type OpenChat } from "@client";
    import { VaultAccessLog } from "@src/logic/moderation/vaultAccessLog.svelte";
    import { Body, BodySmall, Column, Sheet, Subtitle } from "component-lib";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
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

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("vaultLog.title")} />
        </Subtitle>
        {#if accessLog.loading}
            <Body><Translatable resourceKey={i18nKey("vaultLog.loading")} /></Body>
        {:else if accessLog.failed}
            <Body><Translatable resourceKey={i18nKey("vaultLog.failed")} /></Body>
        {:else if accessLog.entries.length === 0}
            <Body><Translatable resourceKey={i18nKey("vaultLog.empty")} /></Body>
        {:else}
            {#each accessLog.entries as entry (`${entry.canisterId}-${entry.index}`)}
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
