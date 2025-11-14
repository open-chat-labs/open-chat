<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Container, IconButton, MenuItem, MenuTrigger } from "component-lib";
    import { type MultiUserChat, OpenChat } from "openchat-client";
    import { publish, type WebhookDetails } from "openchat-shared";
    import { getContext } from "svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import BotBadge from "../home/profile/BotBadge.svelte";
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

<Container crossAxisAlignment={"center"} gap={"md"}>
    <BotAvatar size={"md"} bot={webhook} />
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        <BotBadge webhook />
        <FilteredUsername {searchTerm} username={webhook.name} />
    </Container>
    <MenuTrigger position={"bottom"} align={"end"}>
        <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
            {#snippet icon(color)}
                <DotsVertical {color} />
            {/snippet}
        </IconButton>
        {#snippet menuItems()}
            <MenuItem onclick={() => viewEditWebhook()}>
                {#snippet icon(color, size)}
                    <TextBoxOutline {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("webhook.viewEditAction")} />
            </MenuItem>
            <MenuItem onclick={() => deleteWebhook()}>
                {#snippet icon(color, size)}
                    <DeleteOutline {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("webhook.removeAction")} />
            </MenuItem>
        {/snippet}
    </MenuTrigger>
</Container>
