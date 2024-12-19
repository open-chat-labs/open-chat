<script lang="ts">
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../stores/iconSize";
    import { AvatarSize, type ExternalBot } from "openchat-shared";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Avatar from "../Avatar.svelte";
    import FilteredUsername from "../FilteredUsername.svelte";
    import type {
        CommunityIdentifier,
        GroupChatIdentifier,
        OpenChat,
        SlashCommandPermissions,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { toastStore } from "../../stores/toast";
    import BotSummary from "./BotSummary.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        id: CommunityIdentifier | GroupChatIdentifier;
        bot: ExternalBot;
        canManage: boolean;
        searchTerm: string;
        grantedPermissions: SlashCommandPermissions;
    }

    let { id, bot, canManage, searchTerm, grantedPermissions }: Props = $props();
    let reviewMode: "editing" | "viewing" | undefined = $state(undefined);

    function removeBot() {
        client.removeInstalledBot(id, bot.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            }
        });
    }

    function reviewPermissions() {
        reviewMode = "editing";
    }

    function viewBotDetails() {
        reviewMode = "viewing";
    }

    function closeModal() {
        reviewMode = undefined;
    }
</script>

{#if reviewMode !== undefined}
    <BotSummary
        currentPermissions={grantedPermissions}
        mode={reviewMode}
        {id}
        onClose={closeModal}
        {bot} />
{/if}

<div class="bot_member" role="button">
    <span class="avatar">
        <Avatar userId={bot.id} url={bot.avatarUrl} size={AvatarSize.Default} />
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
    </div>
    <MenuIcon position={"bottom"} align={"end"}>
        <span slot="icon">
            <HoverIcon>
                <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
        <span slot="menu">
            <Menu>
                {#if canManage}
                    <MenuItem on:click={() => removeBot()}>
                        <DeleteOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                        </div>
                    </MenuItem>
                    <MenuItem on:click={() => reviewPermissions()}>
                        <PencilOutline
                            size={$iconSize}
                            color={"var(--icon-inverted-txt)"}
                            slot="icon" />
                        <div slot="text">
                            <Translatable resourceKey={i18nKey("bots.manage.review")} />
                        </div>
                    </MenuItem>
                {/if}
                <MenuItem on:click={() => viewBotDetails()}>
                    <TextBoxOutline
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">
                        <Translatable resourceKey={i18nKey("bots.manage.view")} />
                    </div>
                </MenuItem>
            </Menu>
        </span>
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

        cursor: pointer;

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
    }
</style>
