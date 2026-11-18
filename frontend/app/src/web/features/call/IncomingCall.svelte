<!-- A call ringing here (web 7b): a card in the window's top-right corner over the app, with the
     ringtone while the user isn't in another call. Accept opens the chat and joins; Decline
     declines; ✕ or Esc only stops the ring here (logic/video/incomingCall). TODO(design): no design
     has an incoming call; built from library parts (GAPS.md, "Calls"). -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        publish,
        routeForChatIdentifier,
        type OpenChat,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import RoundIconButton from "@openchat/ui/src/lib/components/RoundIconButton.svelte";
    import { ringActions, ringCard } from "@src/logic/video/incomingCall";
    import {
        activeVideoCall,
        incomingVideoCall,
        ringtoneUrls,
        selectedRingtone,
        type RingtoneKey,
    } from "@src/stores/video";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    const ring = $derived.by(() => {
        const call = $incomingVideoCall;
        if (call === undefined) return undefined;
        const card = ringCard(client, call, $allUsersStore, $communitiesStore);
        if (card === undefined) return undefined;
        return {
            name: card.name,
            avatarUrl: card.avatarUrl,
            line: $_(card.line, { values: { name: card.caller } }),
            actions: ringActions(call, {
                clear: () => incomingVideoCall.set(undefined),
                decline: (chatId) => client.declineVideoCall(chatId),
                // the chat's own route, as the old trees open it: a list scope (favourites) may not
                // have the chat, and would close it again under the call
                open: (chatId) => navigate(routeForChatIdentifier("none", chatId)),
                join: (request) => publish("startVideoCall", request),
            }),
        };
    });
    const ringtoneUrl = $derived(ringtoneUrls[$selectedRingtone as RingtoneKey]);
</script>

<svelte:window
    onkeydown={(e) => {
        if (e.key === "Escape") ring?.actions.dismiss();
    }} />

{#if ring !== undefined}
    {#if $activeVideoCall === undefined}
        <audio autoplay playsinline src={ringtoneUrl}></audio>
    {/if}
    <div class="ring" role="alertdialog" aria-label={ring.line}>
        <Avatar url={ring.avatarUrl} size={48} />
        <div class="text">
            <span class="name">{ring.name}</span>
            <span class="line">{ring.line}</span>
        </div>
        <div class="buttons">
            <RoundIconButton
                icon="phone-off"
                label={$_("videoCall.ignore")}
                variant="danger"
                size="md"
                onPress={ring.actions.decline} />
            <RoundIconButton
                icon="phone"
                label={$_("videoCall.join")}
                variant="accept"
                size="md"
                onPress={ring.actions.accept} />
        </div>
        <button
            type="button"
            class="close"
            aria-label={$_("close")}
            onclick={ring.actions.dismiss}><span class="close-icon"></span></button>
    </div>
{/if}

<style lang="scss">
    .ring {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 90;
        display: flex;
        align-items: center;
        gap: 14px;
        width: 360px;
        max-width: calc(100vw - 32px);
        box-sizing: border-box;
        padding: 16px 40px 16px 16px;
        border-radius: 16px;
        background: var(--surface-2);
        color: var(--ink);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }

    .text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }

    .name {
        font: 600 15px/1.3 var(--font-sans);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .line {
        font: 400 13px/1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .buttons {
        display: flex;
        gap: 10px;
    }

    .close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--ink-3);
    }

    .close-icon {
        display: block;
        width: 14px;
        height: 14px;
        margin: auto;
        background: currentColor;
        mask: var(--icon-close) center/contain no-repeat;
    }
</style>
