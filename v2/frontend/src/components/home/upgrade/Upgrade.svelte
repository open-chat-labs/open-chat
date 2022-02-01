<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import Loading from "../../Loading.svelte";
    import Reload from "../../Reload.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Explain from "./Explain.svelte";
    import ICPUpgrade from "./ICPUpgrade.svelte";
    import type { ServiceContainer } from "../../../services/serviceContainer";
    import type { CreatedUser } from "../../../domain/user/user";

    export let step: "explain" | "icp" | "sms";
    export let api: ServiceContainer;
    export let user: CreatedUser;

    function upgradeViaSMS() {
        step = "sms";
    }

    function upgradeViaICP() {
        step = "icp";
    }
</script>

<Overlay active={true}>
    <ModalContent hideFooter={true} fill={true}>
        <span slot="header">
            {step === "explain" ? $_("insufficientStorage") : $_("upgradeStorage")}
        </span>
        <span slot="body">
            {#if step === "explain"}
                <Explain on:cancel on:upgradeIcp={upgradeViaICP} on:upgradeSms={upgradeViaSMS} />
            {/if}
            {#if step === "icp"}
                <ICPUpgrade {user} {api} on:cancel />
            {/if}
            {#if step === "sms"}
                {#await import("./SMSUpgrade.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then smsUpgrade}
                    <svelte:component this={smsUpgrade.default} {user} {api} on:cancel />
                {:catch _error}
                    <Reload>{$_("unableToLoadSMSUpgrade")}</Reload>
                {/await}
            {/if}
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .loading {
        height: 200px;
    }
</style>
