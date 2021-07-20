<div class="wrapper" role="button">
    <slot />
</div>

<style type="text/scss">
    .wrapper {
        padding: $sp3;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: transparent;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;

        &:hover {
            background-color: var(--icon-hv);
        }
    }
</style>
