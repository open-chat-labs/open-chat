<script lang="ts">
    import { Sheet } from "component-lib";
    import type { EnhancedAccessGate, GateCheckSucceeded, OpenChat } from "openchat-client";
    import {
        anonUserStore,
        identityStateStore,
        ROLE_NONE,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, tick, type Snippet } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import GateCheckFailed from "../access/AccessGateCheckFailed.svelte";
    import AccessGateEvaluator from "../access/AccessGateEvaluator.svelte";
    interface Props {
        children?: Snippet<[boolean, () => void, () => void, boolean]>;
    }

    let { children }: Props = $props();

    const client = getContext<OpenChat>("client");

    let joiningCommunity = $state(false);
    let gateCheckFailed: EnhancedAccessGate | undefined = $state(undefined);
    let checkingAccessGate: EnhancedAccessGate | undefined = $state(undefined);
    let gatesInEffect = $derived(
        $selectedCommunitySummaryStore !== undefined &&
            $selectedCommunitySummaryStore.gateConfig.gate.kind !== "no_gate" &&
            !$selectedCommunitySummaryStore.isInvited,
    );

    function joinCommunity() {
        if ($anonUserStore) {
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
        if (previewingCommunity && $selectedCommunitySummaryStore) {
            const credentials = gateCheck?.credentials ?? [];
            const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();
            const gateConfigWithLevel: EnhancedAccessGate = {
                ...$selectedCommunitySummaryStore.gateConfig.gate,
                level: "community",
                expiry: $selectedCommunitySummaryStore.gateConfig.expiry,
            };

            if (gateCheck === undefined) {
                if (gatesInEffect) {
                    const gateConfigs = [$selectedCommunitySummaryStore.gateConfig];
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
                .joinCommunity($selectedCommunitySummaryStore, credentials, paymentApprovals)
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
        $selectedCommunitySummaryStore?.membership.role === ROLE_NONE ||
            $selectedCommunitySummaryStore?.membership.lapsed,
    );
    $effect(() => {
        if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "join_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => joinCommunity());
        }
    });

    function cancelPreview() {
        if ($selectedCommunitySummaryStore) {
            client.removeCommunity($selectedCommunitySummaryStore.id);
            page("/communities");
        }
    }
</script>

{#if checkingAccessGate}
    <Sheet onDismiss={closeModal}>
        <AccessGateEvaluator
            gates={[checkingAccessGate]}
            onClose={closeModal}
            onSuccess={accessGatesEvaluated} />
    </Sheet>
{/if}

{#if gateCheckFailed}
    <Sheet onDismiss={closeModal}>
        <GateCheckFailed onClose={closeModal} />
    </Sheet>
{/if}

{@render children?.(joiningCommunity, joinCommunity, cancelPreview, gatesInEffect)}
