<script lang="ts">
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import { AvatarSize, UserStatus } from "openchat-client";
    import SelectUsers from "../SelectUsers.svelte";
    import type { CandidateGroupChat, UserSummary } from "openchat-client";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let candidateGroup: CandidateGroupChat;
    export let busy: boolean;

    $: numMembers = candidateGroup.members.length;
    $: selectedUsers = candidateGroup.members.map((m) => m.user);

    function deleteMember(ev: CustomEvent<UserSummary>): void {
        candidateGroup.members = candidateGroup.members.filter(
            (m) => m.user.userId !== ev.detail.userId
        );
    }

    function addMember(ev: CustomEvent<UserSummary>): void {
        candidateGroup.members = [
            ...candidateGroup.members,
            {
                role: "participant",
                user: ev.detail,
            },
        ];
    }

    function complete() {
        dispatch("complete");
    }
</script>

<SectionHeader border={false} flush={true}>
    <h4>{$_("chooseMembers")}</h4>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
</SectionHeader>

<div class="members">
    <div class="form-fields">
        {#if !busy}
            <SelectUsers
                mode={"add"}
                on:deleteUser={deleteMember}
                on:selectUser={addMember}
                {selectedUsers} />
        {:else}
            <Loading />
        {/if}
    </div>

    <div class="cta">
        <Button disabled={busy} loading={busy} on:click={complete} fill={true}
            >{$_(numMembers === 0 ? "skip" : "confirmMembers")}</Button>
    </div>
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }

    .cta {
        flex: 0 0 57px;
    }

    .members {
        flex: 1;
        color: var(--section-txt);
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        overflow: auto;
        @include mobile() {
            background-color: transparent;
        }
    }

    .form-fields {
        padding: $sp3;
        flex: auto;
        overflow: auto;

        @include size-above(xl) {
            padding: $sp3 0 0 0;
        }
    }
</style>
