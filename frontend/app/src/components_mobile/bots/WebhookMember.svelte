<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { copyToClipboard } from "@src/utils/urls";
    import { Container, IconButton, MenuItem, MenuTrigger } from "component-lib";
    import { OpenChat, type MultiUserChat } from "openchat-client";
    import { publish, type FullWebhookDetails, type WebhookDetails } from "openchat-shared";
    import { getContext } from "svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import BotBadge from "../home/profile/BotBadge.svelte";
    import Translatable from "../Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        webhook: WebhookDetails;
        searchTerm?: string;
        canManage?: boolean;
        showMenu?: boolean;
    }

    let { chat, webhook, searchTerm = "", canManage = false, showMenu = true }: Props = $props();

    function deleteWebhook() {
        client.deleteWebhook(chat.id, webhook.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("webhook.removeFailed"));
            }
        });
    }

    function getWebhookAndThen(fn: (hook: FullWebhookDetails) => void) {
        client.getWebhook(chat.id, webhook.id).then((secret) => {
            if (secret !== undefined) {
                fn({
                    ...webhook,
                    secret,
                });
            }
        });
    }

    function copy() {
        getWebhookAndThen((hook) => {
            const url = client.webhookUrl(hook, chat.id);
            if (url) {
                copyToClipboard(url);
            }
        });
    }

    function regenerate() {
        getWebhookAndThen((hook) => publish("regenerateWebhook", { chat, hook }));
    }

    function edit() {
        getWebhookAndThen((hook) => publish("updateWebhook", { chat, hook }));
    }
</script>

<Container onClick={edit} crossAxisAlignment={"center"} gap={"md"}>
    <BotAvatar size={"md"} bot={webhook} />
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        <BotBadge webhook />
        <FilteredUsername {searchTerm} username={webhook.name} />
    </Container>
    {#if showMenu}
        <MenuTrigger position={"bottom"} align={"end"}>
            <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
            {#snippet menuItems()}
                <MenuItem onclick={() => copy()}>
                    <Translatable resourceKey={i18nKey("Copy URL")} />
                </MenuItem>
                {#if canManage}
                    <MenuItem onclick={() => edit()}>
                        <Translatable resourceKey={i18nKey("Edit")} />
                    </MenuItem>
                    <MenuItem onclick={() => regenerate()}>
                        <Translatable resourceKey={i18nKey("Regenerate")} />
                    </MenuItem>
                    <MenuItem danger onclick={() => deleteWebhook()}>
                        <Translatable resourceKey={i18nKey("Remove")} />
                    </MenuItem>
                {/if}
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>
