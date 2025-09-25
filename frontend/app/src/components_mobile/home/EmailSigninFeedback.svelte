<script lang="ts">
    import { iconSize } from "openchat-client";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        polling: boolean;
        code: string | undefined;
        onCopy?: (code?: string) => void;
    }

    let { polling, code, onCopy }: Props = $props();
</script>

<p>
    <Translatable
        resourceKey={i18nKey(!polling ? "loginDialog.generatingLink" : "loginDialog.checkEmail")} />

    {#if polling && code !== undefined}
        <div class="code-wrapper">
            <div class="code">
                {code}
            </div>
            <div class="copy" onclick={() => onCopy?.(code)}>
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
