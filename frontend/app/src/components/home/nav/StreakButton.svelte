<script lang="ts">
    import LighteningBolt from "./LighteningBolt.svelte";

    export let enabled: boolean;
</script>

<div class:enabled class="button">
    <LighteningBolt />
</div>

<style lang="scss">
    .button {
        border-radius: 50%;
        width: toRem(48);
        height: toRem(48);

        @include mobile() {
            width: toRem(40);
            height: toRem(40);
        }
    }
</style>
