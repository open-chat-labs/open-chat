<script lang="ts">
    import { Sheet } from "component-lib";
    import Home from "svelte-material-icons/HomeCircleOutline.svelte";
    import RobotDead from "svelte-material-icons/RobotDeadOutline.svelte";
    import NothingToSee from "./home/NothingToSee.svelte";

    interface Props {
        onClose?: () => void;
    }
    let { onClose }: Props = $props();
</script>

<Sheet onDismiss={onClose}>
    <NothingToSee
        title={"Page not found"}
        subtitle={"We can't find the page you're looking for"}
        reset={onClose ? { text: "Go home", onClick: onClose, icon: home } : undefined}
        height={{ size: "20rem" }}>
        {#snippet icon(color, size)}
            <RobotDead {color} {size} />
        {/snippet}
    </NothingToSee>
</Sheet>

{#snippet home(color: string, size: string)}
    <Home {color} {size} />
{/snippet}
