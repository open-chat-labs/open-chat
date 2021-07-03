<div class="menu-item" on:click>
    <span class="icon">
        <slot name="icon" />
    </span>
    <slot name="text" />
</div>

<style type="text/scss">
    .menu-item {
        display: flex;
        padding: 10px;
        cursor: pointer;
        border-bottom: 1px solid var(--menu-bd);
        color: var(--menu-txt);
        font-size: 14px;

        &:last-child {
            border-bottom: none;
        }

        &:hover {
            background-color: var(--menu-hv);
        }

        .icon {
            flex: 0 0 30px;
        }
    }
</style>
