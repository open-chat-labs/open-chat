<script lang="ts">
    import GateCheckFailed from "../AccessGateCheckFailed.svelte";
    import Overlay from "../../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: communityGate = $selectedCommunity?.gate;

    let joiningCommunity = false;
    let gateCheckFailed = false;

    function joinCommunity(): Promise<void> {
        if (previewingCommunity && $selectedCommunity) {
            joiningCommunity = true;
            return client
                .joinCommunity($selectedCommunity.id)
                .then((resp) => {
                    if (resp === "gate_check_failed") {
                        gateCheckFailed = true;
                    } else if (resp === "failure") {
                        toastStore.showFailureToast("communities.errors.joinFailed");
                    }
                })
                .finally(() => (joiningCommunity = false));
        }
        return Promise.resolve();
    }
</script>

{#if communityGate !== undefined && gateCheckFailed}
    <Overlay dismissible on:close={() => (gateCheckFailed = false)}>
        <GateCheckFailed on:close={() => (gateCheckFailed = false)} gate={communityGate} />
    </Overlay>
{/if}

<slot {joiningCommunity} {joinCommunity} />
