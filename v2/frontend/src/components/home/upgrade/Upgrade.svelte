<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Explain from "./Explain.svelte";
    import ICPUpgrade from "./ICPUpgrade.svelte";
    import SMSUpgrade from "./SMSUpgrade.svelte";

    export let step: "explain" | "icp" | "sms";

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
                <ICPUpgrade on:cancel />
            {/if}
            {#if step === "sms"}
                <SMSUpgrade on:cancel />
            {/if}
        </span>
    </ModalContent>
</Overlay>
