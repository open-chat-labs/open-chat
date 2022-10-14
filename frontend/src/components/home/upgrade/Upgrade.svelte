<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import Loading from "../../Loading.svelte";
    import Reload from "../../Reload.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Explain from "./Explain.svelte";
    import Premium from "./Premium.svelte";
    import ICPUpgrade from "./ICPUpgrade.svelte";
    import type { Questions } from "../../../domain/faq";
    import FaqModal from "../../FaqModal.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const titles: Record<typeof step, string> = {
        premium: $_("premium.title"),
        explain: $_("insufficientStorage"),
        sms: $_("register.requestCode"),
        icp: $_("upgradeStorage"),
    };

    const client = getContext<OpenChat>("client");

    export let step: "premium" | "explain" | "icp" | "sms";

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

<Overlay>
    {#if question !== undefined}
        <FaqModal
            fadeDuration={0}
            fadeDelay={0}
            {question}
            on:close={() => (question = undefined)} />
    {:else}
        <ModalContent fadeDuration={0} fadeDelay={0} hideFooter={true} fill={true}>
            <span slot="header">
                {titles[step]}
            </span>
            <span slot="body">
                {#if step === "premium"}
                    <Premium
                        on:cancel
                        on:upgradeIcp={upgradeViaICP}
                        on:upgradeSms={upgradeViaSMS} />
                {/if}
                {#if step === "explain"}
                    <Explain
                        on:showFaqQuestion={showFaqQuestion}
                        on:cancel
                        on:upgradeIcp={upgradeViaICP}
                        on:upgradeSms={upgradeViaSMS} />
                {/if}
                {#if step === "icp"}
                    <ICPUpgrade on:cancel />
                {/if}
                {#if step === "sms"}
                    {#await import("./SMSUpgrade.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then smsUpgrade}
                        <svelte:component this={smsUpgrade.default} on:cancel />
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
