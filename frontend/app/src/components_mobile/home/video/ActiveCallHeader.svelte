<script lang="ts">
    import { Avatar, SectionHeader } from "component-lib";
    import { activeVideoCall } from "../../../stores/video";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Typing from "../../Typing.svelte";
    import ActiveCallActions from "./ActiveCallActions.svelte";
    import type { VideoCallChat } from "./callChat";

    interface Props {
        askedToSpeak: boolean;
        chat: VideoCallChat;
        onClearSelection: () => void;
        onAskToSpeak: () => void;
    }

    let { chat, onClearSelection, onAskToSpeak }: Props = $props();

    function minimise() {
        activeVideoCall.setView("minimised");
    }
</script>

{#snippet menu()}
    <ActiveCallActions {chat} {onAskToSpeak} onMinimise={minimise} />
{/snippet}

<SectionHeader
    menu={$activeVideoCall?.status === "joined" ? menu : undefined}
    onBack={onClearSelection}>
    {#snippet title()}
        {chat.name}
        {#if $activeVideoCall?.status === "joining"}
            <Typing />
        {/if}
    {/snippet}
    {#snippet avatar()}
        {#if $activeVideoCall?.status === "joining"}
            <FancyLoader size={"3rem"} loop />
        {:else}
            <Avatar url={chat.avatarUrl} name={chat.name} />
        {/if}
    {/snippet}
</SectionHeader>
