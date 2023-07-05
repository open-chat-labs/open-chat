<script lang="ts">
    import AreYouSure from "../../AreYouSure.svelte";
    import GateCheckFailed from "../AccessGateCheckFailed.svelte";
    import Overlay from "../../Overlay.svelte";
    import { interpolateLevel } from "../../../utils/i18n";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: selectedCommunity = client.selectedCommunity;
    $: currentCommunityRules = client.currentCommunityRules;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: communityGate = $selectedCommunity?.gate;

    let joiningCommunity = false;
    let gateCheckFailed = false;
    let acceptingRules = false;

    function joinCommunity(yes: boolean): Promise<void> {
        if (previewingCommunity && $selectedCommunity) {
            if (
                $currentCommunityRules !== undefined &&
                $currentCommunityRules.enabled &&
                !acceptingRules &&
                !yes
            ) {
                acceptingRules = true;
                return Promise.resolve();
            } else {
                if (acceptingRules && !yes) {
                    acceptingRules = false;
                    return Promise.resolve();
                }

                acceptingRules = false;
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
        }
        return Promise.resolve();
    }
</script>

{#if acceptingRules}
    <AreYouSure
        title={interpolateLevel("rules.acceptTitle", "community")}
        yesLabel={$_("rules.accept")}
        noLabel={$_("rules.reject")}
        message={$currentCommunityRules?.text ?? ""}
        action={joinCommunity} />
{/if}

{#if communityGate !== undefined && gateCheckFailed}
    <Overlay dismissible on:close={() => (gateCheckFailed = false)}>
        <GateCheckFailed on:close={() => (gateCheckFailed = false)} gate={communityGate} />
    </Overlay>
{/if}

<slot {joiningCommunity} {joinCommunity} />
