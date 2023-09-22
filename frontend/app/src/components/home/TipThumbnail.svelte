<script lang="ts">
    import { AvatarSize, E8S_PER_TOKEN, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import Avatar from "../Avatar.svelte";

    const client = getContext<OpenChat>("client");

    export let ledger: string;
    export let userTips: Record<string, bigint>;

    let longPressed: boolean = false;

    $: userTipsList = Object.entries(userTips);
    $: cryptoLookup = client.cryptoLookup;
    $: userStore = client.userStore;

    function onClick() {}
</script>

<TooltipWrapper bind:longPressed position={"top"} align={"start"}>
    <div role="button" tabindex="0" slot="target" on:click={onClick} class="tip-wrapper">
        <img class="tip-icon" src={$cryptoLookup[ledger].logo} />
        <span class="tip-count">
            {userTipsList.length > 999 ? "999+" : userTipsList.length}
        </span>
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup {align} {position}>
            <div class="user-tips">
                {#each userTipsList as [userId, amount]}
                    <div class="user-tip">
                        <div class="avatar">
                            <Avatar
                                url={client.userAvatarUrl($userStore[userId])}
                                {userId}
                                size={AvatarSize.Tiny} />
                        </div>
                        <div class="username">
                            @{$userStore[userId]?.username}
                        </div>
                        <div class="amount">
                            {(Number(amount) / E8S_PER_TOKEN).toFixed(4)}
                        </div>
                    </div>
                {/each}
            </div>
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style lang="scss">
    .user-tips {
        text-align: left;
    }
    .user-tip {
        display: flex;
        gap: $sp2;
        align-items: center;
        justify-content: space-between;
        margin-bottom: $sp2;
    }
    .tip-wrapper {
        @include pop();
        border-radius: $sp2;
        background-color: var(--reaction-bg);
        color: var(--reaction-txt);
        cursor: pointer;
        padding: 3px $sp2;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: $sp2;
        font-size: 120%;

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
