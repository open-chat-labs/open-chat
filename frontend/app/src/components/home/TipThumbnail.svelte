<script lang="ts">
    import { AvatarSize, type OpenChat, userStore } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import Avatar from "../Avatar.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger: string;
    export let userTips: Record<string, bigint>;
    export let canTip: boolean;

    let longPressed: boolean = false;

    $: userTipsList = Object.entries(userTips);
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: totalAmount = userTipsList.reduce((n, [_, amount]) => n + amount, BigInt(0));

    function onClick() {
        if (!longPressed && canTip) {
            dispatch("click", ledger);
        }
    }
</script>

<TooltipWrapper bind:longPressed position={"bottom"} align={"start"}>
    <div
        role="button"
        tabindex="0"
        slot="target"
        on:click={onClick}
        class="tip-wrapper"
        class:canTip>
        <img class="tip-icon" src={tokenDetails.logo} />
        <span class="tip-count">
            {userTipsList.length > 999 ? "999+" : userTipsList.length}
        </span>
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup autoWidth {align} {position}>
            <div class="user-tips">
                {#each userTipsList as [userId, amount]}
                    <div class="avatar">
                        <Avatar
                            url={client.userAvatarUrl($userStore.get(userId))}
                            {userId}
                            size={AvatarSize.Tiny} />
                    </div>
                    <div class="username">
                        @{$userStore.get(userId)?.username}
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
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style lang="scss">
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
    .tip-wrapper {
        @include pop();
        border-radius: var(--rd);
        background-color: var(--reaction-bg);
        color: var(--reaction-txt);
        padding: 3px $sp2;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: $sp2;
        font-size: 120%;

        &.canTip {
            cursor: pointer;
        }

        .tip-count {
            @include font(book, normal, fs-60);
            margin-left: $sp2;
        }

        .tip-icon {
            background-size: contain;
            height: 24px;
            width: 24px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;
        }
    }
</style>
