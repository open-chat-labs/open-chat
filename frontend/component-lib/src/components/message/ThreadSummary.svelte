<script lang="ts">
    import {
        Avatar,
        ColourVars,
        Container,
        CountBadge,
        Label,
        type Padding,
        type Radius,
    } from "component-lib";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import NotificationIndicator from "../NotificationIndicator.svelte";

    const MAX_AVATARS = 3;

    interface Props {
        me?: boolean;
        hasUnread?: boolean;
        text?: string;
        participantAvatarUrls?: string[];
        onClick?: () => void;
    }

    // TODO - possibly we want to pass in data rather than text e.g. number of messages, latest message
    // but that gets into relative time formatting & i18n etc which we _might_ want to leave out of the library
    let {
        onClick,
        me = false,
        hasUnread = false,
        text = "",
        participantAvatarUrls = [],
    }: Props = $props();

    let borderColour = $derived(hasUnread ? ColourVars.primary : ColourVars.disabledButton);
    let borderRadius = $derived<Radius>(me ? ["xl", "sm", "xl", "xl"] : ["sm", "xl", "xl", "xl"]); // this will need more logic
    let padding = $derived<Padding>(me ? ["xs", "md", "xs", "xs"] : ["xs", "xs", "xs", "md"]);
    let additional = $derived(participantAvatarUrls.length - MAX_AVATARS);
</script>

<Container
    allowOverflow
    {onClick}
    {borderColour}
    borderWidth={"thick"}
    crossAxisAlignment={"center"}
    {borderRadius}
    {padding}
    gap={"md"}
    height={{ kind: "hug" }}
    width={{ kind: "hug" }}>
    <Container supplementalClass={"thread-summary-avatars"} width={{ kind: "hug" }}>
        {#each participantAvatarUrls.slice(0, MAX_AVATARS) as url}
            <Avatar {url} size={"xs"}></Avatar>
        {/each}
        {#if additional > 0}
            <CountBadge mode="additive">+{additional}</CountBadge>
        {/if}
    </Container>
    <Label width={{ kind: "hug" }} colour={"textSecondary"}>{text}</Label>
    <Container width={{ kind: "hug" }}>
        <div class={`arrow`} class:hasUnread>
            <ChevronRight color={ColourVars.background0} />
        </div>
    </Container>
    {#if hasUnread}
        <div class="notification">
            <NotificationIndicator></NotificationIndicator>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.thread-summary-avatars img) {
        margin-inline-start: -0.4rem;
    }

    :global(.thread-summary-avatars .badge) {
        margin-inline-start: -0.4rem;
    }

    :global(.thread-summary-avatars img:first-child) {
        margin-inline-start: 0;
    }

    .arrow {
        background-color: var(--secondary-light);
        border-radius: var(--rad-circle);
        height: 16px;
        display: flex;
        &.hasUnread {
            background-color: var(--primary-light);
        }
    }

    .notification {
        position: absolute;
        top: -17px;
        right: -15px;
    }
</style>
