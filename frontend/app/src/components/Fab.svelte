<div class="fab" on:click role="button">
    <slot />
</div>

<style type="text/scss">
    .fab {
        @include z-index("fab");
        transition: background-color ease-in-out 200ms;
        width: $sp7;
        height: $sp7;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--button-bg);
        cursor: pointer;
        &:hover {
            background-color: var(--button-hv);
        }
    }
</style>
