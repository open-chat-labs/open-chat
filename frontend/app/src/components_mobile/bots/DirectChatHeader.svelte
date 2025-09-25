<script lang="ts">
    import type { DirectChatSummary, ExternalBot } from "openchat-client";
    import {
        allUsersStore,
        AvatarSize,
        definitionToPermissions,
        directChatBotsStore,
        favouritesStore,
        iconSize,
        mobileWidth,
        type OpenChat,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinus.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlus.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import Translatable from "../Translatable.svelte";
    import WithBotManagement from "./WithBotManagement.svelte";

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
</script>

<WithBotManagement collection={chat} {bot} canManage {grantedPermissions}>
    {#snippet contents({ removeBot, reviewPermissions, viewBotDetails })}
        <SectionHeader shadow flush>
            {#if $mobileWidth}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="back" class:rtl={$rtlStore} onclick={() => publish("clearSelection")}>
                    <HoverIcon>
                        {#if $rtlStore}
                            <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                        {:else}
                            <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                        {/if}
                    </HoverIcon>
                </div>
            {/if}

            <div class="avatar">
                <Avatar
                    userId={chat.them.userId}
                    url={client.userAvatarUrl(botUser)}
                    size={AvatarSize.Default} />
            </div>
            <div class="chat-details">
                <div class="chat-name">
                    {client.displayName(botUser)}
                </div>
            </div>

            <div class="menu">
                <MenuIcon position={"bottom"} align={"end"}>
                    {#snippet menuIcon()}
                        <HoverIcon title={$_("chatMenu")}>
                            <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {/snippet}
                    {#snippet menuItems()}
                        <Menu>
                            {#if !$favouritesStore.has(chat.id)}
                                <MenuItem onclick={addToFavourites}>
                                    {#snippet icon()}
                                        <HeartPlus size={$iconSize} color={"var(--menu-warn)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable
                                            resourceKey={i18nKey("communities.addToFavourites")} />
                                    {/snippet}
                                </MenuItem>
                            {:else}
                                <MenuItem onclick={removeFromFavourites}>
                                    {#snippet icon()}
                                        <HeartMinus size={$iconSize} color={"var(--menu-warn)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable
                                            resourceKey={i18nKey(
                                                "communities.removeFromFavourites",
                                            )} />
                                    {/snippet}
                                </MenuItem>
                            {/if}
                            {#if $mobileWidth}
                                <MenuItem onclick={searchChat}>
                                    {#snippet icon()}
                                        <Magnify
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable resourceKey={i18nKey("searchChat")} />
                                    {/snippet}
                                </MenuItem>
                            {/if}

                            <MenuItem onclick={() => removeBot()}>
                                {#snippet icon()}
                                    <DeleteOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                                {/snippet}
                            </MenuItem>

                            <MenuItem onclick={() => reviewPermissions()}>
                                {#snippet icon()}
                                    <PencilOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("bots.manage.review")} />
                                {/snippet}
                            </MenuItem>

                            <MenuItem onclick={() => viewBotDetails()}>
                                {#snippet icon()}
                                    <TextBoxOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("bots.manage.view")} />
                                {/snippet}
                            </MenuItem>
                        </Menu>
                    {/snippet}
                </MenuIcon>
            </div>
        </SectionHeader>
    {/snippet}
</WithBotManagement>

<style lang="scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
        display: flex;
        align-items: center;
        gap: $sp2;
    }

    .avatar {
        flex: 0 0 55px;
    }

    .chat-details {
        flex: 1;
        overflow: auto;
        padding: 0 $sp2;
    }

    .back {
        flex: 0 0 10px;
        margin-right: 5px;

        &.rtl {
            margin-right: 0;
            margin-left: 5px;
        }
    }
</style>
