<!-- The call, full screen and always dark (native design notes §3.5, N14): Minimise, the chat's name
     and the call's time, how many are in it; then the stage and the controls. Video: up to 3 people
     stack the others with the user's camera floating over them (six snap spots), 4 or more share a
     2-column grid, the active speaker in a green ring. Voice: everyone as centred avatars with
     speaking rings. The 52px controls (callControls) hide 4s after the last tap in a video call, and
     the video grows by half their height; a tap on the stage brings them back (CallChrome).
     TODO(design): flip camera on the user's tile, and the output menu with headphones (N14, PR 3). -->
<script lang="ts">
    import { allUsersStore, formatClock, type OpenChat } from "@client";
    import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
    import SnapFloat from "@openchat/ui/src/lib/components/SnapFloat.svelte";
    import VideoTile from "@openchat/ui/src/features/components/VideoTile.svelte";
    import { callFace, callPeople, callSend } from "@src/logic/video/callPeople";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import { activeVideoCall, camera, microphone, speaker } from "@src/stores/video";
    import { now500 } from "@src/stores/time";
    import { setCallSpeaker } from "@utils/native/call_bridge";
    import { getContext, onDestroy } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { _ } from "svelte-i18n";
    import { callControls, callStage, type CallControlId } from "./call.adapter";
    import { CallChrome } from "./callChrome.svelte";

    let {
        session,
        title,
        started,
        canRoute,
        onMinimise,
    }: {
        session: CallSession;
        title: string;
        /** When the call started, if the chat says (ms). */
        started: number | undefined;
        /** The app can switch between earpiece and loudspeaker (the Android app). */
        canRoute: boolean;
        onMinimise: () => void;
    } = $props();

    const client = getContext<OpenChat>("client");

    const call = $derived($activeVideoCall);
    const video = $derived(call?.callType !== "audio");
    const view = $derived(
        callPeople(
            session.media.participants,
            session.media.activeSpeaker,
            callFace(client, $allUsersStore, AVATAR_GRADIENTS),
            session.media.streamOf,
        ),
    );
    const stage = $derived(callStage(view.people, view.self, video, $_("native.call.you")));
    const count = $derived(view.people.length + 1);
    const send = $derived(
        callSend(call, session.media.participants.local, session.askedToSpeak),
    );
    const controls = $derived(
        callControls({
            video,
            muted: !$microphone,
            camera: $camera,
            speaker: canRoute ? $speaker : undefined,
            speak: send === "send" ? undefined : send,
        }),
    );

    // a direct call nobody has answered yet rings; until it's joined it's joining
    const status = $derived.by(() => {
        if (call === undefined || call.status === "joining") return $_("native.call.joining");
        if (call.chatId.kind === "direct_chat" && view.people.length === 0) {
            return $_("native.call.calling");
        }
        return started === undefined ? "" : formatClock(Math.max(0, $now500 - started) / 1000);
    });

    const chrome = new CallChrome();
    $effect(() => chrome.update(video, false));
    onDestroy(() => chrome.dispose());

    function press(id: CallControlId) {
        chrome.wake();
        switch (id) {
            case "mic":
                activeVideoCall.toggleMicrophone();
                break;
            case "camera":
                activeVideoCall.setCamera(!$camera);
                break;
            case "speaker":
                // the shell owns the route and reports it back (native calls M4, #9559)
                void setCallSpeaker(!$speaker);
                break;
            case "ask":
                if (send === "ask") session.askToSpeak();
                break;
            case "leave":
                session.hangup();
                break;
        }
    }

    // where the user dropped their own floating tile, for as long as the screen is up
    let selfSpot = $state<"tl" | "tr" | "ml" | "mr" | "bl" | "br">("br");

    // pictures that failed to load show the initial instead
    const failed = new SvelteSet<string>();
</script>

