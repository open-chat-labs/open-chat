<script lang="ts">
    import type { DirectChatSummary, ExternalBot } from "openchat-client";
    import {
        app,
        AvatarSize,
        flattenCommandPermissions,
        type OpenChat,
        publish,
        ui,
        userStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinus.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlus.svelte";
    import KeyPlus from "svelte-material-icons/KeyPlus.svelte";
    import KeyRemove from "svelte-material-icons/KeyRemove.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import InfoIcon from "../InfoIcon.svelte";
    import Link from "../Link.svelte";
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
    // TODO: Why is this called botUser?
    let botUser = $derived($userStore.get(chat.them.userId));
    let apiKey = $derived(app.directChatApiKeys.get(bot.id));
    let grantedPermissions = $derived(
        app.directChatBots.get(bot.id) ?? flattenCommandPermissions(bot.definition),
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

<WithBotManagement collection={chat} {bot} canManage {grantedPermissions} {apiKey}>
    {#snippet contents({
        canGenerateKey,
        reviewApiKey,
        generateApiKey,
        removeBot,
        reviewCommandPermissions,
        viewBotDetails,
        apiKeyPermissions,
        generatingKey,
    })}
        <SectionHeader shadow flush>
            {#if ui.mobileWidth}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="back" class:rtl={$rtlStore} onclick={() => publish("clearSelection")}>
                    <HoverIcon>
                        {#if $rtlStore}
                            <ArrowRight size={ui.iconSize} color={"var(--icon-txt)"} />
                        {:else}
                            <ArrowLeft size={ui.iconSize} color={"var(--icon-txt)"} />
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
                {#if canGenerateKey}
                    <div class="chat-subtext apikey">
                        <Link
                            onClick={apiKeyPermissions !== undefined
                                ? reviewApiKey
                                : generateApiKey}
                            underline="never">
                            <Translatable
                                resourceKey={apiKeyPermissions !== undefined
                                    ? i18nKey("bots.manage.reviewApiKey")
                                    : i18nKey("bots.manage.generateApiKey")}></Translatable>
                        </Link>
                        {#if generatingKey}
                            <div class="spinner"></div>
                        {:else}
                            <InfoIcon>
                                <Translatable
                                    resourceKey={apiKeyPermissions !== undefined
                                        ? i18nKey("bots.manage.deleteApiKeyInfo")
                                        : i18nKey("bots.manage.apiKeyInfo")}></Translatable>
                            </InfoIcon>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="menu">
                <MenuIcon position={"bottom"} align={"end"}>
                    {#snippet menuIcon()}
                        <HoverIcon title={$_("chatMenu")}>
                            <DotsVertical size={ui.iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {/snippet}
                    {#snippet menuItems()}
                        <Menu>
                            {#if !app.favourites.has(chat.id)}
                                <MenuItem onclick={addToFavourites}>
                                    {#snippet icon()}
                                        <HeartPlus size={ui.iconSize} color={"var(--menu-warn)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable
                                            resourceKey={i18nKey("communities.addToFavourites")} />
                                    {/snippet}
                                </MenuItem>
                            {:else}
                                <MenuItem onclick={removeFromFavourites}>
                                    {#snippet icon()}
                                        <HeartMinus size={ui.iconSize} color={"var(--menu-warn)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable
                                            resourceKey={i18nKey(
                                                "communities.removeFromFavourites",
                                            )} />
                                    {/snippet}
                                </MenuItem>
                            {/if}
                            {#if ui.mobileWidth}
                                <MenuItem onclick={searchChat}>
                                    {#snippet icon()}
                                        <Magnify
                                            size={ui.iconSize}
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
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                                {/snippet}
                            </MenuItem>

                            <MenuItem onclick={() => reviewCommandPermissions()}>
                                {#snippet icon()}
                                    <PencilOutline
                                        size={ui.iconSize}
                                        color={"var(--icon-inverted-txt)"} />
                                {/snippet}
                                {#snippet text()}
                                    <Translatable resourceKey={i18nKey("bots.manage.review")} />
                                {/snippet}
                            </MenuItem>

                            {#if canGenerateKey}
                                {#if apiKeyPermissions !== undefined}
                                    <MenuItem onclick={reviewApiKey}>
                                        {#snippet icon()}
                                            <KeyRemove
                                                size={ui.iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <Translatable
                                                resourceKey={i18nKey("bots.manage.reviewApiKey")} />
                                        {/snippet}
                                    </MenuItem>
                                {:else}
                                    <MenuItem onclick={() => generateApiKey()}>
                                        {#snippet icon()}
                                            <KeyPlus
                                                size={ui.iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <Translatable
                                                resourceKey={i18nKey(
                                                    "bots.manage.generateApiKey",
                                                )} />
                                        {/snippet}
                                    </MenuItem>
                                {/if}
                            {/if}
                            <MenuItem onclick={() => viewBotDetails()}>
                                {#snippet icon()}
                                    <TextBoxOutline
                                        size={ui.iconSize}
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

    .chat-subtext {
        @include font(book, normal, fs-80);
        @include ellipsis();
        color: var(--txt-light);
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

    .apikey {
        display: flex;
        gap: $sp2;
        align-items: center;
        @include font(book, normal, fs-80);
    }
</style>
