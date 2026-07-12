<h4 class="error">
    <slot />
</h4>

<style lang="scss">
    .error {
        @include font(book, normal, fs-80);
        margin-bottom: $sp3;
        background-color: var(--error);
        color: #fff;
        padding: $sp3 $sp4;
        border-radius: var(--rd);
    }
</style>
