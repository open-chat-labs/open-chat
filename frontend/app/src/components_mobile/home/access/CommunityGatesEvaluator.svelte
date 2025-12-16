<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { Sheet } from "component-lib";
    import {
        OpenChat,
        publish,
        ROLE_NONE,
        selectedCommunitySummaryStore,
        type EnhancedAccessGate,
        type GateCheckSucceeded,
    } from "openchat-client";
    import { getContext } from "svelte";
    import GateCheckFailed from "./AccessGateCheckFailed.svelte";
    import AccessGatesEvaluator from "./AccessGatesEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
    }

    let { gates }: Props = $props();
    let gateCheckFailed = $state<EnhancedAccessGate>();
    let previewingCommunity = $derived(
        $selectedCommunitySummaryStore?.membership.role === ROLE_NONE ||
            $selectedCommunitySummaryStore?.membership.lapsed,
    );

    function onSuccess(gateCheck: GateCheckSucceeded) {
        if (previewingCommunity && $selectedCommunitySummaryStore) {
            const credentials = gateCheck?.credentials ?? [];
            const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();
            const gateConfigWithLevel: EnhancedAccessGate = {
                ...$selectedCommunitySummaryStore.gateConfig.gate,
                level: "community",
                expiry: $selectedCommunitySummaryStore.gateConfig.expiry,
            };

            return client
                .joinCommunity($selectedCommunitySummaryStore, credentials, paymentApprovals)
                .then((resp) => {
                    if (resp.kind === "gate_check_failed") {
                        gateCheckFailed = gateConfigWithLevel;
                    } else if (resp.kind !== "success") {
                        toastStore.showFailureToast(i18nKey("communities.errors.joinFailed"));
                    }
                });
        }
    }
</script>

<AccessGatesEvaluator {gates} onClose={() => publish("closeModalPage")} {onSuccess} />

{#if gateCheckFailed}
    <Sheet onDismiss={() => (gateCheckFailed = undefined)}>
        <GateCheckFailed onClose={() => (gateCheckFailed = undefined)} />
    </Sheet>
{/if}
