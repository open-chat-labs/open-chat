<div class="fab" on:click role="button">
    <slot />
</div>

<style lang="scss">
    .fab {
        @include z-index("fab");
        transition: background-color ease-in-out 200ms;
        width: $sp7;
        height: $sp7;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--primary);
        cursor: pointer;
        &:hover {
            background-color: var(--button-hv);
        }
    }
</style>
