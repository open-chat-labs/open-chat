<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import FindUser from "../FindUser.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    export let machine: ActorRefFrom<HomeMachine>;
    import { _ } from "svelte-i18n";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type { UserSummary } from "../../domain/user/user";

    $: api = $machine.context.serviceContainer!;

    function cancelNewChat() {
        machine.send({ type: "CANCEL_NEW_CHAT" });
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        machine.send({ type: "CREATE_CHAT_WITH_USER", data: ev.detail });
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

<div class="body">
    {#if $machine.matches({ loaded_chats: { new_chat: "unexpected_error" } })}
        <ErrorMessage>{$_("errorSearchingForUser")}</ErrorMessage>
    {/if}

    {#if $machine.matches({ loaded_chats: "new_chat" })}
        <FindUser on:selectUser={selectUser} {api} />
    {/if}
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
    .body {
        overflow: auto;
        @include size-below(xs) {
            padding: 0 $sp3;
        }
    }
</style>
