<script lang="ts">
    import {
        currentUserIdStore,
        miniAppCardsStore,
        miniAppCardView,
        miniAppGameKey,
        type OpenChat,
    } from "@client";
    import type { MiniAppActions } from "@src/logic/miniApp/miniAppActions.svelte";
    import { MiniAppFullScreen } from "@src/logic/miniApp/miniAppFrame.svelte";
    import { MiniAppHost, type HostedMiniApp } from "@src/logic/miniApp/miniAppHost.svelte";
    import { MINI_APP_SANDBOX } from "@src/utils/miniApp";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import Fullscreen from "svelte-material-icons/Fullscreen.svelte";
    import FullscreenExit from "svelte-material-icons/FullscreenExit.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import Button from "../Button.svelte";
    import HoverIcon from "../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // fixed for the frame's life: a different game gets a frame of its own
        app: HostedMiniApp;
        // the card's, so a request from either shows on both
        actions: MiniAppActions;
        // the card's too, which keeps the frame while it's full screen
        fullScreen: MiniAppFullScreen;
        // whether the app's running in the frame, which otherwise keeps the app's place in the card
        active: boolean;
    }

    let { app, actions, fullScreen, active }: Props = $props();

    let darkMode = $derived($currentTheme.mode === "dark");
    const host = untrack(
        () =>
            new MiniAppHost(client, app, {
                userId: $currentUserIdStore,
                darkMode,
                locale: () => $locale ?? "en",
                translate: (key) => interpolate($_, key),
            }),
    );
    let url = $derived(app.url);
    let botName = $derived(app.botName);
    // the size the app's designed for, which gives the frame its aspect ratio
    let size = $derived(app.content.appSize);
    // Joining and leaving are only ever OpenChat's own buttons, never the app's. The card's are
    // hidden in full screen, so the frame has its own there.
    let joinOrLeave = $derived(
        miniAppCardView(
            app.content,
            $miniAppCardsStore.get(miniAppGameKey(app.game)),
            $currentUserIdStore,
        ).actions,
    );

    let dialog: HTMLDialogElement | undefined = $state();
    let iframe: HTMLIFrameElement | undefined = $state();

    $effect(() => {
        const el = dialog;
        if (!el) return;
        return untrack(() => fullScreen.attach(el));
    });
    $effect(() => {
        // null once the frame's removed, when the game's closed
        const frame = iframe;
        if (!frame) return;
        return untrack(() => host.open(frame));
    });
    $effect(() => host.setDarkMode(darkMode));
    // While the app's away, whatever became of its last opening is forgotten, so that it's opened
    // afresh when it's back: eg. an opening which failed while the service was unreachable
    $effect(() => {
        if (!active) untrack(() => host.reset());
    });
</script>

<!-- A dialog, open in place, so that full screen can put it in the top layer without reloading the
app (MiniAppFullScreen) -->
<dialog bind:this={dialog} open class="frame" class:full-screen={fullScreen.on}>
    <div class="bar">
        <div class="title">
            <span class="name">{botName}</span>
            <!-- The host is shown so the user can see where the app comes from -->
            <span class="host">{url.host}</span>
        </div>
        {#if fullScreen.on}
            {#each joinOrLeave as action (action)}
                <Button
                    tiny
                    secondary={action === "leave"}
                    loading={actions.busy === action}
                    disabled={actions.busy !== undefined}
                    onClick={() => (action === "join" ? actions.join() : actions.leave())}>
                    <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                </Button>
            {/each}
        {/if}
        {#if MiniAppFullScreen.supported}
            <HoverIcon
                compact
                title={$_(
                    fullScreen.on ? "bots.miniApp.exitFullScreen" : "bots.miniApp.fullScreen",
                )}
                onclick={() => fullScreen.toggle()}>
                {#if fullScreen.on}
                    <FullscreenExit size={"1.4em"} color={"var(--icon-txt)"} />
                {:else}
                    <Fullscreen size={"1.4em"} color={"var(--icon-txt)"} />
                {/if}
            </HoverIcon>
        {/if}
    </div>
    {#if fullScreen.on && actions.error !== undefined}
        <div class="action-error">
            <Translatable resourceKey={actions.error} />
        </div>
    {/if}
    <div class="app" style={`--app-w: ${size.width}; --app-h: ${size.height};`}>
        {#if host.status.kind === "closed"}
            <div class="closed">
                <AlertCircleOutline size={"2em"} color={"var(--error)"} />
                <Translatable resourceKey={host.status.message} />
            </div>
        {:else if active}
            <iframe
                title={botName}
                bind:this={iframe}
                src={url.href}
                sandbox={MINI_APP_SANDBOX}
                referrerpolicy="no-referrer"></iframe>
        {/if}
    </div>
</dialog>

<style lang="scss">
    .frame {
        // in place in the card, rather than where a dialog puts itself
        position: static;
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: none;
        max-height: none;
        margin: $sp3 0 0 0;
        padding: 0;
        border: 1px solid var(--modal-bd);
        border-radius: var(--rd);
        overflow: hidden;
        background-color: var(--modal-bg);
        color: var(--txt);

        &:not([open]) {
            display: none;
        }

        &:modal {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            margin: 0;
            border: none;
            border-radius: 0;
            // so a scroll over it doesn't scroll the chat behind it
            overscroll-behavior: contain;
        }

        &::backdrop {
            background-color: rgba(0, 0, 0, 0.6);
        }
    }

    .bar {
        display: flex;
        align-items: center;
        gap: $sp3;
        padding: $sp2 $sp3;
        border-bottom: 1px solid var(--modal-bd);
    }

    .title {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: $sp1 $sp3;
        flex: auto;
        min-width: 0;
    }

    .name {
        @include font(bold, normal, fs-90);
    }

    .host {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .action-error {
        padding: $sp2 $sp3 0 $sp3;
        @include font(book, normal, fs-80);
        color: var(--error);
    }

    .app {
        // at the app's aspect ratio, no taller than most of the screen
        width: min(100%, calc(75dvh * var(--app-w) / var(--app-h)));
        aspect-ratio: var(--app-w) / var(--app-h);
        margin: 0 auto;

        .full-screen & {
            flex: auto;
            width: auto;
            height: auto;
            min-height: 0;
            aspect-ratio: auto;
            // auto margins would stop the flex column stretching it
            margin: 0;
        }
    }

    iframe {
        display: block;
        border: none;
        height: 100%;
        width: 100%;
    }

    .closed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: $sp3;
        height: 100%;
        padding: $sp3;
        text-align: center;
    }
</style>
