<script lang="ts">
    import type { OpenChat } from "@client";
    import { MiniAppHost } from "@src/logic/miniApp/miniAppHost.svelte";
    import type { OpenMiniApp } from "@src/logic/miniApp/openMiniApp.svelte";
    import { MINI_APP_SANDBOX } from "@src/utils/miniApp";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext, untrack } from "svelte";
    import { locale } from "svelte-i18n";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { currentTheme } from "../../theme/themes";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // fixed for the frame's life: a different app gets a frame of its own
        app: OpenMiniApp;
        onClose: () => void;
    }

    let { app, onClose }: Props = $props();

    const host = untrack(() => new MiniAppHost(client, app));
    let url = $derived(app.url);
    let botName = $derived(app.botName);

    let iframe: HTMLIFrameElement | undefined = $state();
    let darkMode = $derived($currentTheme.mode === "dark");

    $effect(() => {
        // null once the frame's removed, eg. when the app couldn't be opened
        const frame = iframe;
        if (!frame) return;
        return untrack(() => host.attach(frame, darkMode, () => $locale ?? "en"));
    });
    $effect(() => host.setDarkMode(darkMode));
</script>

<Overlay dismissible {onClose}>
    <ModalContent large closeIcon {onClose}>
        {#snippet header()}
            <div class="header">
                <div class="name">{botName}</div>
                <!-- The host is shown so the user can see where the app comes from -->
                <div class="host">{url.host}</div>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="app">
                {#if host.status === "failed"}
                    <div class="error">
                        <AlertCircleOutline size={"2em"} color={"var(--error)"} />
                        <Translatable resourceKey={i18nKey("bots.miniApp.failed")} />
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
        flex-direction: column;
        gap: $sp1;
    }

    .host {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
    }

    .app {
        height: min(75vh, 720px);
    }

    iframe {
        border: none;
        height: 100%;
        width: 100%;
    }

    .error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: $sp3;
        height: 100%;
    }
</style>
