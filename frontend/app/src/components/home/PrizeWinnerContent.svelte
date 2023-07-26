<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import type { OpenChat, PrizeWinnerContent } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import CkBtcSmall from "../icons/CkBtcSmall.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");
    const user = client.user;

    export let content: PrizeWinnerContent;

    $: userStore = client.userStore;
    $: symbol = content.transaction.token;
    $: amount = client.formatTokens(content.transaction.amountE8s, 0);
    $: winner = `${username(content.transaction.recipient)}`;
    $: transactionLinkText = client.buildTransactionLink($_, content.transaction);

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
    <div class="graphic">
        <img class="lid" src={"../assets/lid.png"} />
        <div class="winner-coin">
            <CkBtcSmall />
        </div>
        <img class="box" src={"../assets/box.png"} />
    </div>
    <div class="label">
        <Markdown
            text={$_("prizes.winner", { values: { recipient: winner, amount, token: symbol } })}
            oneLine={true}
            suppressLinks={true} />
    </div>
    {#if transactionLinkText !== undefined}
        <div class="link">
            <Markdown text={transactionLinkText} />
        </div>
    {/if}
</div>

<style lang="scss">
    .msg {
        cursor: pointer;
        text-align: center;
    }

    .label {
        @include font(book, normal, fs-100, 28);
    }

    .link {
        @include font(book, normal, fs-80, 28);
        color: var(--txt-light);
    }

    .graphic {
        display: flex;
        flex-direction: column;
        padding: 10px 60px;

        .winner-coin {
            margin-top: -45px;
            margin-bottom: -34px;
            align-self: center;
            animation: bob 3s linear infinite;
        }

        .lid {
            width: 90px;
            height: auto;
            align-self: flex-end;
            position: relative;
            animation: weave 3s linear infinite;
            z-index: 3;
        }

        .box {
            width: 130px;
            height: auto;
            align-self: center;
        }
    }

    @keyframes bob {
        0% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-8px);
        }
        100% {
            transform: translateY(0);
        }
    }

    @keyframes weave {
        0% {
            transform: translateX(2px) translateY(0);
        }
        50% {
            transform: translateX(8px) translateY(-5px);
        }
        100% {
            transform: translateX(2px) translateY(0);
        }
    }
</style>
