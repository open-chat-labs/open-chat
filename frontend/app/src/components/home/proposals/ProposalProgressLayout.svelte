<script lang="ts">
    import { mobileWidth } from "../../../stores/screenDimensions";
</script>

<div class="votes">
    {#if $mobileWidth}
        <div class="buttons">
            <slot name="adopt" />
            <slot name="reject" />
        </div>
        <slot name="progress" />
    {:else}
        <slot name="adopt" />
        <slot name="progress" />
        <slot name="reject" />
    {/if}
</div>

<style type="text/scss">
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
