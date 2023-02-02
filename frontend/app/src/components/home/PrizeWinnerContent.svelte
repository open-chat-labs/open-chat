<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import { cryptoLookup, OpenChat, PrizeWinnerContent } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import CkBtc from "../icons/CkBtc.svelte";

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
    <div class="graphic">
        <img class="lid" src={"../assets/lid.png"} />
        <div class="winner-coin">
            <CkBtc />
        </div>
        <img class="box" src={"../assets/box.png"} />
    </div>
    <Markdown
        text={$_("prizes.winner", { values: { recipient, amount, token: symbol } })}
        oneLine={true}
        suppressLinks={true} />
</div>

<style type="text/scss">
    :global(.winner-coin) {
        --coin-size: 5em;
        --side: #b76a06;
    }
    .msg {
        cursor: pointer;
        text-align: center;
    }

    .graphic {
        display: flex;
        flex-direction: column;
        padding: 10px 60px;

        .winner-coin {
            margin-top: -45px;
            margin-bottom: -40px;
            align-self: center;
            animation: bob 3s linear infinite;
        }

        .lid {
            width: 110px;
            height: auto;
            align-self: flex-end;
            position: relative;
            animation: weave 3s linear infinite;
            z-index: 3;
        }

        .box {
            width: 150px;
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
            transform: translateX(3px) translateY(0);
        }
        50% {
            transform: translateX(10px) translateY(-5px);
        }
        100% {
            transform: translateX(3px) translateY(0);
        }
    }
</style>
