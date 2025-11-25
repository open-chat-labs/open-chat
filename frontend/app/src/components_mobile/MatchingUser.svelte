<script lang="ts">
    import { Avatar, BodySmall, ColourVars, Container } from "component-lib";
    import type { BotMatch, DiamondMembershipStatus, OpenChat, UserSummary } from "openchat-client";
    import { currentUserIdStore } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import FilteredUsername from "./FilteredUsername.svelte";
    import Badges from "./home/profile/Badges.svelte";

    const client = getContext<OpenChat>("client");

    type Match = {
        avatarUrl: string;
        name: string;
        unique: boolean;
        diamond: DiamondMembershipStatus["kind"];
        streak: number;
        username: string;
        chitEarned: number;
    };

    interface Props {
        searchTerm?: string;
        user: UserSummary | BotMatch;
        onSelect: (user: UserSummary | BotMatch) => void;
        checked?: boolean;
    }

    let { searchTerm, user, onSelect, checked = false }: Props = $props();

    let match = $derived(normalise());

    function normalise(): Match {
        switch (user.kind) {
            case "bot_match":
                return {
                    avatarUrl: user.avatarUrl ?? "/assets/bot_avatar.svg",
                    name: user.name,
                    unique: false,
                    diamond: "inactive",
                    streak: 0,
                    username: user.name,
                    chitEarned: 0,
                };
            default:
                return {
                    avatarUrl: client.userAvatarUrl(user),
                    name: user.displayName ?? user.username,
                    unique: user.isUniquePerson,
                    diamond: user.diamondStatus,
                    streak: user.streak,
                    username: `@${user.username}`,
                    chitEarned: user.totalChitEarned,
                };
        }
    }
</script>

<Container
    padding={["md", "zero"]}
    crossAxisAlignment={"center"}
    gap={"md"}
    onClick={() => onSelect(user)}>
    <Avatar size={"md"} url={match.avatarUrl} />
    <Container direction={"vertical"}>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <FilteredUsername
                {searchTerm}
                me={user.kind === "user" && user.userId === $currentUserIdStore}
                username={match.name} />
            <Badges
                uniquePerson={match.unique}
                diamondStatus={match.diamond}
                chitEarned={match.chitEarned}
                streak={match.streak} />
        </Container>
        <BodySmall colour={"textSecondary"}>
            <FilteredUsername {searchTerm} username={match.username} />
        </BodySmall>
    </Container>
    {#if checked}
        <Check size={"1.4rem"} color={ColourVars.primary} />
    {/if}
</Container>
