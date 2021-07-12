<div class="error">
    <h5>
        <slot />
    </h5>
</div>

<style type="text/scss">
    .error {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: $sp3;
    }
    h5 {
        flex: 1;
        @include font(bold, normal, fs-120);
    }
</style>
