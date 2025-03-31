<script lang="ts">
    import SelectUsers from "./SelectUsers.svelte";
    import type { CandidateMember, UserOrUserGroup, UserSummary } from "openchat-client";

    export let members: CandidateMember[];
    export let busy: boolean;
    export let userLookup: (
        searchTerm: string,
        maxResults?: number,
    ) => Promise<[UserSummary[], UserSummary[]]>;

    $: selectedUsers = members.map((m) => m.user);

    function deleteMember(user: UserOrUserGroup): void {
        if (busy || user.kind !== "user") return;
        members = members.filter((m) => m.user.userId !== user.userId);
    }

    function addMember(ev: CustomEvent<UserSummary>): void {
        if (busy) return;
        members = [
            ...members,
            {
                role: "member",
                user: ev.detail,
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
        on:selectUser={addMember}
        {selectedUsers} />
</div>
