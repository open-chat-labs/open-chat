<script lang="ts">
    import { Avatar, BodySmall, ColourVars, Container } from "component-lib";
    import type { OpenChat, UserSummary } from "openchat-client";
    import { currentUserIdStore } from "openchat-client";
    import { getContext } from "svelte";
    import CheckboxMarkedOutline from "svelte-material-icons/CheckboxMarkedOutline.svelte";
    import FilteredUsername from "./FilteredUsername.svelte";
    import Badges from "./home/profile/Badges.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm: string;
        user: UserSummary;
        onSelect: (user: UserSummary) => void;
        checked?: boolean;
    }

    let { searchTerm, user, onSelect, checked = false }: Props = $props();
</script>

<Container
    padding={["md", "zero"]}
    crossAxisAlignment={"center"}
    gap={"md"}
    onClick={() => onSelect(user)}>
    <Avatar size={"md"} url={client.userAvatarUrl(user)} />
    <Container direction={"vertical"}>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <FilteredUsername
                {searchTerm}
                me={user.userId === $currentUserIdStore}
                username={user.displayName ?? user.username} />
            <Badges
                uniquePerson={user.isUniquePerson}
                diamondStatus={user.diamondStatus}
                streak={user.streak} />
        </Container>
        <BodySmall colour={"textSecondary"}>
            <FilteredUsername {searchTerm} username={"@" + user.username} />
        </BodySmall>
    </Container>
    {#if checked}
        <CheckboxMarkedOutline size={"1.4rem"} color={ColourVars.primary} />
    {/if}
</Container>
