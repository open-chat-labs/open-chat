<script lang="ts">
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { apiKey } from "../../services/serviceContainer";
    import { currentUserKey } from "../../fsm/home.controller";
    import type { CreatedUser } from "../../domain/user/user";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import type { Cryptocurrency } from "../../domain/crypto";
    import { rollbar } from "../../utils/logging";
    import { formatTokens } from "../../utils/cryptoFormatter";

    const dispatch = createEventDispatcher();
    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    export let token: Cryptocurrency;
    export let value: bigint;
    export let label: string | undefined = undefined;
    export let minDecimals = 4;
    export let bold = false;

    let refreshing = false;

    onMount(refresh);

    export function refresh(): Promise<void> {
        dispatch("click");
        refreshing = true;

        return api
            .refreshAccountBalance(token, user.cryptoAccount)
            .then((val) => {
                dispatch("refreshed", val);
            })
            .catch((err) => {
                const errorMessage = $_("unableToRefreshAccountBalance", { values: { token } });
                rollbar.error(`Failed to refresh ${token} account balance`, err);
                dispatch("error", errorMessage);
            })
            .finally(() => (refreshing = false));
    }
</script>

<div class="container" align-centre={label !== undefined}>
    <div class="balance">
        <div class="amount" class:bold>{formatTokens(value, minDecimals)}</div>
        {#if label !== undefined}
            <div class="label">{label}</div>
        {/if}
    </div>
    <div class="refresh" class:refreshing on:click={refresh}>
        <Refresh size={"1em"} color={"var(--accent)"} />
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
        cursor: pointer;
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
        .label {
            @include font(light, normal, fs-70);
        }
    }
</style>
