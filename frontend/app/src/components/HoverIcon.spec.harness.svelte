<script lang="ts">
    import HoverIcon from "./HoverIcon.svelte";

    interface Props {
        log: string[];
    }

    let { log }: Props = $props();
</script>

<svelte:window onkeydown={(e) => log.push(`window ${e.key}`)} />
<svelte:body onkeydown={(e) => log.push(`body ${e.key}`)} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span onclick={() => log.push("wrapper")}>
    <HoverIcon><input class="child" /></HoverIcon>
</span>
<HoverIcon onclick={() => log.push("icon")} />
<HoverIcon disabled onclick={() => log.push("disabled")} />
