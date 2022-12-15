<div class="content">
    <slot />
</div>

<style type="text/scss">
    .content {
        max-width: 1440px;
        padding: 0;
        margin: 0 auto;

        @include mobile {
            width: 100%;
        }
    }
</style>
