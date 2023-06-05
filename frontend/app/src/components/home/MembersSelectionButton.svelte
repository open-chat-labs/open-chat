<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";

    export let selected = false;
    export let title: string;
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} on:click>
    <div class="content">
        {title}
    </div>
</Button>

<style lang="scss">
    .content {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: $sp4;
        min-width: 120px;
        text-transform: capitalize;
        @include font(medium, normal, fs-100);
    }
</style>
