<script lang="ts">
    import { BodySmall, Container, IconButton, MenuItem, MenuTrigger } from "component-lib";
    import { type CommunitySummary, type MultiUserChat } from "openchat-client";
    import { type ExternalBot, type GrantedBotPermissions } from "openchat-shared";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import TextBoxOutline from "svelte-material-icons/TextBoxOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import FilteredUsername from "../FilteredUsername.svelte";
    import Markdown from "../home/Markdown.svelte";
    import BotBadge from "../home/profile/BotBadge.svelte";
    import Translatable from "../Translatable.svelte";
    import BotAvatar from "./BotAvatar.svelte";
    import WithBotManagement from "./WithBotManagement.svelte";

    interface Props {
        collection: CommunitySummary | MultiUserChat;
        bot: ExternalBot;
        canManage: boolean;
        searchTerm: string;
        grantedPermissions: GrantedBotPermissions;
    }

    let { collection, bot, canManage, searchTerm, grantedPermissions }: Props = $props();
</script>

<WithBotManagement {collection} {bot} {canManage} {grantedPermissions}>
    {#snippet contents({ removeBot, reviewPermissions, viewBotDetails })}
        <Container crossAxisAlignment={"start"} gap={"md"}>
            <BotAvatar size={"md"} {bot} />
            <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
                <Container crossAxisAlignment={"center"} gap={"xs"}>
                    <FilteredUsername {searchTerm} username={bot.name} />
                    <BotBadge bot />
                </Container>
                <BodySmall width={{ kind: "hug" }} colour={"textSecondary"}>
                    <Markdown
                        twoLine
                        inline={false}
                        suppressLinks
                        text={bot.definition.description} />
                </BodySmall>
            </Container>
            <MenuTrigger position={"bottom"} align={"end"}>
                <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                    {#snippet icon(color)}
                        <DotsVertical {color} />
                    {/snippet}
                </IconButton>
                {#snippet menuItems()}
                    {#if canManage}
                        <MenuItem onclick={() => removeBot()}>
                            {#snippet icon(color, size)}
                                <DeleteOutline {size} {color} />
                            {/snippet}
                            <Translatable resourceKey={i18nKey("bots.manage.remove")} />
                        </MenuItem>
                        {#if bot.definition.commands.length > 0 || bot.definition.autonomousConfig !== undefined}
                            <MenuItem onclick={() => reviewPermissions()}>
                                {#snippet icon(color, size)}
                                    <PencilOutline {size} {color} />
                                {/snippet}
                                <Translatable resourceKey={i18nKey("bots.manage.review")} />
                            </MenuItem>
                        {/if}
                    {/if}
                    <MenuItem onclick={() => viewBotDetails()}>
                        {#snippet icon(color, size)}
                            <TextBoxOutline {size} {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("bots.manage.view")} />
                    </MenuItem>
                {/snippet}
            </MenuTrigger>
        </Container>
    {/snippet}
</WithBotManagement>
