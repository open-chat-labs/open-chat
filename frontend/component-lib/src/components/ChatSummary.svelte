<script lang="ts">
    import { Avatar, MultiAvatar, type ColourVarKeys } from "component-lib";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import Container from "./Container.svelte";
    import CountBadge from "./CountBadge.svelte";
    import type { LatestMessage } from "./LatestMessage.svelte";
    import LatestMessageComponent from "./LatestMessage.svelte";
    import Caption from "./typography/Caption.svelte";
    import Title from "./typography/Title.svelte";

    type NonEmptyArray<T> = [T, ...T[]];

    interface Props {
        title: string;
        latestMessage?: LatestMessage;
        avatarUrls: NonEmptyArray<string>;
        unreadCount?: number;
        muted?: boolean;
        time?: string;
        onClick?: () => void;
    }

    let {
        title,
        latestMessage,
        unreadCount = 0,
        muted = false,
        time,
        onClick,
        avatarUrls,
    }: Props = $props();
    let timeColour = $derived<ColourVarKeys>(unreadCount > 0 && !muted ? "primary" : "secondary");
    let iconColor = $derived("var(--text-secondary)");

    // TODO - not sure exactly how to handle the delivery icons - just puting something in there to sketch out the layout
    // Container abstraction still performing pretty well
</script>

<Container {onClick} crossAxisAlignment={"center"} gap={"md"}>
    {#if avatarUrls.length > 1}
        <MultiAvatar urls={avatarUrls} />
    {:else}
        <Avatar url={avatarUrls[0]} size={"lg"} />
    {/if}
    <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
        <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"start"}>
            <Title ellipsisTruncate fontWeight={"semi-bold"}>
                {title}
            </Title>
            {#if time}
                <Caption width={{ kind: "hug" }} colour={timeColour}>{time}</Caption>
            {/if}
        </Container>
        <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
            {#if latestMessage !== undefined}
                <LatestMessageComponent {latestMessage} />
            {/if}
            {#if unreadCount > 0}
                <CountBadge>{unreadCount}</CountBadge>
            {:else}
                <Container mainAxisAlignment={"end"} width={{ kind: "hug" }}>
                    <CheckCircle color={iconColor} />
                    <CheckCircle color={iconColor} />
                </Container>
            {/if}
        </Container>
    </Container>
</Container>