{#snippet face(url: string | undefined, initial: string)}
    {#if url && !failed.has(url)}
        <img class="face-image" src={url} alt="" onerror={() => failed.add(url)} />
    {:else}
        {initial}
    {/if}
{/snippet}

<div
    class="call"
    data-mode="dark"
    role="dialog"
    aria-label={title}
>
    <div class="top">
        <button
            type="button"
            class="round"
            aria-label={$_("native.call.minimise")}
            onclick={onMinimise}
        >
            <span class="glyph" style:mask="var(--icon-chevron-down) center/contain no-repeat"></span>
        </button>
        <span class="heading">
            <span class="title">{title}</span>
            <span class="status">{status}</span>
        </span>
        <span class="count" aria-label={$_("native.call.inCall", { values: { count } })}>
            <span class="count-glyph"></span>{count}
        </span>
    </div>

    {#if video}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="stage" class:grown={!chrome.shown} onclick={() => chrome.tapStage()}>
            <div
                class="tiles"
                style:grid-template-columns={stage.columns === 1
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))"}
            >
                {#each stage.tiles as tile (tile.id)}
                    <VideoTile
                        nameLabel={tile.name}
                        initial={tile.initial}
                        grad={tile.grad}
                        avatarUrl={tile.avatarUrl}
                        stream={tile.stream}
                        mirror={tile.self}
                        muted={tile.muted}
                        speaking={tile.speaking}
                        big={stage.tiles.length <= 2}
                        radius={10}
                        ratio={0}
                    />
                {/each}
            </div>
            {#if stage.floatSelf && view.self !== undefined}
                <SnapFloat
                    sides
                    width={104}
                    inset={12}
                    safeTop={12}
                    safeBottom={12}
                    position={selfSpot}
                    label={$_("native.call.yourCamera")}
                    onSnap={(spot) => (selfSpot = spot as typeof selfSpot)}
                >
                    <div class="self">
                        <VideoTile
                            nameLabel={$_("native.call.you")}
                            initial={view.self.initial}
                            grad={view.self.grad}
                            avatarUrl={view.self.avatarUrl}
                            stream={view.self.stream}
                            mirror
                            muted={view.self.muted}
                            radius={10}
                            ratio={104 / 140}
                        />
                    </div>
                </SnapFloat>
            {/if}
        </div>
    {:else}
        <div class="voice">
            <div class="voices" class:pair={stage.tiles.length <= 2}>
                {#each stage.tiles as tile (tile.id)}
                    <span class="person">
                        <span class="avatar" class:speaking={tile.speaking} style:background={tile.grad}>
                            {@render face(tile.avatarUrl, tile.initial)}
                            {#if tile.muted}
                                <span class="muted"><span class="muted-glyph"></span></span>
                            {/if}
                        </span>
                        <span class="name">{tile.name}</span>
                    </span>
                {/each}
            </div>
        </div>
    {/if}

    <div class="controls" class:hidden={!chrome.shown} inert={!chrome.shown}>
        {#each controls as control (control.id)}
            <span class="control">
                <button
                    type="button"
                    class="button"
                    class:on={control.on}
                    class:danger={control.id === "leave"}
                    aria-label={$_(control.label)}
                    aria-pressed={control.id === "leave" ? undefined : control.on}
                    onclick={() => press(control.id)}
                >
                    <span
                        class="glyph"
                        style:mask="var(--icon-{control.icon}) center/contain no-repeat"
                    ></span>
                </button>
                <span class="label">{$_(control.label)}</span>
            </span>
        {/each}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .call {
        position: fixed;
        inset: 0;
        z-index: calc(var(--z-modal) + 6);
        display: flex;
        flex-direction: column;
        background: #050507;
        color: #fff;
        animation: call-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);

        @include reduced-motion {
            animation: none;
        }
    }

    @keyframes call-in {
        from {
            transform: translateY(100%);
        }
    }

    .top {
        position: relative;
        z-index: 2;
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: calc(var(--safe-top) + 8px) 8px 8px 6px;
    }

    .round {
        flex: none;
        width: var(--touch-target, 44px);
        height: var(--touch-target, 44px);
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.08);
        cursor: pointer;
    }

    .glyph {
        width: 20px;
        height: 20px;
        background: #fff;
    }

    .heading {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-align: center;
    }

    .title {
        max-width: 100%;
        font: 700 16px/1.2 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .status {
        min-height: 13px;
        font: 500 12.5px/1 var(--font-mono);
        color: rgba(255, 255, 255, 0.65);
    }

    .count {
        flex: none;
        min-width: var(--touch-target, 44px);
        height: var(--touch-target, 44px);
        box-sizing: border-box;
        padding: 0 12px;
        border-radius: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        font: 600 13px/1 var(--font-sans);
    }

    .count-glyph {
        width: 16px;
        height: 16px;
        background: #fff;
        mask: var(--icon-users) center/contain no-repeat;
    }

    // the controls' height (14px above, 52px button, 6px, the label) with the safe area under them
    .stage {
        --controls-h: calc(var(--safe-bottom) + 83px);
        position: relative;
        flex: 1;
        min-height: 0;
        padding: 4px 8px 8px;
        transition: margin 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);

        &.grown {
            margin-bottom: calc(-0.5 * var(--controls-h));
        }
    }

    .tiles {
        height: 100%;
        display: grid;
        grid-auto-rows: minmax(0, 1fr);
        gap: 8px;

        // a tile fills its cell, whatever the feed's shape
        :global(.tile) {
            height: 100%;
        }

        // the active speaker's ring is green on the call screen (design notes §3.5)
        :global(.ring.speaking) {
            box-shadow: inset 0 0 0 2.5px var(--status-online);
        }
    }

    .self {
        width: 104px;
        height: 140px;
        border-radius: 10px;
        overflow: hidden;
        box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.55),
            0 0 0 1.5px rgba(255, 255, 255, 0.18);
    }

    .voice {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px 24px;
    }

    .voices {
        --av: 72px;
        --w: 88px;
        --fs: 13px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 26px 22px;
        max-width: 320px;

        &.pair {
            --av: 104px;
            --w: 150px;
            --fs: 16px;
        }
    }

    .person {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        width: var(--w);
    }

    .avatar {
        position: relative;
        flex: none;
        display: grid;
        place-items: center;
        width: var(--av);
        height: var(--av);
        border-radius: 50%;
        font: 700 calc(var(--av) * 0.38) / 1 var(--font-sans);
        color: #0e0e12;
        transition: box-shadow 0.25s;

        &.speaking {
            box-shadow:
                0 0 0 3px #050507,
                0 0 0 6px var(--status-online);
        }
    }

    .face-image {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }

    .muted {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #2a2a33;
        box-shadow: 0 0 0 3px #050507;
        display: grid;
        place-items: center;
    }

    .muted-glyph {
        width: 13px;
        height: 13px;
        background: #fff;
        mask: var(--icon-mic-off) center/contain no-repeat;
    }

    .name {
        max-width: 100%;
        font: 600 var(--fs) / 1.2 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .controls {
        position: relative;
        z-index: 2;
        flex: none;
        display: flex;
        justify-content: space-evenly;
        padding: 14px 8px calc(var(--safe-bottom) + 12px);
        transition:
            opacity 0.3s ease,
            transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);

        &.hidden {
            opacity: 0;
            transform: translateY(16px);
        }
    }

    .control {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 60px;
    }

    .button {
        width: 52px;
        height: 52px;
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: background 0.15s;

        .glyph {
            width: 21px;
            height: 21px;
        }

        &.on {
            background: #fff;

            .glyph {
                background: #0b0b10;
            }
        }

        &.danger {
            background: var(--status-danger);
        }

        &:active {
            filter: brightness(1.15);
        }
    }

    .label {
        font: 500 11.5px/1 var(--font-sans);
        color: rgba(255, 255, 255, 0.7);
        white-space: nowrap;
    }
</style>
