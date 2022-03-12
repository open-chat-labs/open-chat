<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CryptocurrencyContent } from "../../domain/chat/chat";
    import { E8S_PER_ICP } from "../../domain/user/user";
    import Markdown from "./Markdown.svelte";
    import ChevronDoubleRight from "svelte-material-icons/ChevronDoubleRight.svelte";
    import ChevronDoubleLeft from "svelte-material-icons/ChevronDoubleLeft.svelte";
    import { iconSize } from "stores/iconSize";

    export let content: CryptocurrencyContent;
    export let me: boolean = false;
    export let reply: boolean = false;

    let amount =
        content.transfer.kind === "completed_icp_transfer" ||
        content.transfer.kind === "pending_icp_transfer"
            ? Number(content.transfer.amountE8s) / E8S_PER_ICP
            : 0;
</script>

{#if content.transfer.kind === "completed_icp_transfer"}
    <div class="message">
        {#if me}
            <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
            {$_("icpTransfer.confirmedSent", { values: { amount: amount.toFixed(4) } })}
            <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
        {:else}
            <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {$_("icpTransfer.confirmedReceived", { values: { amount: amount.toFixed(4) } })}
            <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
        {/if}
    </div>
    <div class="link">
        <Markdown
            text={$_("icpTransfer.viewTransaction", {
                values: {
                    url: `https://dashboard.internetcomputer.org/transaction/${content.transfer.transactionHash.join()}`,
                },
            })}
            inline={!reply} />
    </div>
{:else if content.transfer.kind === "pending_icp_transfer"}
    <div class="message">
        {#if me}
            <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
            {$_("icpTransfer.pendingSent", { values: { amount: amount.toFixed(4) } })}
            <ChevronDoubleLeft size={$iconSize} color={"#fff"} />
        {:else}
            <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
            {$_("icpTransfer.pendingReceived", { values: { amount: amount.toFixed(4) } })}
            <ChevronDoubleRight size={$iconSize} color={"var(--icon-txt)"} />
        {/if}
    </div>
{:else}
    <div class="unexpected">{$_("icpTransfer.unexpected")}</div>
{/if}

{#if content.caption !== undefined}
    <Markdown text={content.caption} inline={!reply} />
{/if}

<style type="text/scss">
    .unexpected {
        @include font(light, italic, fs-90);
    }

    .link {
        margin-bottom: $sp3;
    }

    .message {
        margin-bottom: $sp3;
        display: flex;
        align-items: center;
    }
</style>
