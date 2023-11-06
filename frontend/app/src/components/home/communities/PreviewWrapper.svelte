<script lang="ts">
    import GateCheckFailed from "../AccessGateCheckFailed.svelte";
    import Overlay from "../../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat } from "openchat-client";
    import InitiateCredentialCheck from "../InitiateCredentialCheck.svelte";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: communityGate = $selectedCommunity?.gate;

    let joiningCommunity = false;
    let gateCheckFailed = false;
    let checkingCredential = false;

    function credentialReceived(ev: CustomEvent<string>) {
        doJoinCommunity(ev.detail);
    }

    function joinCommunity() {
        if (client.anonUser) {
            client.identityState.set({ kind: "logging_in" });
            return;
        }
        doJoinCommunity(undefined);
    }

    function doJoinCommunity(credential: string | undefined): Promise<void> {
        if (previewingCommunity && $selectedCommunity) {
            if ($selectedCommunity.gate.kind === "credential_gate" && credential === undefined) {
                checkingCredential = true;
                return Promise.resolve();
            }
            checkingCredential = false;
            joiningCommunity = true;
            return client
                .joinCommunity($selectedCommunity)
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

{#if checkingCredential && $selectedCommunity?.gate?.kind === "credential_gate"}
    <Overlay dismissible on:close={() => (checkingCredential = false)}>
        <InitiateCredentialCheck
            level="community"
            on:close={() => (checkingCredential = false)}
            on:credentialReceived={credentialReceived}
            gate={$selectedCommunity.gate} />
    </Overlay>
{/if}

{#if communityGate !== undefined && gateCheckFailed}
    <Overlay dismissible on:close={() => (gateCheckFailed = false)}>
        <GateCheckFailed on:close={() => (gateCheckFailed = false)} gate={communityGate} />
    </Overlay>
{/if}

<slot {joiningCommunity} {joinCommunity} />
