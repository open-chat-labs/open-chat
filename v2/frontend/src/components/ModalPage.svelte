<script lang="ts">
    export let minHeight: string | undefined = undefined;
</script>

<div class="modal-page">
    <div class="modal-page-panel" style="min-height: {minHeight}">
        <slot />
    </div>
</div>

<style type="text/scss">
    @import "../styles/mixins";

    .modal-page {
        display: flex;
        justify-content: center;
        align-items: center;
        @include fullScreenImg("../assets/underwater.jpg");
        @include fullHeight();
    }
    .modal-page-panel {
        padding: $sp5 $sp6;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        text-align: center;
        align-items: center;
        border-radius: $sp5;
        width: 50%;
        max-width: 500px;
        background-color: var(--modalPage-bg);
        color: var(--modalPage-txt);
        box-shadow: var(--modalPage-sh);
        backdrop-filter: var(--modalPage-filter);
        border: var(--modalPage-bd);
        @include z-index(login);
        @include size-below(md) {
            width: 100%;
            margin: 0 $sp4;
        }
    }
</style>
