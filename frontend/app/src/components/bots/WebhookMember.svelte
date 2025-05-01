<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { type MultiUserChat, OpenChat, ui } from "openchat-client";
    import { publish, type WebhookDetails } from "openchat-shared";
    import { getContext } from "svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Translatable from "../Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        webhook: WebhookDetails;
        searchTerm: string;
    }

    let { chat, webhook, searchTerm }: Props = $props();

    function deleteWebhook() {
        client.deleteWebhook(chat.id, webhook.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("webhook.removeFailed"));
            }
        });
    }

    function viewEditWebhook() {
        client.getWebhook(chat.id, webhook.id).then((secret) => {
            if (secret !== undefined) {
                publish("updateWebhook", {
                    ...webhook,
                    secret,
                });
            }
        });
    }
</script>

<div class="bot_member" role="button">
    <span class="avatar">
        <BotAvatar bot={webhook} />
    </span>
    <div class="details">
        <div class="bot_name">
            <h4>
                <FilteredUsername {searchTerm} username={webhook.name} />
            </h4>
        </div>
    </div>
    <MenuIcon position={"bottom"} align={"end"}>
        {#snippet menuIcon()}
            <HoverIcon>
                <ChevronDown size={ui.iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        {/snippet}
        {#snippet menuItems()}
            <Menu>
                <MenuItem onclick={() => viewEditWebhook()}>
                    {#snippet icon()}
                        <TextBoxOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <Translatable resourceKey={i18nKey("webhook.viewEditAction")} />
                    {/snippet}
                </MenuItem>
                <MenuItem onclick={() => deleteWebhook()}>
                    {#snippet icon()}
                        <DeleteOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
                    {/snippet}
                    {#snippet text()}
                        <Translatable resourceKey={i18nKey("webhook.removeAction")} />
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
    }
</style>
