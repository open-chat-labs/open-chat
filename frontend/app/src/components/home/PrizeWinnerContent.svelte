<script lang="ts">
    import type { OpenChat, PrizeWinnerContent } from "openchat-client";
    import { allUsersStore, cryptoLookup, currentUserIdStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: PrizeWinnerContent;
    }

    let { content }: Props = $props();

    function username(userId: string): string {
        return userId === $currentUserIdStore
            ? $_("you")
            : `${$allUsersStore.get(userId)?.username ?? $_("unknown")}`;
    }

    function openUserProfile(ev: Event) {
        ev.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId: content.transaction.recipient,
                    chatButton: false,
                    inGlobalContext: false,
                },
                bubbles: true,
            }),
        );
        ev.stopPropagation();
    }
    let logo = $derived($cryptoLookup.get(content.transaction.ledger)?.logo ?? "");
    let tokenDetails = $derived($cryptoLookup.get(content.transaction.ledger)!);
    let symbol = $derived(tokenDetails.symbol);
    let amount = $derived(
        client.formatTokens(content.transaction.amountE8s, tokenDetails.decimals),
    );
    let winner = $derived(`${username(content.transaction.recipient)}`);
    let me = $derived($currentUserIdStore === content.transaction.recipient);
    let transactionLinkText = $derived(client.buildTransactionLink($_, content.transaction));
</script>

<div class="msg">
    <div class="wrapper" class:other={!me}>
        <div class="graphic" class:tiny={!me}>
            {#if me}
                <img class="lid" src={"/assets/lid.png"} />
                <div class="winner-coin">
                    <SpinningToken spin mirror={false} size={"small"} {logo} />
                </div>
                <img class="box" src={"/assets/box.png"} />
            {:else}
                <SpinningToken spin={false} mirror size={"tiny"} {logo} />
            {/if}
        </div>
        <div class="txt" class:other={!me}>
            <div class="label" onclick={openUserProfile}>
                <Markdown
                    text={$_("prizes.winner", {
                        values: { recipient: winner, amount, token: symbol },
                    })} />
            </div>
            {#if transactionLinkText !== undefined}
                <div class="link">
                    <Markdown text={transactionLinkText} />
                </div>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    .msg {
        text-align: center;
        padding-top: $sp2;
    }

    .wrapper.other {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .txt.other {
        text-align: start;
    }

    .label {
        cursor: pointer;
        @include font(book, normal, fs-100);
    }

    .link {
        @include font(book, normal, fs-80, 28);
        color: var(--txt-light);
    }

    .graphic {
        display: flex;
        flex-direction: column;
        padding: 10px 60px;

        &.tiny {
            padding: 0 10px;
        }

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
