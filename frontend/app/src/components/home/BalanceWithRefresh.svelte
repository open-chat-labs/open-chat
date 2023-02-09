<script lang="ts">
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Cryptocurrency, OpenChat } from "openchat-client";
    import { logger } from "../../utils/logging";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let token: Cryptocurrency = "icp";
    export let value: bigint;
    export let label: string | undefined = undefined;
    export let minDecimals = 4;
    export let bold = false;
    export let disabled = false;
    export let toppingUp = false;
    export let showTopUp = false;
    export let refreshing = false;

    onMount(refresh);

    export function refresh() {
        if (disabled) return;

        dispatch("click");
        refreshing = true;

        return client
            .refreshAccountBalance(token, user.userId)
            .then((val) => {
                dispatch("refreshed", val);
            })
            .catch((err) => {
                const errorMessage = $_("unableToRefreshAccountBalance", { values: { token } });
                logger.error(`Failed to refresh ${token} account balance`, err);
                dispatch("error", errorMessage);
            })
            .finally(() => (refreshing = false));
    }

    function topUp() {
        toppingUp = !toppingUp;
    }
</script>

<div class="container">
    {#if label !== undefined}
        <div class="label">{label}</div>
    {/if}
    <div class="amount" class:bold>{client.formatTokens(value, minDecimals)}</div>
    <div class="refresh" class:refreshing class:disabled on:click={refresh}>
        <Refresh size={"1em"} color={disabled ? "var(--button-disabled)" : "var(--icon-txt)"} />
    </div>
    {#if showTopUp}
        <div class="top-up" on:click={topUp} title={$_("cryptoAccount.topUp")}>
            <Plus size={"1em"} color={toppingUp ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </div>
    {/if}
</div>

<style type="text/scss">
    .container {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
    }

    .top-up,
    .refresh {
        // We want the size of the refresh icon (1em) to be 24px
        // but we can't use rem units in SVGs
        @include font-size(fs-140);
        height: $sp5;
        width: $sp5;
        &:not(.disabled) {
            cursor: pointer;
        }
        @include mobile() {
            height: 21.59px;
            width: 21.59px;
        }
    }

    .refresh {
        &.refreshing {
            @include spin();
        }
    }

    .label {
        @include font(bold, normal, fs-100, 22);
        color: var(--txt-light);
        font-weight: 400;
    }

    .amount {
        @include font(bold, normal, fs-100, 22);
    }
</style>
