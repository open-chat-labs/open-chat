<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, FloatingButton } from "component-lib";
    import { OpenChat, publish, type UserSummary } from "openchat-client";
    import { getContext } from "svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import SelectUsers from "../SelectUsers.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import { updateGroupState } from "./group.svelte";

    const client = getContext<OpenChat>("client");

    let ugs = updateGroupState;

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsersForInvite(term, 20, ugs.candidateGroup.level, true, true);
    }
</script>

<SlidingPageContent title={i18nKey("Add members")} subtitle={i18nKey("Create group")}>
    <Container
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

<FloatingButton pos={{ bottom: "md", right: "md" }} onClick={() => publish("closeModalPage")}>
    {#snippet icon(color)}
        <Save {color} />
    {/snippet}
</FloatingButton>
