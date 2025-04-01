<script lang="ts">
    import { mobileWidth } from "../../stores/screenDimensions";
    import Button from "../Button.svelte";

    interface Props {
        selected?: boolean;
        title: string;
        onClick?: (e: MouseEvent) => void;
    }

    let { selected = false, title, onClick }: Props = $props();
</script>

<Button fill={$mobileWidth} hollow={!selected} small={!$mobileWidth} tiny={$mobileWidth} {onClick}>
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
