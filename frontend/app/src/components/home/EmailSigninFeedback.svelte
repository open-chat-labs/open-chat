<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";

    const dispatch = createEventDispatcher();

    export let polling: boolean;
    export let code: string | undefined;
</script>

<p>
    <Translatable
        resourceKey={i18nKey(!polling ? "loginDialog.generatingLink" : "loginDialog.checkEmail")} />

    {#if polling && code !== undefined}
        <div class="code-wrapper">
            <div class="code">
                {code}
            </div>
            <div class="copy" on:click={() => dispatch("copy", code)}>
                <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </div>
    {/if}
</p>

<style lang="scss">
    .code-wrapper {
        margin-top: $sp4;
        display: flex;
        gap: $sp3;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    .code {
        font-family: Menlo, Monaco, "Courier New", monospace;
        @include font-size(fs-160);
    }

    .copy {
        cursor: pointer;
        position: relative;
        top: 2px;
    }
</style>
