<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../Button.svelte";
    import GateCheckFailed from "./AccessGateCheckFailed.svelte";
    import Overlay from "../Overlay.svelte";
    import GroupGateIcon from "./AccessGateIcon.svelte";
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { _ } from "svelte-i18n";
    import { interpolateLevel } from "utils/i18n";
    import AreYouSure from "../AreYouSure.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chat: MultiUserChat;
    export let joining: MultiUserChat | undefined;

    $: isFrozen = client.isFrozen(chat.id);
    $: selectedCommunity = client.selectedCommunity;
    $: currentCommunityRules = client.currentCommunityRules;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";
    $: communityGate = $selectedCommunity?.gate;

    let isPlatformModerator = client.isPlatformModerator();
    let freezingInProgress = false;
    let joiningCommunity = false;
    let gateCheckFailed = false;
    let acceptingRules = false;

    $: console.log("Rules: ", $currentCommunityRules);

    function joinGroup() {
        dispatch("joinGroup", {
            group: chat,
            select: true,
        });
    }

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
                            joining = undefined;
                        }
                    })
                    .finally(() => (joiningCommunity = false));
            }
        }
        return Promise.resolve();
    }

    function cancelPreview() {
        if (previewingCommunity && $selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
        } else {
            client.removeChat(chat.id);
            if (!chat.public) {
                client.declineInvitation(chat.id);
            }
        }
    }

    function freezeGroup() {
        if (chat.id.kind !== "group_chat") return;
        freezingInProgress = true;
        client.freezeGroup(chat.id, undefined).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToFreezeGroup");
            }
            freezingInProgress = false;
        });
    }

    function unfreezeGroup() {
        if (chat.id.kind !== "group_chat") return;
        freezingInProgress = true;
        client.unfreezeGroup(chat.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast("failedToUnfreezeGroup");
            }
            freezingInProgress = false;
        });
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

<div class="preview">
    {#if previewingCommunity && $selectedCommunity !== undefined}
        <div class="gate">
            <GroupGateIcon on:upgrade gate={$selectedCommunity.gate} />
        </div>
    {:else if chat.kind === "group_chat" || chat.kind === "channel"}
        <div class="gate">
            <GroupGateIcon on:upgrade gate={chat.gate} />
        </div>
    {/if}
    {#if isPlatformModerator}
        {#if isFrozen}
            <Button
                loading={freezingInProgress}
                secondary={true}
                small={true}
                on:click={unfreezeGroup}>
                {$_("unfreezeGroup")}
            </Button>
        {:else}
            <Button
                loading={freezingInProgress}
                secondary={true}
                small={true}
                on:click={freezeGroup}>
                {$_("freezeGroup")}
            </Button>
        {/if}
    {/if}
    <Button secondary={true} small={true} on:click={cancelPreview}>
        {$_("leave")}
    </Button>
    {#if previewingCommunity}
        <Button
            loading={joiningCommunity}
            disabled={joiningCommunity}
            small={true}
            on:click={() => joinCommunity(false)}>
            {interpolateLevel("communities.joinCommunity", chat.level, true)}
        </Button>
    {:else}
        <Button
            loading={joining !== undefined}
            disabled={joining !== undefined}
            small={true}
            on:click={joinGroup}>
            {interpolateLevel("joinGroup", chat.level, true)}
        </Button>
    {/if}
</div>

<style lang="scss">
    .preview {
        height: 42px;
        color: var(--txt);
        @include font(book, normal, fs-100);
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        justify-content: flex-end;
        gap: $sp3;
        @include mobile() {
            justify-content: center;
        }

        .gate {
            position: absolute;
            left: 0;
        }
    }
</style>
