<!-- The join bar in place of the composer while a group, channel or community is previewed (N8b, native plan 04
     "Joining", 12 "Preview and join"): what's previewed, over Join. What Join joins is logic/join's previewBar;
     "You joined …" or why it didn't go through comes as a toast, and the composer takes the bar's place once
     joined. -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        communityPreviewOriginStore,
        cryptoBalanceStore,
        currentUserStore,
        selectedCommunitySummaryStore,
        type EnhancedAccessGate,
        type MultiUserChat,
        type OpenChat,
    } from "@client";
    import { interpolate } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Icon from "@openchat/ui/src/lib/components/Icon.svelte";
    import { isJoining, startJoin, type JoinTarget } from "@src/logic/join/joinFlow.svelte";
    import { chatPreviewBar } from "@src/logic/join/previewBar";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Overlays } from "../../shell/overlays.svelte";
    import { joinBarView, joinStepToast } from "./joinBar.adapter";
    import JoinSheet from "./JoinSheet.svelte";

    interface Props {
        chat: MultiUserChat;
        overlays: Overlays;
        toast: (message: string) => void;
    }

    let { chat, overlays, toast }: Props = $props();

    const client = getContext<OpenChat>("client");

    const bar = $derived.by(() => {
        // what the client's calls read through `.value`, so the bar follows it: a lapse or a join
        // (the communities), Diamond bought or CHIT earned (the user), a top-up (balances)
        void [$communitiesStore, $currentUserStore, $cryptoBalanceStore];
        return chatPreviewBar(client, chat, {
            community: $selectedCommunitySummaryStore,
            guest: $anonUserStore,
            origin: $communityPreviewOriginStore,
        });
    });
    const view = $derived(joinBarView(bar, chat));

    // the requirements the client answered Join with; a closed sheet stays to slide away
    let sheet = $state<{
        id: number;
        target: JoinTarget;
        gates: EnhancedAccessGate[];
        name: string;
    }>();

    async function join() {
        const { target, name } = bar;
        const step = await startJoin(client, target);
        if (step.kind === "evaluate_gates") {
            sheet = { id: (sheet?.id ?? 0) + 1, target, gates: step.gates, name };
            return;
        }
        const message = joinStepToast(step, name);
        if (message !== undefined) toast(interpolate($_, message));
    }
</script>

<div class="join-bar">
    <span class="note">
        <Icon icon="eye" size={15} />
        {interpolate($_, view.note)}
    </span>
    <Button
        label={interpolate($_, view.label)}
        icon={view.icon}
        size="lg"
        fullWidth
        disabled={view.disabled}
        busy={isJoining(bar.target)}
        onClick={join}
    />
</div>

{#if sheet !== undefined}
    {#key sheet.id}
        <JoinSheet join={sheet} {overlays} {toast} />
    {/key}
{/if}

<style lang="scss">
    // the design's bar: a 1px rule on top, the note over a full-width Join
    .join-bar {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 16px 0;
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
    }

    .note {
        display: flex;
        align-items: center;
        gap: 8px;
        font: 500 13px/1.4 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;

        :global(.icon) {
            flex: none;
        }
    }
</style>
