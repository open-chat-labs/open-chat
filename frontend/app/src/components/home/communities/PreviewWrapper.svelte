<script lang="ts">
    import GateCheckFailed from "../AccessGateCheckFailed.svelte";
    import Overlay from "../../Overlay.svelte";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat } from "openchat-client";
    import InitiateCredentialCheck from "../InitiateCredentialCheck.svelte";
    import ApproveJoiningPaymentModal from "../ApproveJoiningPaymentModal.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    $: anonUser = client.anonUser;
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: communityGate = $selectedCommunity?.gate;

    let joiningCommunity = false;
    let gateCheckFailed = false;
    let checkingCredential = false;
    let showPaymentModal = false;

    function credentialReceived(ev: CustomEvent<string>) {
        doJoinCommunity(ev.detail);
    }

    function joinCommunity() {
        if ($anonUser) {
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
            } else if ($selectedCommunity.gate.kind === "payment_gate") {
                showPaymentModal = true;
                return Promise.resolve();
            }
            closeModals();
            joiningCommunity = true;

            return client
                .joinCommunity($selectedCommunity, credential)
                .then((resp) => {
                    if (resp.kind === "gate_check_failed") {
                        gateCheckFailed = true;
                    } else if (resp.kind !== "success") {
                        toastStore.showFailureToast(i18nKey("communities.errors.joinFailed"));
                    }
                })
                .finally(() => (joiningCommunity = false));
        }
        return Promise.resolve();
    }

    function closeModals() {
        showPaymentModal = false;
        checkingCredential = false;
    }
</script>

{#if checkingCredential && $selectedCommunity?.gate?.kind === "credential_gate"}
    <Overlay dismissible on:close={() => (checkingCredential = false)}>
        <InitiateCredentialCheck
            level="community"
            on:close={closeModals}
            on:credentialReceived={credentialReceived}
            gate={$selectedCommunity.gate} />
    </Overlay>
{:else if showPaymentModal && $selectedCommunity?.gate?.kind === "payment_gate"}
    <Overlay dismissible on:close={() => (checkingCredential = false)}>
        <ApproveJoiningPaymentModal
            on:close={closeModals}
            on:joined={closeModals}
            group={$selectedCommunity}
            gate={$selectedCommunity.gate} />
    </Overlay>
{/if}

{#if communityGate !== undefined && gateCheckFailed}
    <Overlay dismissible on:close={() => (gateCheckFailed = false)}>
        <GateCheckFailed on:close={() => (gateCheckFailed = false)} gate={communityGate} />
    </Overlay>
{/if}

<slot {joiningCommunity} {joinCommunity} />
