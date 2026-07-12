<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, Container, IconButton, MenuItem, MenuTrigger } from "component-lib";
    import { installationLocationFrom, OpenChat, type CommunitySummary } from "@client";
    import {
        publish,
        type ChatSummary,
        type ExternalBot,
        type GrantedBotPermissions,
    } from "@shared";
    import { getContext } from "svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import FilteredUsername from "@src/ui/FilteredUsername.svelte";
    import Markdown from "@src/ui/Markdown.svelte";
    import BotBadge from "@src/mobile/features/bots/exports/BotBadge.svelte";
    import Translatable from "@src/mobile/shared/Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBot;
        canManage: boolean;
        searchTerm?: string;
        grantedPermissions: GrantedBotPermissions;
    }

    let { collection, bot, canManage, searchTerm, grantedPermissions }: Props = $props();

    function removeBot() {
        client.uninstallBot(installationLocationFrom(collection), bot.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("bots.manage.removeFailed"));
            }
        });
    }
</script>

<Container
    onClick={() => publish("showBot", { bot, collection, grantedPermissions })}
    crossAxisAlignment={"start"}
    gap={"md"}>
    <BotAvatar size={"md"} {bot} />
    <Container overflow={"hidden"} gap={"xxs"} direction={"vertical"} width={"fill"}>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <FilteredUsername {searchTerm} username={bot.name} />
            <BotBadge bot />
        </Container>
        <BodySmall width={"hug"} colour={"textSecondary"}>
            <Markdown twoLine inline={false} suppressLinks text={bot.definition.description} />
        </BodySmall>
    </Container>
    {#if canManage}
        <MenuTrigger position={"bottom"} align={"end"}>
            <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
            {#snippet menuItems()}
                <MenuItem onclick={() => removeBot()}>
                    {#snippet icon(color, size)}
                        <DeleteOutline {size} {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                </MenuItem>
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>
