<script lang="ts">
    import Button from "../../Button.svelte";
    import { fade } from "svelte/transition";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Loading from "../../Loading.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { apiKey } from "../../../services/serviceContainer";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import { E8S_PER_ICP } from "../../../domain/user/user";
    import type { CreatedUser } from "../../../domain/user/user";
    import { currentUserKey } from "../../../fsm/home.controller";
    import { rollbar } from "../../../utils/logging";
    import AccountInfo from "../AccountInfo.svelte";

    export let open: boolean;

    const api = getContext<ServiceContainer>(apiKey);
    const user = getContext<CreatedUser>(currentUserKey);

    let refreshing = false;
    let error: string | undefined = undefined;
    let accountBalance: number = 0;

    $: icpBalance = accountBalance / E8S_PER_ICP; //balance in the user's account expressed as ICP

    export function reset() {
        refreshing = true;
        error = undefined;
        api.refreshAccountBalance(user.icpAccount)
            .then((resp) => {
                accountBalance = Number(resp.e8s);
                error = undefined;
            })
            .catch((err) => {
                error = "unableToRefreshAccountBalance";
                accountBalance = 0;
                rollbar.error("Unable to refresh user's account balance", err);
            })
            .finally(() => (refreshing = false));
    }
</script>

<Overlay dismissible={true} bind:active={open}>
    <ModalContent>
        <span class="header" slot="header">
            {$_("icpAccount.manageHeader")}
        </span>
        <form slot="body">
            {#if refreshing}
                <Loading />
            {:else}
                <AccountInfo {api} {user} />
            {/if}
            {#if error}
                <h4 in:fade class="error">{$_(error)}</h4>
            {/if}
        </form>
        <span class="footer" slot="footer">
            <a
                class="how-to"
                href={"https://www.finder.com/uk/how-to-buy-internet-computer"}
                target="_blank">
                {$_("howToBuyICP")}
            </a>
            <ButtonGroup>
                <Button small={true} secondary={true} on:click={() => (open = false)}
                    >{$_("close")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: $sp4;
    }
    .error {
        @include font(bold, normal, fs-100);
        color: var(--error);
        text-align: center;
    }
    .how-to {
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }

    .footer {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
</style>
