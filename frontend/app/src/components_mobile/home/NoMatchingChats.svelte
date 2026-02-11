<script lang="ts">
    import Chat from "svelte-material-icons/ChatOutline.svelte";
    import NothingToSee from "./NothingToSee.svelte";

    interface Props {
        onReset: () => void;
    }

    let { onReset }: Props = $props();
</script>

{#snippet chatIcon(color: string, size: string)}
    <Chat {color} {size} />
{/snippet}

<NothingToSee
    title={"No chats found"}
    subtitle={"Feel free to choose a different filter"}
    reset={{ onClick: onReset, text: "View all chats", icon: chatIcon }} />
