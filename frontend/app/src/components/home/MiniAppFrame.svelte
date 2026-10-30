<script lang="ts">
    import {
        currentUserIdStore,
        miniAppCardsStore,
        miniAppCardView,
        miniAppGameKey,
        type MiniAppCardView,
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
    import Close from "svelte-material-icons/Close.svelte";
    import Fullscreen from "svelte-material-icons/Fullscreen.svelte";
    import FullscreenExit from "svelte-material-icons/FullscreenExit.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import Button from "../Button.svelte";
    import HoverIcon from "../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // the game's fixed for the frame's life: a different game gets a frame of its own. Its card
        // (`app.content`) follows the message.
        app: HostedMiniApp;
        // the card's, so a request from either shows on both
        actions: MiniAppActions;
        // the card's too, which keeps the frame while it's full screen
        fullScreen: MiniAppFullScreen;
        // whether the card's on screen, when the app runs in the frame
        active: boolean;
        // the card as it's shown, live or as stored
        view: MiniAppCardView;
        // the app's artwork, shown whenever there's no app to show
        imageUrl: string | undefined;
    }

    let { app, actions, fullScreen, active, view, imageUrl }: Props = $props();

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
    let finished = $derived(view.status === "finished");
    // The app's shown while the user may open the game, and once it's over if the card records how
    // it ended, which the app shows. Otherwise the frame shows the app's artwork instead. The
    // artwork's also under the app until it's loaded, and while the card's off screen.
    let showApp = $derived(view.showsApp);
    // over the app, or its artwork, once the game's over
    let label = $derived(
        finished ? (view.result ?? interpolate($_, i18nKey("bots.miniApp.finished"))) : undefined,
    );
    // the user's taken the label off the finished game's app, to look through it, until the card's
    // shown afresh
    let dismissed = $state(false);
    // whether the app in the frame has loaded, when it's shown in place of the artwork
    let loaded = $state(false);
    // an image which couldn't be loaded, so the box is left plain
    let failedImage: string | undefined = $state();

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
        return untrack(() => {
            const close = host.open(frame);
            return () => {
                close();
                // the next frame starts unloaded
                loaded = false;
            };
        });
    });
    $effect(() => host.setContent(app.content));
    $effect(() => host.setDarkMode(darkMode));
    // While the app's away, whatever became of its last opening is forgotten, so that it's opened
    // afresh when it's back: eg. an opening which failed while the service was unreachable
    $effect(() => {
        if (!active) {
            untrack(() => host.reset());
            dismissed = false;
        }
    });
    // Nothing to see full screen but the artwork
    $effect(() => {
        if (!showApp) untrack(() => fullScreen.exit());
    });
</script>

<!-- The result, or that the game's over, across the frame's box. Over the app it's a button, which
takes it away so the user can look through the game. -->
{#snippet overlay(dismissible: boolean)}
    {#if dismissible}
        <button
            type="button"
            class="overlay dismissible"
            title={$_("close")}
            onclick={() => (dismissed = true)}>
            <span class="label">{label}</span>
            <span class="close"><Close size={"1.2em"} color={"currentColor"} /></span>
        </button>
    {:else}
        <div class="overlay">
            <span class="label">{label}</span>
        </div>
    {/if}
{/snippet}

<!-- A dialog, open in place, so that full screen can put it in the top layer without reloading the
app (MiniAppFullScreen) -->
<dialog bind:this={dialog} open class="frame" class:full-screen={fullScreen.on}>
    <!-- In the card the frame is just the app, as the message says who posted it. Full screen has
    a bar: the bot and where its app comes from, the card's buttons, and the way back. -->
    {#if fullScreen.on}
        <div class="bar">
            <div class="title">
                <span class="name">{botName}</span>
                <span class="host">{url.host}</span>
            </div>
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
            <HoverIcon
                compact
                title={$_("bots.miniApp.exitFullScreen")}
                onclick={() => fullScreen.exit()}>
                <FullscreenExit size={"1.4em"} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
    {/if}
    {#if fullScreen.on && actions.error !== undefined}
        <div class="action-error">
            <Translatable resourceKey={actions.error} />
        </div>
    {/if}
    <div class="app" style={`--app-w: ${size.width}; --app-h: ${size.height};`}>
        {#if showApp && host.status.kind === "closed"}
            <div class="closed">
                <AlertCircleOutline size={"2em"} color={"var(--error)"} />
                <Translatable resourceKey={host.status.message} />
            </div>
        {:else}
            <!-- The artwork, whenever there's no loaded app over it -->
            {#if !showApp || !active || !loaded}
                <div class="cover">
                    {#if imageUrl !== undefined && imageUrl !== failedImage}
                        <img src={imageUrl} alt="" onerror={() => (failedImage = imageUrl)} />
                    {/if}
                    {#if !showApp && label !== undefined}
                        {@render overlay(false)}
                    {/if}
                </div>
            {/if}
            {#if showApp && active}
                <iframe
                    title={botName}
                    bind:this={iframe}
                    src={url.href}
                    sandbox={MINI_APP_SANDBOX}
                    referrerpolicy="no-referrer"
                    onload={() => (loaded = true)}></iframe>
            {/if}
            {#if showApp && label !== undefined && !dismissed}
                {@render overlay(true)}
            {/if}
        {/if}
        {#if MiniAppFullScreen.supported && showApp && !fullScreen.on && (label === undefined || dismissed)}
            <button
                type="button"
                class="corner"
                title={$_("bots.miniApp.fullScreen")}
                onclick={() => fullScreen.enter()}>
                <Fullscreen size={"1.2em"} color={"currentColor"} />
            </button>
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
        position: relative;
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

    // over the artwork, which shows through until the app's loaded
    iframe {
        position: absolute;
        inset: 0;
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

    .cover {
        height: 100%;
        width: 100%;

        img {
            display: block;
            height: 100%;
            width: 100%;
            object-fit: cover;
        }
    }

    // Across the box, with the label in the middle. Readable over any artwork, so not themed.
    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: $sp3;
        margin: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        text-align: center;

        &.dismissible {
            cursor: pointer;

            &:focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: -2px;
            }
        }
    }

    .label {
        @include font(bold, normal, fs-110);
        padding: $sp2 $sp4;
        border-radius: $sp5;
        background-color: rgba(0, 0, 0, 0.65);
        color: #fff;
        overflow-wrap: anywhere;
    }

    .close,
    .corner {
        position: absolute;
        top: $sp2;
        right: $sp2;
        display: flex;
        padding: $sp1;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.65);
        color: #fff;
    }

    // over the app, out of its way in a corner, and out of sight until the pointer's over the frame
    // where there is one
    .corner {
        z-index: 1;
        border: none;
        cursor: pointer;
        opacity: 0.7;

        @media (hover: hover) {
            opacity: 0;

            .frame:hover &,
            &:focus-visible {
                opacity: 0.7;
            }
        }

        &:hover,
        &:focus-visible {
            opacity: 1;
        }
    }
</style>
