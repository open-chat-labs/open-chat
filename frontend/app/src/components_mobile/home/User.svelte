<script lang="ts">
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import {
        Avatar,
        BodySmall,
        Caption,
        ColourVars,
        Container,
        IconButton,
        MenuTrigger,
    } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import {
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_NONE,
        ROLE_OWNER,
        roleAsText,
        selectedChatWebhooksStore,
        selectedCommunityMembersStore,
    } from "openchat-client";
    import type { MemberRole, UserSummary } from "openchat-shared";
    import { getContext, type Snippet } from "svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import FilteredUsername from "../FilteredUsername.svelte";
    import Badges from "./profile/Badges.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        user: UserSummary;
        me?: boolean;
        searchTerm?: string;
        role?: MemberRole;
        profile?: boolean;
        children?: Snippet;
        onClick?: () => void;
    }

    let {
        user,
        me = false,
        searchTerm = "",
        role = ROLE_NONE,
        profile = true,
        children,
        onClick,
    }: Props = $props();

    // if search term is !== "", split the username into three parts [prefix, match, postfix]

    let displayName = $derived(
        client.getDisplayName(
            user.userId,
            $selectedCommunityMembersStore,
            $selectedChatWebhooksStore,
        ),
    );

    function click(ev?: MouseEvent) {
        if (profile) {
            ev?.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId: user.userId,
                        chatButton: !me,
                        inGlobalContext: false,
                    },
                    bubbles: true,
                }),
            );
        }

        onClick?.();
    }

    function getRoleColour() {
        switch (role) {
            case ROLE_OWNER:
                return ColourVars.primary;
            case ROLE_ADMIN:
                return ColourVars.secondary;
            case ROLE_MODERATOR:
                return ColourVars.warning;
            default:
                return ColourVars.primary;
        }
    }
</script>

{#snippet role_label()}
    {#if role > ROLE_MEMBER}
        <Container
            width={{ kind: "hug" }}
            borderRadius={"sm"}
            padding={["zero", "xs"]}
            background={getRoleColour()}>
            <Caption colour={"textOnPrimary"} fontWeight={"bold"}>{roleAsText(role)}</Caption>
        </Container>
    {/if}
{/snippet}

<Container onClick={click} crossAxisAlignment={"center"} gap={"md"}>
    <Avatar url={client.userAvatarUrl(user)} size={"md"} />
    <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <FilteredUsername {searchTerm} username={displayName} {me} />
            <Badges
                uniquePerson={user.isUniquePerson}
                diamondStatus={user.diamondStatus}
                streak={user.streak}
                chitEarned={user.totalChitEarned} />
        </Container>
        <Container crossAxisAlignment={"center"} gap={"sm"}>
            <BodySmall width={{ kind: "hug" }} colour={"textSecondary"}>
                @{user.username}
            </BodySmall>
            {@render role_label()}
        </Container>
    </Container>
    {#if children}
        <MenuTrigger position={"bottom"} align={"end"}>
            <IconButton padding={["sm", "xs", "sm", "zero"]} size={"md"}>
                {#snippet icon(color)}
                    <DotsVertical {color} />
                {/snippet}
            </IconButton>
            {#snippet menuItems()}
                {@render children()}
            {/snippet}
        </MenuTrigger>
    {/if}
</Container>
