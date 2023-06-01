<script lang="ts">
    import { _ } from "svelte-i18n";
    import TextArea from "../../TextArea.svelte";
    import Legend from "../../Legend.svelte";
    import Toggle from "../../Toggle.svelte";
    import type { GroupRules } from "openchat-client";

    const MAX_RULES_LENGTH = 1024;

    export let rules: GroupRules;

    function toggleRules() {
        rules.enabled = !rules.enabled;
    }
</script>

<div class="rules" class:disabled={!rules.enabled}>
    <Toggle
        small
        id="enable-rules"
        on:change={toggleRules}
        label={$_("group.rules.enable")}
        checked={rules.enabled} />
    <div class="instructions">{$_("group.rules.instructions")}</div>

    <Legend label={"Group rules"} />
    <TextArea
        bind:value={rules.text}
        minlength={0}
        maxlength={MAX_RULES_LENGTH}
        rows={8}
        placeholder={$_("group.rules.placeholder")} />
</div>

<style type="text/scss">
    :global(.rules.disabled textarea) {
        color: var(--disabledTxt);
    }
    .rules {
        .instructions {
            @include font(book, normal, fs-80, 28);
            color: var(--txt-light);
            margin-bottom: $sp4;
        }
    }
</style>
