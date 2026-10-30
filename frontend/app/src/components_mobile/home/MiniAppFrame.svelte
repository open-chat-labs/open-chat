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
    import { BodySmall, Button, Caption, IconButton } from "component-lib";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Fullscreen from "svelte-material-icons/Fullscreen.svelte";
    import FullscreenExit from "svelte-material-icons/FullscreenExit.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";

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
    <div class="bar">
        <div class="title">
            <BodySmall fontWeight={"bold"} width={"hug"}>{botName}</BodySmall>
            <!-- The host is shown so the user can see where the app comes from -->
            <Caption colour={"textSecondary"} width={"hug"}>{url.host}</Caption>
        </div>
        {#if fullScreen.on}
            {#each joinOrLeave as action (action)}
                <Button
                    width={"hug"}
                    secondary={action === "leave"}
                    loading={actions.busy === action}
                    disabled={actions.busy !== undefined}
                    onClick={() => (action === "join" ? actions.join() : actions.leave())}>
                    <Translatable resourceKey={i18nKey(`bots.miniApp.${action}`)} />
                </Button>
            {/each}
        {/if}
        {#if MiniAppFullScreen.supported && showApp}
            <IconButton padding={"xs"} size={"sm"} onclick={() => fullScreen.toggle()}>
                {#snippet icon(color)}
                    {#if fullScreen.on}
                        <FullscreenExit {color} />
                    {:else}
                        <Fullscreen {color} />
                    {/if}
                {/snippet}
            </IconButton>
        {/if}
    </div>
    {#if fullScreen.on && actions.error !== undefined}
        <div class="action-error">
            <BodySmall colour={"validationError"}>
                <Translatable resourceKey={actions.error} />
            </BodySmall>
        </div>
    {/if}
    <div class="app" style={`--app-w: ${size.width}; --app-h: ${size.height};`}>
        {#if showApp && host.status.kind === "closed"}
            <div class="closed">
                <AlertCircleOutline size={"2em"} color={"var(--validation-error)"} />
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
        margin: 0;
        padding: 0;
        border: none;
        border-radius: var(--rad-md);
        overflow: hidden;
        background-color: var(--surface-1);
        color: var(--text-primary);

        &:not([open]) {
            display: none;
        }

        &:modal {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100dvh;
            border-radius: 0;
            // so a scroll over it doesn't scroll the chat behind it
            overscroll-behavior: contain;
        }

        &::backdrop {
            background-color: var(--backdrop);
        }
    }

    .bar {
        display: flex;
        align-items: center;
        gap: var(--sp-md);
        padding: var(--sp-xs) var(--sp-sm);
    }

    .title {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--sp-xxs) var(--sp-sm);
        flex: auto;
        min-width: 0;
    }

    .action-error {
        padding: 0 var(--sp-sm) var(--sp-xs) var(--sp-sm);
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
        gap: var(--sp-md);
        height: 100%;
        padding: var(--sp-md);
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
        padding: var(--sp-md);
        margin: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        text-align: center;

        &.dismissible {
            cursor: pointer;

            &:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: -2px;
            }
        }
    }

    .label {
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);
        font-weight: var(--font-weight-bold);
        padding: var(--sp-xs) var(--sp-lg);
        border-radius: var(--rad-circle);
        background-color: rgba(0, 0, 0, 0.65);
        color: #fff;
        overflow-wrap: anywhere;
    }

    .close {
        position: absolute;
        top: var(--sp-xs);
        right: var(--sp-xs);
        display: flex;
        padding: var(--sp-xxs);
        border-radius: var(--rad-circle);
        background-color: rgba(0, 0, 0, 0.65);
        color: #fff;
    }
</style>
