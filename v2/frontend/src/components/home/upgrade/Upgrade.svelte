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
    import type { Questions } from "../../../domain/faq";
    import FaqModal from "../../FaqModal.svelte";

    export let step: "explain" | "icp" | "sms";
    export let api: ServiceContainer;
    export let user: CreatedUser;

    let question: Questions | undefined = undefined;

    function upgradeViaSMS() {
        step = "sms";
    }

    function upgradeViaICP() {
        step = "icp";
    }

    function showFaqQuestion(ev: CustomEvent<Questions>) {
        question = ev.detail;
    }
</script>

<Overlay active={true}>
    {#if question !== undefined}
        <FaqModal
            fadeDuration={0}
            fadeDelay={0}
            {question}
            on:close={() => (question = undefined)} />
    {:else}
        <ModalContent fadeDuration={0} fadeDelay={0} hideFooter={true} fill={true}>
            <span slot="header">
                {step === "explain" ? $_("insufficientStorage") : $_("upgradeStorage")}
            </span>
            <span slot="body">
                {#if step === "explain"}
                    <Explain
                        on:showFaqQuestion={showFaqQuestion}
                        on:cancel
                        on:upgradeIcp={upgradeViaICP}
                        on:upgradeSms={upgradeViaSMS} />
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
    {/if}
</Overlay>

<style type="text/scss">
    .loading {
        height: 200px;
    }
</style>
