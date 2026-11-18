<!-- A call ringing here (N14), in a phone's browser: the apps ring with the system's own call screen
     and never set it (stores/video). A card under the status bar over everything but the call, with
     the ringtone while the user isn't in another call. Accept opens the chat and joins; Decline
     declines; ✕ or Android's Back only stops the ring here (logic/video/incomingCall).
     TODO(design): no design has an incoming call; built from the call screen's parts (GAPS.md). -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        publish,
        routeForChatIdentifier,
        type OpenChat,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
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
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";

    let { overlays }: { overlays: Overlays } = $props();

    const client = getContext<OpenChat>("client");

    const ring = $derived.by(() => {
        const call = $incomingVideoCall;
        if (call === undefined) return undefined;
        const card = ringCard(client, call, $allUsersStore, $communitiesStore);
        if (card === undefined) return undefined;
        return {
            ...card,
            line: $_(card.line, { values: { name: card.caller } }),
            actions: ringActions(call, {
                clear: () => incomingVideoCall.set(undefined),
                decline: (chatId) => client.declineVideoCall(chatId),
                open: (chatId) => navigate(routeForChatIdentifier("none", chatId)),
                join: (request) => publish("startVideoCall", request),
            }),
        };
    });
    const ringtoneUrl = $derived(ringtoneUrls[$selectedRingtone as RingtoneKey]);

    // Android's system back dismisses it, as it closes a sheet
    useOverlay(
        overlays,
        () => ring !== undefined,
        () => ring?.actions.dismiss(),
    );
</script>

{#if ring !== undefined}
    {#if $activeVideoCall === undefined}
        <audio autoplay playsinline src={ringtoneUrl}></audio>
    {/if}
    <div class="ring" data-mode="dark" role="alertdialog" aria-label={ring.line}>
        <Avatar url={ring.avatarUrl} size={48} />
        <span class="text">
            <span class="name">{ring.name}</span>
            <span class="line">{ring.line}</span>
        </span>
        <button
            type="button"
            class="round danger"
            aria-label={$_("videoCall.ignore")}
            onclick={ring.actions.decline}
        >
            <span class="glyph" style:mask="var(--icon-phone-off) center/contain no-repeat"></span>
        </button>
        <button
            type="button"
            class="round accept"
            aria-label={$_("videoCall.join")}
            onclick={ring.actions.accept}
        >
            <span class="glyph" style:mask="var(--icon-phone) center/contain no-repeat"></span>
        </button>
        <button
            type="button"
            class="close"
            aria-label={$_("close")}
            onclick={ring.actions.dismiss}
        >
            <span class="close-glyph"></span>
        </button>
    </div>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // over the screens, the sheets and the minimised call; under the call screen
    .ring {
        position: fixed;
        top: calc(var(--safe-top) + 8px);
        left: 8px;
        right: 8px;
        z-index: calc(var(--z-modal) + 4);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 14px 14px 16px;
        border-radius: 20px;
        background: #15151b;
        color: #fff;
        box-shadow:
            0 12px 32px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.12);
        animation: ring-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);

        @include reduced-motion {
            animation: none;
        }
    }

    @keyframes ring-in {
        from {
            transform: translateY(calc(-100% - var(--safe-top) - 8px));
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .name {
        font: 700 15px/1.2 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .line {
        font: 500 12.5px/1.3 var(--font-sans);
        color: rgba(255, 255, 255, 0.65);
    }

    .round {
        flex: none;
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        cursor: pointer;

        &.danger {
            background: var(--status-danger);
        }

        &.accept {
            background: var(--status-online);
        }
    }

    .glyph {
        width: 20px;
        height: 20px;
        background: #fff;
    }

    .close {
        position: absolute;
        top: -8px;
        right: -4px;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #2a2a33;
        cursor: pointer;
    }

    .close-glyph {
        width: 12px;
        height: 12px;
        background: #fff;
        mask: var(--icon-close) center/contain no-repeat;
    }
</style>
