<script lang="ts">
    import NothingToSee from "./NothingToSee.svelte";

    interface Props {
        onReset: () => void;
    }

    let { onReset }: Props = $props();
</script>

<NothingToSee
    {onReset}
    title={"No chats found"}
    subtitle={"Feel free to choose a different filter"}
    reset={"View all chats"} />
