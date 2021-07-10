<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import Button from "../Button.svelte";
    export let machine: ActorRefFrom<ChatMachine>;

    // todo this is fake
    function addParticipant() {
        machine.send({
            type: "NEW_PARTICIPANT_SELECTED",
            data: {
                userId: "abcde",
                username: "soppy_bollocks",
                secondsSinceLastOnline: 0,
            },
        });
    }
</script>

<h1>Adding participant</h1>
<Button on:click={() => addParticipant()}>Done</Button>

<style type="text/scss">
</style>
