<script lang="ts">
    import Container from "../Container.svelte";

    interface Props {
        selected?: boolean;
    }

    let { selected = false }: Props = $props();
</script>

<Container
    borderWidth={"zero"}
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"spaceBetween"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <div class="selection" class:selected></div>
    <div class="icon"></div>
    <div class="indicator"></div>
</Container>

<style lang="scss">
    .selection {
        height: 4px;
        width: 100%;
        border-radius: var(--rad-sm);
        background-color: transparent;
    }
    .selected {
        background-color: var(--primary);
    }
</style>
