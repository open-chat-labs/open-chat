<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import Explain from "./Explain.svelte";
    import ICPUpgrade from "./ICPUpgrade.svelte";
    import SMSUpgrade from "./SMSUpgrade.svelte";
    import { storageStore } from "stores/storage";

    const dispatch = createEventDispatcher();

    export let mode: "intercepting" | "direct";
    let step: "explain" | "icp" | "sms" = "explain";

    onMount(() => {
        if (mode === "direct" && $storageStore.byteLimit > 0) {
            step = "icp";
        }
    });

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
            {mode === "intercepting" ? $_("insufficientStorage") : $_("upgradeStorage")}
        </span>
        <span slot="body">
            {#if step === "explain"}
                <Explain
                    {mode}
                    on:cancel
                    on:upgradeIcp={upgradeViaICP}
                    on:upgradeSms={upgradeViaSMS} />
            {/if}
            {#if step === "icp"}
                <ICPUpgrade {mode} on:cancel />
            {/if}
            {#if step === "sms"}
                <SMSUpgrade {mode} on:cancel />
            {/if}
        </span>
    </ModalContent>
</Overlay>
