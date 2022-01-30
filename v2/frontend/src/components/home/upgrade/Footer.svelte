<div class="footer">
    <div class="buttons">
        <slot />
    </div>
</div>

<style type="text/scss">
    .footer {
        padding: $sp3;
        background-color: var(--modal-footer-bg);
        border-top: 1px solid var(--modal-footer-bd);
        display: flex;
        justify-content: flex-end;
        position: relative;
    }

    .buttons {
        display: flex;
    }
</style>
