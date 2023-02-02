<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import { cryptoLookup, OpenChat, PrizeWinnerContent } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let content: PrizeWinnerContent;

    $: userStore = client.userStore;
    $: symbol = cryptoLookup[content.token].symbol;
    $: amount = client.formatTokens(content.amountE8s, 0);
    $: recipient = `${username(content.recipient)}`;

    function username(userId: string): string {
        return userId === user.userId
            ? $_("you")
            : `${$userStore[userId]?.username ?? $_("unknown")}`;
    }

    function zoomToMessage() {
        dispatch("goToMessageIndex", {
            index: content.prizeMessageIndex,
        });
    }
</script>

<div class="msg" on:click={zoomToMessage}>
    <Markdown
        text={$_("prizes.winner", { values: { recipient, amount, token: symbol } })}
        oneLine={true}
        suppressLinks={true} />
</div>

<style type="text/scss">
    .msg {
        margin-bottom: $sp4;
        cursor: pointer;
    }
</style>
