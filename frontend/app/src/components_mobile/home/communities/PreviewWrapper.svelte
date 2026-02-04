<script lang="ts">
    import { communityPreviewState } from "@src/utils/preview.svelte";
    import { Sheet } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { identityStateStore } from "openchat-client";
    import { getContext, tick, type Snippet } from "svelte";
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";

    type ChildProps = [boolean, () => void, () => void, boolean];

    interface Props {
        children?: Snippet<ChildProps>;
    }

    let { children }: Props = $props();

    const client = getContext<OpenChat>("client");

    $effect(() => {
        if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "join_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => communityPreviewState.joinCommunity(client));
        }
    });
</script>

{#if communityPreviewState.gateCheckFailed}
    <Sheet onDismiss={() => communityPreviewState.reset()}>
        <GateCheckFailed onClose={() => communityPreviewState.reset()} />
    </Sheet>
{/if}

{@render children?.(
    communityPreviewState.joining,
    () => communityPreviewState.joinCommunity(client),
    () => communityPreviewState.cancelPreview(client),
    communityPreviewState.gatesInEffect,
)}
