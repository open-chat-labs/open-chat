<script lang="ts">
    import type { EnhancedAccessGate, GateCheckSucceeded, OpenChat } from "openchat-client";
    import { app } from "openchat-client";
    import { getContext, tick, type Snippet } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Overlay from "../../Overlay.svelte";
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";
    import AccessGateEvaluator from "../access/AccessGateEvaluator.svelte";
    interface Props {
        children?: Snippet<[boolean, () => void]>;
    }

    let { children }: Props = $props();

    const client = getContext<OpenChat>("client");

    let joiningCommunity = $state(false);
    let gateCheckFailed: EnhancedAccessGate | undefined = $state(undefined);
    let checkingAccessGate: EnhancedAccessGate | undefined = $state(undefined);

    function joinCommunity() {
        if (app.anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_community" },
            });
            return;
        }
        doJoinCommunity(undefined);
    }

    function accessGatesEvaluated(success: GateCheckSucceeded) {
        doJoinCommunity(success);
    }

    function doJoinCommunity(gateCheck: GateCheckSucceeded | undefined): Promise<void> {
        if (previewingCommunity && app.selectedCommunitySummary) {
            const credentials = gateCheck?.credentials ?? [];
            const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();
            const gateConfigWithLevel: EnhancedAccessGate = {
                ...app.selectedCommunitySummary.gateConfig.gate,
                level: "community",
                expiry: app.selectedCommunitySummary.gateConfig.expiry,
            };

            if (gateCheck === undefined) {
                if (
                    app.selectedCommunitySummary.gateConfig.gate.kind !== "no_gate" &&
                    !app.selectedCommunitySummary.isInvited
                ) {
                    const gateConfigs = [app.selectedCommunitySummary.gateConfig];
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
                .joinCommunity(app.selectedCommunitySummary, credentials, paymentApprovals)
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
    let previewingCommunity = $derived(
        app.selectedCommunitySummary?.membership.role === "none" ||
            app.selectedCommunitySummary?.membership.lapsed,
    );
    $effect(() => {
        if (
            app.identityState.kind === "logged_in" &&
            app.identityState.postLogin?.kind === "join_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => joinCommunity());
        }
    });
</script>

{#if checkingAccessGate}
    <Overlay dismissible onClose={closeModal}>
        <AccessGateEvaluator
            gates={[checkingAccessGate]}
            onClose={closeModal}
            onSuccess={accessGatesEvaluated} />
    </Overlay>
{/if}

{#if gateCheckFailed}
    <Overlay dismissible onClose={closeModal}>
        <GateCheckFailed onClose={closeModal} gates={[gateCheckFailed]} />
    </Overlay>
{/if}

{@render children?.(joiningCommunity, joinCommunity)}
