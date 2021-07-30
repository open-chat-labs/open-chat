<div class="section-header">
    <slot />
</div>

<style type="text/scss">
    .section-header {
        display: flex;
        position: sticky;
        top: 0;
        align-items: center;
        width: 100%;
        padding: $sp3;
        height: 60px;
        margin-bottom: $sp3;
        background-color: var(--participants-header-bg);
        border: 1px solid var(--participants-header-bd);
        color: var(--participants-header-txt);
        @include z-index("participants-header");
    }
</style>
