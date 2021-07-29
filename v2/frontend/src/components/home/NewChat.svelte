<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    export let machine: ActorRefFrom<HomeMachine>;
    import { _ } from "svelte-i18n";
    import type { UserSearchMachine } from "../../fsm/userSearch.machine";
    import type { HomeMachine } from "../../fsm/home.machine";

    $: userSearchMachine = $machine.children.userSearchMachine as ActorRefFrom<UserSearchMachine>;

    function cancelNewChat() {
        machine.send({ type: "CANCEL_NEW_CHAT" });
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancelNewChat}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("startNewChat")}</h4>
</SectionHeader>

{#if $machine.matches({ loaded_chats: { new_chat: "unexpected_error" } })}
    <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
{/if}

{#if userSearchMachine !== undefined && !$userSearchMachine.matches("unexpected_error")}
    <FindUser machine={userSearchMachine} />
{/if}

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
</style>
