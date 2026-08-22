<script lang="ts">
    import SlidingPage from "./SlidingPage.svelte";

    interface Props {
        top: boolean;
        speed?: number;
    }
    let { top: initialTop, speed = 300 }: Props = $props();
    // svelte-ignore state_referenced_locally
    let top = $state(initialTop);

    export function setTop(value: boolean) {
        top = value;
    }
</script>

<SlidingPage {top} {speed}>
    <span>content</span>
</SlidingPage>
