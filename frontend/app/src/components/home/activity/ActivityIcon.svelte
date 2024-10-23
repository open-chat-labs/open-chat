<script lang="ts">
    import type { MessageActivity } from "openchat-client";
    import Bitcoin from "../../icons/Bitcoin.svelte";
    import EmoticonLolOutline from "svelte-material-icons/EmoticonLolOutline.svelte";
    import ReplyOutline from "svelte-material-icons/ReplyOutline.svelte";
    import At from "svelte-material-icons/At.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";

    export let activity: MessageActivity;

    let color = "var(--button-txt)";
</script>

<div class="icon">
    {#if activity === "tip" || activity == "crypto"}
        <Bitcoin size={"1.1em"} {color} />
    {:else if activity === "reaction"}
        <EmoticonLolOutline size={"1.1em"} {color} />
    {:else if activity === "quote_reply"}
        <ReplyOutline size={"1.1em"} {color} />
    {:else if activity === "mention"}
        <At size={"1.1em"} {color} />
    {:else if activity === "poll_vote"}
        <Poll size={"1.1em"} {color} />
    {:else if activity === "p2p_swap_accepted"}
        <SwapIcon size={"1.1em"} {color} />
    {/if}
</div>

<style lang="scss">
    .icon {
        display: flex;
        justify-content: center;
        align-items: center;
        position: absolute;
        bottom: -2px;
        left: -2px;
        border-radius: 50%;
        width: 1.3em;
        height: 1.3em;
        background-color: var(--button-bg);
    }
</style>
