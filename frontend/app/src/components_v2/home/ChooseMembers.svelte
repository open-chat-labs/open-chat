<script lang="ts">
    import SelectUsers from "./SelectUsers.svelte";
    import type { CandidateMember, UserOrUserGroup, UserSummary } from "openchat-client";
    import { ROLE_MEMBER } from "openchat-client";

    interface Props {
        members: CandidateMember[];
        busy: boolean;
        userLookup: (
            searchTerm: string,
            maxResults?: number,
        ) => Promise<[UserSummary[], UserSummary[]]>;
    }

    let { members = $bindable(), busy, userLookup }: Props = $props();

    let selectedUsers = $derived(members.map((m) => m.user));

    function deleteMember(user: UserOrUserGroup): void {
        if (busy || user.kind !== "user") return;
        members = members.filter((m) => m.user.userId !== user.userId);
    }

    function addMember(user: UserSummary): void {
        if (busy) return;
        members = [
            ...members,
            {
                role: ROLE_MEMBER,
                user,
            },
        ];
    }
</script>

<div class="members">
    <SelectUsers
        {userLookup}
        enabled={!busy}
        mode={"add"}
        onDeleteUser={deleteMember}
        onSelectUser={addMember}
        {selectedUsers} />
</div>
