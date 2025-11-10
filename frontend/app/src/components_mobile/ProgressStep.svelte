<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { _ } from "svelte-i18n";
    import DoneIcon from "svelte-material-icons/CheckCircle.svelte";
    import FailedIcon from "svelte-material-icons/CloseCircle.svelte";
    import { interpolate } from "../i18n/i18n";
    import { currentTheme } from "../theme/themes";
    import Markdown from "./home/Markdown.svelte";
    import Spinner from "./icons/Spinner.svelte";

    interface Props {
        label: ResourceKey;
        status: string;
        step?: number;
    }

    let { label, status, step = 0 }: Props = $props();
</script>

<div class={`step ${status}`}>
    {#if status === "doing"}
        <div class="spinner">
            <Spinner
                size="25px"
                foregroundColour={$currentTheme.toast.success.bg}
                backgroundColour={"rgba(255,255,255,0.5)"}></Spinner>
            <div class="number">{step + 1}</div>
        </div>
    {:else if status === "overall-done"}
        <div class="icon">
            <DoneIcon size="30px" viewBox="2 2 24 24" color={$currentTheme.toast.success.bg} />
        </div>
    {:else if status === "overall-failed"}
        <div class="icon">
            <FailedIcon size="30px" viewBox="2 2 24 24" color={$currentTheme.error} />
        </div>
    {:else}
        <div class={`index ${status}`}>
            {step + 1}
        </div>
    {/if}
    <div class={`label ${status}`}>
        <Markdown text={interpolate($_, label)} />
    </div>
</div>

<style lang="scss">
    .step {
        display: flex;
        gap: $sp3;
        align-items: center;
        margin-bottom: $sp4;
        &.todo {
            color: var(--text-secondary);
            font-size: var(--typo-body-small-sz);
            line-height: var(--typo-body-small-lh);
        }
        .index {
            display: flex;
            justify-content: center;
            align-items: center;
            @include font(book, normal, fs-80);
            border: 3px solid red;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            &.todo {
                border-color: var(--txt-light);
            }
            &.done {
                border-color: var(--toast-success-bg);
            }
            &.failed {
                border-color: var(--error);
            }
        }
    }
    .spinner {
        position: relative;
        height: 25px;
        .number {
            @include font(book, normal, fs-80);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    }

    .icon {
        width: 25px;
        height: 25px;
    }
</style>
