<script lang="ts">
    import type { AccessGate, MultiUserChat, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccessGateIcon from "./AccessGateIcon.svelte";

    // this is going to work out which access gates are in effect in the current context and show the
    // icon for each one

    const client = getContext<OpenChat>("client");

    export let chat: MultiUserChat;

    $: community = chat.kind === "channel" ? client.getCommunityForChannel(chat.id) : undefined;
    $: chatGate = chat.gate;
    $: communityGate = (community?.gate ?? { kind: "no_gate" }) as AccessGate;
    $: showCommunityGate = communityGate.kind !== "no_gate";
    $: showChatGate = chatGate.kind !== "no_gate";
</script>

<div class="icons">
    {#if showCommunityGate}
        <AccessGateIcon clickable level={"community"} gate={communityGate} />
        {#if showChatGate}
            <span>&</span>
        {/if}
    {/if}
    {#if showChatGate}
        <AccessGateIcon clickable level={chat.level} gate={chatGate} />
    {/if}
</div>

<style lang="scss">
    .icons {
        display: flex;
        gap: $sp3;
        align-items: center;
    }
</style>
