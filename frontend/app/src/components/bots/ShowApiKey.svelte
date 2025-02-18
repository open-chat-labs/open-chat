<script lang="ts">
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import AlertBox from "../AlertBox.svelte";
    import { interpolate } from "../../i18n/i18n";
    import Markdown from "../home/Markdown.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "openchat-client";

    interface Props {
        apiKey: string;
    }

    let { apiKey }: Props = $props();

    function onCopy() {
        navigator.clipboard.writeText(apiKey);
    }
</script>

<AlertBox>
    <Markdown text={interpolate($_, i18nKey("bots.manage.copyKey"))} />
    <div class="key">
        <pre>{apiKey}</pre>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div role="button" tabindex="0" onclick={onCopy} class="copy">
            <CopyIcon size={"1rem"} color={"var(--icon-txt)"} />
        </div>
    </div>
</AlertBox>

<style lang="scss">
    .copy {
        cursor: pointer;
        transition: transform 0.2s ease;

        &:active {
            transform: scale(0.9);
        }
    }

    .key {
        display: flex;
        gap: $sp2;
        align-items: center;
        width: 100%;
        margin-top: $sp4;

        pre {
            word-break: break-all;
            flex: 1;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            margin: 0;
        }
    }
</style>
