<script lang="ts">
    import Refresh from "svelte-material-icons/Refresh.svelte";
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

    let refreshing = false;

    onMount(refresh);

    export function refresh() {
        if (disabled) return;

        dispatch("click");
        refreshing = true;

        return client
            .refreshAccountBalance(token, user.cryptoAccount)
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
</script>

<div class="container" class:align-centre={label === undefined}>
    <div class="balance">
        <div class="amount" class:bold>{client.formatTokens(value, minDecimals)}</div>
        {#if label !== undefined}
            <div class="label body_small">{label}</div>
        {/if}
    </div>
    <div class="refresh" class:refreshing class:disabled on:click={refresh}>
        <Refresh size={"1em"} color={disabled ? "var(--button-disabled)" : "var(--accent)"} />
    </div>
</div>

<style type="text/scss">
    .container {
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        gap: $sp2;
        &.align-centre {
            align-items: center;
        }
    }

    .refresh {
        &:not(.disabled) {
            cursor: pointer;
        }

        // We want the size of the refresh icon (1em) to be 24px
        // but we can't use rem units in SVGs
        @include font-size(fs-140);
        height: $sp5;
        width: $sp5;

        &.refreshing {
            @include spin();
        }

        @include mobile() {
            height: 21.59px;
            width: 21.59px;
        }
    }

    .balance {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        .amount {
            @include font-size(fs-100);
            &.bold {
                font-weight: 700;
            }
        }
    }
</style>
