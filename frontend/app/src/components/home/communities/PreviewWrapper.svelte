<script lang="ts">
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";
    import Overlay from "../../Overlay.svelte";
    import { getContext, tick } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { AccessGateConfigWithLevel, GateCheckSucceeded, OpenChat } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import AccessGateEvaluator from "../access/AccessGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";

    $: {
        if (
            $identityState.kind === "logged_in" &&
            $identityState.postLogin?.kind === "join_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => joinCommunity());
        }
    }

    let joiningCommunity = false;
    let gateCheckFailed: AccessGateConfigWithLevel | undefined = undefined;
    let checkingAccessGate: AccessGateConfigWithLevel | undefined = undefined;

    function joinCommunity() {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_community" },
            });
            return;
        }
        doJoinCommunity(undefined);
    }

    function accessGatesEvaluated(ev: CustomEvent<GateCheckSucceeded>) {
        doJoinCommunity(ev.detail);
    }

    function doJoinCommunity(gateCheck: GateCheckSucceeded | undefined): Promise<void> {
        if (previewingCommunity && $selectedCommunity) {
            const credentials = gateCheck?.credentials ?? [];
            const gateConfigWithLevel: AccessGateConfigWithLevel = {
                ...$selectedCommunity.gateConfig,
                level: "community",
            };

            if (gateCheck === undefined) {
                if (
                    $selectedCommunity.gateConfig.gate.kind !== "no_gate" &&
                    !$selectedCommunity.isInvited
                ) {
                    const gateConfigs = [$selectedCommunity.gateConfig];
                    const gates = gateConfigs.map((gc) => gc.gate);
                    const passed = client.doesUserMeetAccessGates(gates);
                    if (!passed) {
                        /**
                         * If we cannot already tell that the user passes the access gate(s), check if there are any gates that require front end
                         * pre-processing.
                         */
                        if (client.gatePreprocessingRequired(gates)) {
                            checkingAccessGate = gateConfigWithLevel;
                            return Promise.resolve();
                        }
                    }
                }
            }

            closeModal();
            joiningCommunity = true;

            return client
                .joinCommunity($selectedCommunity, credentials)
                .then((resp) => {
                    if (resp.kind === "gate_check_failed") {
                        gateCheckFailed = gateConfigWithLevel;
                    } else if (resp.kind !== "success") {
                        toastStore.showFailureToast(i18nKey("communities.errors.joinFailed"));
                    }
                })
                .finally(() => (joiningCommunity = false));
        }
        return Promise.resolve();
    }

    function closeModal() {
        checkingAccessGate = undefined;
        gateCheckFailed = undefined;
    }
</script>

{#if checkingAccessGate}
    <Overlay dismissible on:close={closeModal}>
        <AccessGateEvaluator
            level={checkingAccessGate.level}
            gates={[{ level: checkingAccessGate.level, ...checkingAccessGate.gate }]}
            expiry={checkingAccessGate.expiry}
            on:close={closeModal}
            on:success={accessGatesEvaluated} />
    </Overlay>
{/if}

{#if gateCheckFailed}
    <Overlay dismissible on:close={closeModal}>
        <GateCheckFailed
            on:close={closeModal}
            gates={[{ level: gateCheckFailed.level, ...gateCheckFailed.gate }]} />
    </Overlay>
{/if}

<slot {joiningCommunity} {joinCommunity} />
