<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, FloatingButton } from "component-lib";
    import { OpenChat, publish, type UserSummary } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import SelectUsers from "../../SelectUsers.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateCommunityState } from "./community.svelte";

    const client = getContext<OpenChat>("client");

    let ucs = updateCommunityState;

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, ucs.candidateCommunity.level, true, true);
    }
</script>

<SlidingPageContent title={i18nKey("Add members")} subtitle={i18nKey("Create community")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <SelectUsers
            onDeleteUser={(user) => ucs.deleteMember(user)}
            onSelectUser={(user) => ucs.addMember(user)}
            userLookup={searchUsers}
            selectedUsers={ucs.candidateUsers}
            mode={"add"}></SelectUsers>
    </Container>
</SlidingPageContent>

<FloatingButton
    pos={{ bottom: "md", right: "md" }}
    onClick={() => publish("updateCommunityDetails")}>
    {#snippet icon(color)}
        <Check {color} />
    {/snippet}
</FloatingButton>
