<script lang="ts">
    // TODO - not clear how this should be positioned
</script>

<div class="outer">
    <div class="inner"></div>
</div>

<style lang="scss">
    .outer {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.8rem;
        height: 0.8rem;
        .inner {
            width: 0.5rem;
            height: 0.5rem;
            background: var(--tertiary);
            border-radius: var(--rad-xs);
            transform: rotate(45deg);
            transform-origin: 50%;
        }
    }
</style>
