<div class="content">
    <slot />
</div>

<style lang="scss">
    .content {
        max-width: 1440px;
        padding: 0;
        margin: 0 auto;

        @include mobile {
            width: 100%;
        }
    }
</style>
