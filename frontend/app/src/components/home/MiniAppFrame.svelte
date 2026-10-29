<script lang="ts">
    import {
        currentUserIdStore,
        miniAppCardsStore,
        miniAppCardView,
        miniAppGameKey,
        type OpenChat,
    } from "@client";
    import { MiniAppActions } from "@src/logic/miniApp/miniAppActions.svelte";
    import { MiniAppHost } from "@src/logic/miniApp/miniAppHost.svelte";
    import type { OpenMiniApp } from "@src/logic/miniApp/openMiniApp.svelte";
    import { MINI_APP_SANDBOX } from "@src/utils/miniApp";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import Button from "../Button.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // fixed for the frame's life: a different game gets a frame of its own
        app: OpenMiniApp;
        onClose: () => void;
    }

    let { app, onClose }: Props = $props();

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
    const actions = untrack(() => new MiniAppActions(client, app.game));
    let url = $derived(app.url);
    let botName = $derived(app.botName);
    // Joining and leaving are only ever OpenChat's own buttons, never the app's
    let joinOrLeave = $derived(
        miniAppCardView(
            app.content,
            $miniAppCardsStore.get(miniAppGameKey(app.game)),
            $currentUserIdStore,
        ).actions.filter((a) => a === "join" || a === "leave"),
    );

    let iframe: HTMLIFrameElement | undefined = $state();

    $effect(() => {
        // null once the frame's removed, when the game's closed
        const frame = iframe;
        if (!frame) return;
        return untrack(() => host.open(frame));
    });
    $effect(() => host.setDarkMode(darkMode));
</script>

<Overlay dismissible {onClose}>
    <ModalContent large closeIcon {onClose}>
        {#snippet header()}
            <div class="header">
                <div class="title">
                    <div class="name">{botName}</div>
                    <!-- The host is shown so the user can see where the app comes from -->
                    <div class="host">{url.host}</div>
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
            </div>
            {#if actions.error !== undefined}
                <div class="action-error">
                    <Translatable resourceKey={actions.error} />
                </div>
            {/if}
        {/snippet}
        {#snippet body()}
            <div class="app">
                {#if host.status.kind === "closed"}
                    <div class="closed">
                        <AlertCircleOutline size={"2em"} color={"var(--error)"} />
                        <Translatable resourceKey={host.status.message} />
                    </div>
                {:else}
                    <iframe
                        title={botName}
                        bind:this={iframe}
                        src={url.href}
                        sandbox={MINI_APP_SANDBOX}
                        referrerpolicy="no-referrer"></iframe>
                {/if}
            </div>
        {/snippet}
        {#snippet footer()}{/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .title {
        display: flex;
        flex-direction: column;
        gap: $sp1;
        flex: auto;
    }

    .host {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
    }

    .action-error {
        margin-top: $sp2;
        @include font(book, normal, fs-80);
        color: var(--error);
    }

    .app {
        height: min(75vh, 720px);
    }

    iframe {
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
        text-align: center;
    }
</style>
