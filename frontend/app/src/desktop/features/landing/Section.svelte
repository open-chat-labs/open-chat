<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        id: string;
        children?: Snippet;
    }

    let { id, children }: Props = $props();
</script>

<section {id}>
    <div class="container">
        {@render children?.()}
    </div>
</section>

<style lang="scss">
    section {
        margin-bottom: toRem(100);

        @include mobile() {
            margin-bottom: toRem(20);
        }
    }

    .container {
        position: relative;
    }
</style>
