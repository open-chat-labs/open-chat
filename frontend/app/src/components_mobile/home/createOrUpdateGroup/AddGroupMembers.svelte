<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, FloatingButton } from "component-lib";
    import { OpenChat, publish, type UserSummary } from "openchat-client";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import SelectUsers from "./SelectUsers.svelte";
    import { updateGroupState } from "./group.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, ugs.candidateGroup.level, true, true);
    }
</script>

<SlidingPageContent title={i18nKey("Add members")} subtitle={i18nKey("Create group")}>
    <Container
        supplementalClass={"add_group_members"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <SelectUsers
            onDeleteUser={(user) => updateGroupState.deleteMember(user)}
            onSelectUser={(user) => updateGroupState.addMember(user)}
            userLookup={searchUsers}
            selectedUsers={ugs.candidateUsers}
            mode={"add"}></SelectUsers>
    </Container>
</SlidingPageContent>

<div class="add_group_members_next">
    <FloatingButton onClick={() => publish("updateGroupDetails")}>
        {#snippet icon(color)}
            <Check {color} />
        {/snippet}
    </FloatingButton>
</div>

<style lang="scss">
    .add_group_members_next {
        position: absolute;
        bottom: var(--sp-md);
        right: var(--sp-md);
    }
</style>
