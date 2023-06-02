<script lang="ts">
    export let id: string;
</script>

<section {id}>
    <div class="container">
        <slot />
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
