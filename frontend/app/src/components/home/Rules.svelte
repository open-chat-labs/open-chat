<script lang="ts">
    import { _ } from "svelte-i18n";
    import TextArea from "../TextArea.svelte";
    import Legend from "../Legend.svelte";
    import Toggle from "../Toggle.svelte";
    import type { AccessRules, Level } from "openchat-client";
    import { interpolateLevel } from "../../utils/i18n";

    const MAX_RULES_LENGTH = 1024;

    export let rules: AccessRules;
    export let level: Level;

    function toggleRules() {
        rules.enabled = !rules.enabled;
    }
</script>

<div class="rules" class:disabled={!rules.enabled}>
    <Toggle
        small
        id="enable-rules"
        on:change={toggleRules}
        label={$_("rules.enable")}
        checked={rules.enabled} />
    <div class="instructions">{interpolateLevel("rules.instructions", level, true)}</div>

    <Legend label={interpolateLevel("rules.rules", level)} />
    <TextArea
        bind:value={rules.text}
        minlength={0}
        maxlength={MAX_RULES_LENGTH}
        rows={8}
        placeholder={interpolateLevel("rules.placeholder", level, true)} />
</div>

<style lang="scss">
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
