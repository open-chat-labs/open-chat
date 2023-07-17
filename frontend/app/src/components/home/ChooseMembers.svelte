<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectUsers from "./SelectUsers.svelte";
    import type { CandidateMember, UserSummary } from "openchat-client";

    export let members: CandidateMember[];
    export let busy: boolean;
    export let userLookup: (searchTerm: string, maxResults?: number) => Promise<UserSummary[]>;

    $: selectedUsers = members.map((m) => m.user);

    function deleteMember(ev: CustomEvent<UserSummary>): void {
        if (busy) return;
        members = members.filter((m) => m.user.userId !== ev.detail.userId);
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
        on:deleteUser={deleteMember}
        on:selectUser={addMember}
        {selectedUsers} />
</div>
