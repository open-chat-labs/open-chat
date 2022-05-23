<script lang="ts">
    import Loading from "../../Loading.svelte";
    import Button from "../../Button.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import type { UserSummary } from "../../../domain/user/user";
    import SelectUsers from "../SelectUsers.svelte";
    import type { CandidateGroupChat } from "../../../domain/chat/chat";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let candidateGroup: CandidateGroupChat;
    export let busy: boolean;

    $: numParticipants = candidateGroup.participants.length;
    $: selectedUsers = candidateGroup.participants.map((p) => p.user);

    function deleteParticipant(ev: CustomEvent<UserSummary>): void {
        candidateGroup.participants = candidateGroup.participants.filter(
            (p) => p.user.userId !== ev.detail.userId
        );
    }

    function addParticipant(ev: CustomEvent<UserSummary>): void {
        candidateGroup.participants = [
            ...candidateGroup.participants,
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

<SectionHeader flush={true}>
    <h4>{$_("chooseParticipants")}</h4>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
</SectionHeader>

<div class="participants">
    <div class="form-fields">
        {#if !busy}
            <SelectUsers
                mode={"add"}
                on:deleteUser={deleteParticipant}
                on:selectUser={addParticipant}
                {selectedUsers} />
        {:else}
            <Loading />
        {/if}
    </div>

    <div class="cta">
        <Button disabled={busy} loading={busy} on:click={complete} fill={true}
            >{$_(numParticipants === 0 ? "skip" : "confirmParticipants")}</Button>
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

    .participants {
        flex: 1;
        background-color: var(--participants-panel-bg);
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
