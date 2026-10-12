<script lang="ts">
    import { communityPreviewState } from "@src/utils/preview.svelte";
    import { Sheet } from "component-lib";
    import type { OpenChat } from "@client";
    import { getContext, type Snippet } from "svelte";
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";

    type ChildProps = [boolean, () => void, () => void, boolean];

    interface Props {
        children?: Snippet<ChildProps>;
    }

    let { children }: Props = $props();

    const client = getContext<OpenChat>("client");
</script>

{#if communityPreviewState.gateCheckFailed.length > 0}
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
