<script lang="ts">
    import {
        iconSize,
        type CommunitySummary,
        type ExternalBotPermissions,
        type MultiUserChat,
        type PublicApiKeyDetails,
    } from "openchat-client";
    import { type ExternalBot } from "openchat-shared";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import KeyPlus from "svelte-material-icons/KeyPlus.svelte";
    import KeyRemove from "svelte-material-icons/KeyRemove.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import InfoIcon from "../InfoIcon.svelte";
    import Link from "../Link.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "../Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";
    import WithBotManagement from "./WithBotManagement.svelte";

    interface Props {
        collection: CommunitySummary | MultiUserChat;
        bot: ExternalBot;
        canManage: boolean;
        searchTerm: string;
        grantedPermissions: ExternalBotPermissions;
        apiKey: PublicApiKeyDetails | undefined;
    }

    let { collection, bot, canManage, searchTerm, grantedPermissions, apiKey }: Props = $props();
</script>

<WithBotManagement {collection} {bot} {canManage} {grantedPermissions} {apiKey}>
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
        <div class="bot_member" role="button">
            <span class="avatar">
                <BotAvatar {bot} />
            </span>
            <div class="details">
                <div class="bot_name">
                    <h4>
                        <FilteredUsername {searchTerm} username={bot.name} />
                    </h4>
                </div>
                <div class="bot_description">
                    <FilteredUsername {searchTerm} username={bot.definition.description} />
                </div>
                {#if canGenerateKey}
                    <div class="apikey">
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
                                        ? i18nKey("bots.manage.reviewApiKeyInfo")
                                        : i18nKey("bots.manage.apiKeyInfo")}></Translatable>
                            </InfoIcon>
                        {/if}
                    </div>
                {/if}
            </div>
            <MenuIcon position={"bottom"} align={"end"}>
                {#snippet menuIcon()}
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        {#if canManage}
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
                            {#if bot.definition.commands.length > 0}
                                <MenuItem onclick={() => reviewCommandPermissions()}>
                                    {#snippet icon()}
                                        <PencilOutline
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable resourceKey={i18nKey("bots.manage.review")} />
                                    {/snippet}
                                </MenuItem>
                            {/if}
                        {/if}
                        {#if canGenerateKey}
                            {#if apiKeyPermissions !== undefined}
                                <MenuItem onclick={reviewApiKey}>
                                    {#snippet icon()}
                                        <KeyRemove
                                            size={$iconSize}
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
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <Translatable
                                            resourceKey={i18nKey("bots.manage.generateApiKey")} />
                                    {/snippet}
                                </MenuItem>
                            {/if}
                        {/if}
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
    {/snippet}
</WithBotManagement>

<style lang="scss">
    .bot_member {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        gap: 12px;

        @media (hover: hover) {
            &:hover {
                background-color: var(--members-hv);
            }
        }

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
    }

    .details {
        display: flex;
        flex: 1;
        flex-direction: column;
        @include font(medium, normal, fs-100);
        gap: $sp2;

        .bot_name {
            display: flex;
            flex: 1;
            align-items: center;
            @include ellipsis();

            h4 {
                display: flex;
                align-items: center;
                gap: $sp2;
            }
        }

        .bot_description {
            font-weight: 200;
            color: var(--txt-light);
            @include clamp(2);
        }

        .apikey {
            display: flex;
            gap: $sp2;
            align-items: center;
            @include font(book, normal, fs-80);
        }
    }

    .spinner {
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "/assets/plain-spinner.svg");
        flex: 0 0 toRem(24);
    }
</style>
