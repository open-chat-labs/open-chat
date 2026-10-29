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
    import { BodySmall, Button, Caption, Column, Row, Sheet, Subtitle } from "component-lib";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";

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

<Sheet onDismiss={onClose}>
    <Column gap={"md"} padding={"lg"}>
        <Row gap={"md"} crossAxisAlignment={"center"}>
            <Column gap={"xs"}>
                <Subtitle fontWeight={"bold"}>{botName}</Subtitle>
                <!-- The host is shown so the user can see where the app comes from -->
                <Caption colour={"textSecondary"}>{url.host}</Caption>
            </Column>
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
        </Row>
        {#if actions.error !== undefined}
            <BodySmall colour={"validationError"}>
                <Translatable resourceKey={actions.error} />
            </BodySmall>
        {/if}
        <div class="app">
            {#if host.status.kind === "closed"}
                <div class="closed">
                    <AlertCircleOutline size={"2em"} color={"var(--validation-error)"} />
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
    </Column>
</Sheet>

<style lang="scss">
    .app {
        height: 75vh;
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
        gap: var(--sp-md);
        height: 100%;
        text-align: center;
    }
</style>
