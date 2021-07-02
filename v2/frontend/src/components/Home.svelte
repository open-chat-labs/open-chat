<script lang="ts">
    import LeftPanel from "./leftPanel/LeftPanel.controller.svelte";
    // import MiddlePanel from "./MiddlePanel.svelte";
    // import { fly } from "svelte/transition";
    // import RightPanel from "./RightPanel.svelte";
    import TestModeModal from "./TestModeModal.svelte";
    import ThemePicker from "./ThemePicker.svelte";
    import Overlay from "./Overlay.svelte";
    import { modalStore, ModalType } from "../stores/modal";
    import { navStore } from "../stores/nav";
    import { rtlStore } from "../stores/rtl";
    import { identityService } from "../fsm/identity.machine";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../fsm/loggedin.machine";
    const { state, send } = identityService;

    $: loggedIn = $state.children.loggedInMachine as ActorRefFrom<LoggedInMachine>;

    let hideLeft: boolean = false;
    export let params: { chatId?: string } = {};

    // function selectChat(chatId?: string) {
    //     if (user) {
    //         const summary = user.chats.find((c) => c.chatId === chatId) ?? user.chats[0];
    //         hideLeft = !hideLeft;
    //         chatStore.selectChat(summary);
    //     }
    // }

    function logout() {
        send({ type: "LOGOUT" });
    }

    // $: {
    //     if (user) {
    //         params.chatId = user.chats[0].chatId;
    //     }
    // }

    // $: {
    //     selectChat(params.chatId);
    // }

    $: x = $rtlStore ? -350 : 350;
</script>

{#if $loggedIn.context.user}
    <main>
        <LeftPanel {params} machine={loggedIn} on:logout={logout} />
        <!-- <MiddlePanel on:goback={() => (hideLeft = false)} {hideLeft} />
        {#if $navStore}
            <div transition:fly={{ x, duration: 400 }} class="right-wrapper" class:rtl={$rtlStore}>
                <RightPanel />
            </div>
        {/if} -->
    </main>
{/if}

<Overlay active={$modalStore !== ModalType.NoModal}>
    {#if $modalStore === ModalType.TestMode}
        <TestModeModal />
    {:else if $modalStore === ModalType.ThemeSelection}
        <ThemePicker />
    {/if}
</Overlay>

<style type="text/scss">
    @import "../styles/mixins";

    main {
        position: relative;
        @include fullHeight();
        width: 100%;
        max-width: 1000px;
        margin: auto;
    }
    :global(body) {
        transition: color ease-in-out 300ms;
        padding: 0;
        --background-color: var(--theme-background);
        --text-color: var(--theme-text);
        color: var(--theme-text);
    }
    .right-wrapper {
        position: absolute;
        top: 0;
        &:not(.rtl) {
            right: 0;
        }
        &.rtl {
            left: 0;
        }
        @include z-index("right-panel");
        @include box-shadow(3);
        @include size-below(xs) {
            width: 100%;
        }
    }
</style>
