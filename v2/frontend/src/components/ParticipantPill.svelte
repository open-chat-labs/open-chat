<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { CandidateParticipant } from "../fsm/group.machine";
    const dispatch = createEventDispatcher();

    export let participant: CandidateParticipant;

    function deleteParticipant() {
        dispatch("deleteParticipant", participant);
    }
</script>

<div class="pill">
    <div class="avatar" />
    <div class="username">{participant.user.username}</div>
    <div on:click={deleteParticipant} class="delete" />
</div>

<style type="text/scss">
    .pill {
        &.avatar {
        }
        &.username {
        }
        &.delete {
        }
    }
</style>
