<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import KeyPlus from "svelte-material-icons/KeyPlus.svelte";
    import KeyRemove from "svelte-material-icons/KeyRemove.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import InfoIcon from "../InfoIcon.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../stores/iconSize";
    import {
        flattenCommandPermissions,
        type BotSummaryMode,
        type ExternalBot,
    } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import type {
        CommunityIdentifier,
        OpenChat,
        ExternalBotPermissions,
        MultiUserChat,
        CommunitySummary,
        PublicApiKeyDetails,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import BotSummary from "./BotSummary.svelte";
    import BotAvatar from "./BotAvatar.svelte";
    import Link from "../Link.svelte";
    import HoverIcon from "../HoverIcon.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | MultiUserChat;
        bot: ExternalBot;
        canManage: boolean;
        searchTerm: string;
        commandPermissions: ExternalBotPermissions;
        apiKey: PublicApiKeyDetails | undefined;
    }

    let { collection, bot, canManage, searchTerm, commandPermissions, apiKey }: Props = $props();
    let botSummaryMode = $state<BotSummaryMode | undefined>(undefined);
    let generatingKey = $state(false);
    let autonomousPermissionsEmpty = $derived(
        bot.definition.autonomousConfig === undefined ||
            permissionsAreEmpty(
                filterRequestedPermissions(bot.definition.autonomousConfig.permissions, collection),
            ),
    );
    let canGenerateKey = $derived(canManage && !autonomousPermissionsEmpty);
    let commandContextId = $derived(
        collection.kind === "channel"
            ? ({ kind: "community", communityId: collection.id.communityId } as CommunityIdentifier)
            : collection.id,
    );
    let apiKeyPermissions = $derived(apiKey?.grantedPermissions);

    function permissionsAreEmpty(perm: ExternalBotPermissions): boolean {
        const empty =
            perm.messagePermissions.length === 0 &&
            perm.chatPermissions.length === 0 &&
            perm.communityPermissions.length === 0;
        return empty;
    }

    function filterRequestedPermissions(
        perm: ExternalBotPermissions,
        scope: CommunitySummary | MultiUserChat,
    ): ExternalBotPermissions {
        if (scope.kind === "community") {
            // chat & message permissions don't apply at the community level
            return {
                ...perm,
                chatPermissions: [],
                messagePermissions: [],
            };
        } else {
            // community permisisons don't apply at the chat level
            return {
                ...perm,
                communityPermissions: [],
            };
        }
    }

    function removeBot() {
        client.uninstallBot(commandContextId, bot.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            }
        });
    }

    function reviewApiKey() {
        if (bot.definition.autonomousConfig !== undefined && apiKeyPermissions !== undefined) {
            botSummaryMode = {
                kind: "editing_api_key",
                id: collection.id,
                requested: bot.definition.autonomousConfig.permissions,
                granted: apiKeyPermissions,
            };
            generatingKey = true;
        }
    }

    function reviewCommandPermissions() {
        botSummaryMode = {
            kind: "editing_command_bot",
            id: commandContextId,
            requested: flattenCommandPermissions(bot.definition),
            granted: commandPermissions,
        };
    }

    function viewBotDetails() {
        botSummaryMode = {
            kind: "viewing_command_bot",
            id: commandContextId,
            requested: flattenCommandPermissions(bot.definition),
            granted: commandPermissions,
        };
    }

    function closeModal() {
        botSummaryMode = undefined;
        generatingKey = false;
    }

    function generateApiKey() {
        if (bot.definition.autonomousConfig !== undefined) {
            botSummaryMode = {
                kind: "adding_api_key",
                id: collection.id,
                requested: bot.definition.autonomousConfig.permissions,
            };
            generatingKey = true;
        }
    }
</script>

{#if botSummaryMode !== undefined}
    <BotSummary mode={botSummaryMode} onClose={closeModal} {bot} />
{/if}

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
                    on:click={apiKeyPermissions !== undefined ? reviewApiKey : generateApiKey}
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
                            <DeleteOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
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
                                <KeyRemove size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("bots.manage.reviewApiKey")} />
                            {/snippet}
                        </MenuItem>
                    {:else}
                        <MenuItem onclick={() => generateApiKey()}>
                            {#snippet icon()}
                                <KeyPlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <Translatable resourceKey={i18nKey("bots.manage.generateApiKey")} />
                            {/snippet}
                        </MenuItem>
                    {/if}
                {/if}
                <MenuItem onclick={() => viewBotDetails()}>
                    {#snippet icon()}
                        <TextBoxOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <Translatable resourceKey={i18nKey("bots.manage.view")} />
                    {/snippet}
                </MenuItem>
            </Menu>
        {/snippet}
    </MenuIcon>
</div>

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
