<script lang="ts">
    import type { Snippet } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    interface Props {
        adopt: Snippet;
        reject: Snippet;
        progress: Snippet;
    }

    let { adopt, reject, progress }: Props = $props();
</script>

<div class="votes">
    {#if $mobileWidth}
        <div class="buttons">
            {@render adopt()}
            {@render reject()}
        </div>
        {@render progress()}
    {:else}
        {@render adopt()}
        {@render progress()}
        {@render reject()}
    {/if}
</div>

<style lang="scss">
    .votes {
        display: flex;
        align-items: center;
        gap: $sp5;
        padding: $sp5 $sp4;
        border-bottom: 1px solid var(--bd);
        margin-bottom: $sp3;

        @include mobile() {
            padding: $sp3;
            flex-direction: column;

            .buttons {
                display: flex;
                justify-content: space-evenly;
                width: 100%;
            }
        }
    }
</style>
