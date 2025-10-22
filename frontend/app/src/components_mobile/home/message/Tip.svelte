<script lang="ts">
    import {
        Avatar,
        ChatFootnote,
        ColourVars,
        Container,
        Tooltip,
        type Alignment,
    } from "component-lib";
    import { allUsersStore, cryptoLookup, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        alignTooltip?: Alignment;
        tip: [string, Record<string, bigint>];
        onClick?: (ledger: string) => void;
    }

    let { onClick, tip, alignTooltip }: Props = $props();
    let [ledger, userTips] = $derived(tip);
    let userTipsList = $derived(Object.entries(userTips));
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let totalAmount = $derived(userTipsList.reduce((n, [_, amount]) => n + amount, BigInt(0)));
</script>

<Tooltip autoWidth position={"bottom"} align={alignTooltip}>
    <Container
        onClick={() => onClick?.(ledger)}
        borderRadius={"lg"}
        width={{ kind: "hug" }}
        padding={["zero", "xs"]}
        background={ColourVars.background2}
        crossAxisAlignment={"center"}
        gap={"xs"}
        borderWidth={"thin"}
        borderColour={ColourVars.background0}>
        <img alt={tokenDetails.symbol} class="tip-icon" src={tokenDetails.logo} />
        <ChatFootnote>
            {userTipsList.length > 999 ? "999+" : userTipsList.length}
        </ChatFootnote>
    </Container>

    {#snippet popup()}
        <div class="user-tips">
            {#each userTipsList as [userId, amount]}
                <div class="avatar">
                    <Avatar url={client.userAvatarUrl($allUsersStore.get(userId))} size={"xs"} />
                </div>
                <div class="username">
                    @{$allUsersStore.get(userId)?.username}
                </div>
                <div class="amount">
                    {client.formatTokens(amount, tokenDetails.decimals)}
                </div>
            {/each}
            {#if userTipsList.length > 1}
                <div class="total">
                    {client.formatTokens(totalAmount, tokenDetails.decimals)}
                </div>
            {/if}
        </div>
    {/snippet}
</Tooltip>

<style lang="scss">
    .tip-icon {
        background-size: contain;
        height: 24px;
        width: 24px;
        border-radius: 50%;
        background-repeat: no-repeat;
        background-position: top;
    }

    .user-tips {
        display: grid;
        grid-template-columns: 24px 1fr auto;
        align-items: center;
        column-gap: $sp2;
        row-gap: $sp2;
        text-align: left;
        @include font(book, normal, fs-90);
    }

    .amount,
    .total {
        font-weight: 700;
        text-align: right;
    }

    .total {
        padding-top: $sp2;
        border-top: 1px solid var(--menu-separator);
        grid-column: span 3;
    }
</style>
