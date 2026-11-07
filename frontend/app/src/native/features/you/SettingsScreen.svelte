<!-- A You tab settings page (native design notes §3.11): the page's header with Back, and its cards
     from the kit's settings rows (SettingsGroup and the Settings* rows), scrolling, with the pushed
     screens' end padding. Each page is its own component under ./settings. -->
<script lang="ts">
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { Component } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen, SettingsPage } from "../../router/locations";
    import type { ScreenContext, ScreenProps } from "../app/screens";
    import AccountPage from "./settings/AccountPage.svelte";
    import AppearancePage from "./settings/AppearancePage.svelte";
    import BotsPage from "./settings/BotsPage.svelte";
    import ChatsPage from "./settings/ChatsPage.svelte";
    import ChitPage from "./settings/ChitPage.svelte";
    import CommunitiesPage from "./settings/CommunitiesPage.svelte";
    import NotificationsPage from "./settings/NotificationsPage.svelte";
    import StoragePage from "./settings/StoragePage.svelte";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "settings" }>> = $props();

    // a page that toasts or opens a sheet gets the screen's context
    type Page =
        | { title: string; context: true; component: Component<{ context: ScreenContext }> }
        | { title: string; context: false; component: Component };

    const PAGES: Record<SettingsPage, Page> = {
        appearance: {
            title: "native.you.appearance.title",
            context: false,
            component: AppearancePage,
        },
        notifications: {
            title: "native.you.notifications.title",
            context: false,
            component: NotificationsPage,
        },
        chats: { title: "native.you.chats.title", context: false, component: ChatsPage },
        communities: {
            title: "native.you.communities.title",
            context: true,
            component: CommunitiesPage,
        },
        storage: { title: "native.you.storage.title", context: true, component: StoragePage },
        bots: { title: "native.you.bots.title", context: true, component: BotsPage },
        account: { title: "native.you.account.title", context: true, component: AccountPage },
        chit: { title: "native.you.chit.title", context: false, component: ChitPage },
    };

    const page = $derived(PAGES[screen.page]);
</script>

<div class="settings">
    <NativePageHeader title={$_(page.title)} onBack={context.back} />
    <div class="body">
        {#if page.context}
            <page.component {context} />
        {:else}
            <page.component />
        {/if}
    </div>
</div>

<style lang="scss">
    .settings {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }
</style>
