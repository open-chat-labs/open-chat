<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Avatar, MenuItem, SectionHeader } from "component-lib";
    import type { DirectChatSummary, ExternalBot, OpenChat } from "openchat-client";
    import {
        allUsersStore,
        chatListScopeStore,
        currentUserIdStore,
        definitionToPermissions,
        directChatBotsStore,
        favouritesStore,
        publish,
        routeForScope,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinus.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlus.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: DirectChatSummary;
        bot: ExternalBot;
        onSearchChat: (term: string) => void;
    }

    let { chat, bot, onSearchChat }: Props = $props();
    let botUser = $derived($allUsersStore.get(chat.them.userId));
    let grantedPermissions = $derived(
        $directChatBotsStore.get(bot.id) ?? definitionToPermissions(bot.definition),
    );

    function addToFavourites() {
        client.addToFavourites(chat.id);
    }

    function removeFromFavourites() {
        client.removeFromFavourites(chat.id);
    }

    function searchChat() {
        onSearchChat("");
    }

    function removeBot() {
        page(routeForScope($chatListScopeStore));
        client
            .uninstallBot({ kind: "direct_chat", userId: $currentUserIdStore }, bot.id)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
                }
            });
    }

    function viewBotDetails() {
        publish("showBot", { bot, collection: chat, grantedPermissions });
    }
</script>

<SectionHeader onBack={() => publish("clearSelection")}>
    {#snippet avatar()}
        <Avatar url={client.userAvatarUrl(botUser)} size={"lg"} />
    {/snippet}

    {#snippet title()}
        {client.displayName(botUser)}
    {/snippet}

    {#snippet subtitle()}
        <Translatable resourceKey={i18nKey("Use bot commands below")} />
    {/snippet}

    {#snippet menu()}
        {#if !$favouritesStore.has(chat.id)}
            <MenuItem danger onclick={addToFavourites}>
                {#snippet icon(color, size)}
                    <HeartPlus {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("communities.addToFavourites")} />
            </MenuItem>
        {:else}
            <MenuItem danger onclick={removeFromFavourites}>
                {#snippet icon(color, size)}
                    <HeartMinus {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("communities.removeFromFavourites")} />
            </MenuItem>
        {/if}
        <MenuItem onclick={searchChat}>
            {#snippet icon(color, size)}
                <Magnify {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("searchChat")} />
        </MenuItem>

        <MenuItem onclick={() => removeBot()}>
            {#snippet icon(color, size)}
                <DeleteOutline {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("bots.manage.remove")} />
        </MenuItem>

        <MenuItem onclick={() => viewBotDetails()}>
            {#snippet icon(color, size)}
                <TextBoxOutline {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("bots.manage.view")} />
        </MenuItem>
    {/snippet}
</SectionHeader>
