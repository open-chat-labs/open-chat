<script lang="ts">
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
    onMount(() => {
        Promise.all(
            blobReferences.map((ref) =>
                client.vaultLog(ref.canisterId, 0n, 200, ref.blobId).then((resp) => {
                    if (resp.kind !== "success") throw new Error(resp.kind);
                    return resp.entries.map((e) => ({ ...e, canisterId: ref.canisterId }));
                }),
            ),
        )
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
                            ({$allUsersStore.get(entry.userId)?.username ?? "unknown user"})
                        {/if}
                    </Body>
                </Column>
            {/each}
        {/if}
    </Column>
</Sheet>
