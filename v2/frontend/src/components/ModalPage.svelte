<div class="modal-page">
    <div class="modal-page-panel">
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
        justify-content: center;
        align-items: center;
        border-radius: $sp5;
        width: 50%;
        max-width: 500px;
        background-color: var(--modal-bg);
        color: var(--modal-txt);
        box-shadow: var(--modal-sh);
        @include z-index(login);
        @include size-below(md) {
            width: 100%;
            margin: 0 $sp4;
        }
    }
</style>
