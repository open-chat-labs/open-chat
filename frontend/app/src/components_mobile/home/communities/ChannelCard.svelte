<script lang="ts">
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        BodySmall,
        Container,
        IconButton,
        MenuItem,
        MenuTrigger,
        Title,
    } from "component-lib";
    import {
        type ChannelMatch,
        iconSize,
        type OpenChat,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Markdown from "../Markdown.svelte";

    interface Props {
        channel: ChannelMatch;
        onDeleteChannel: () => void;
        onSelectChannel: () => void;
    }

    let { channel, onDeleteChannel, onSelectChannel }: Props = $props();

    const client = getContext<OpenChat>("client");

    let canDeleteChannel = $derived(client.canDeleteChannel(channel.id));
</script>

<Container onClick={onSelectChannel} crossAxisAlignment={"center"} gap={"sm"}>
    <Avatar
        size={"md"}
        url={client.groupAvatarUrl(
            { id: channel.id, ...channel.avatar },
            $selectedCommunitySummaryStore,
        )} />
    <Container direction={"vertical"}>
        <Container crossAxisAlignment={"center"} gap={"sm"}>
            {#if !channel.public}
                <div class="private"></div>
            {/if}
            <Container width={{ kind: "hug" }} crossAxisAlignment={"center"} gap={"xxs"}>
                <AccountMultiple size={"1.2em"} />
                <BodySmall>{channel.memberCount.toLocaleString()}</BodySmall>
            </Container>
            <Title ellipsisTruncate fontWeight={"semi-bold"}>
                {channel.name}
            </Title>
        </Container>
        {#if channel.description !== ""}
            <BodySmall ellipsisTruncate colour={"textSecondary"}>
                <Markdown text={channel.description} oneLine suppressLinks />
            </BodySmall>
        {/if}
    </Container>
    {#if canDeleteChannel}
        <MenuTrigger position={"top"} align={"end"}>
            <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
            {#snippet menuItems()}
                <MenuItem danger onclick={onDeleteChannel}>
                    {#snippet icon()}
                        <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("deleteGroup", undefined, "channel")} />
                </MenuItem>
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>

<style lang="scss">
    .private {
        background-repeat: no-repeat;
        $size: 12px;
        flex: 0 0 $size;
        width: $size;
        height: $size;
        background-image: url("/assets/locked.svg");
    }
</style>
