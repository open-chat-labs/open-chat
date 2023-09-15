<script lang="ts">
    import { _ } from "svelte-i18n";
    import TextArea from "../TextArea.svelte";
    import Legend from "../Legend.svelte";
    import Toggle from "../Toggle.svelte";
    import type { UpdatedRules, Level } from "openchat-client";
    import { interpolateLevel } from "../../utils/i18n";
    import { afterUpdate } from "svelte";

    const MAX_RULES_LENGTH = 1024;

    export let rules: UpdatedRules;
    export let level: Level;
    export let valid: boolean;
    export let editing: boolean;

    let originalRules: string = rules.text;

    $: isValid = !rules.enabled || (rules.text.length > 0 && rules.text.length <= MAX_RULES_LENGTH);
    $: rulesDirty = rules.text !== originalRules;

    function toggleRules() {
        rules.enabled = !rules.enabled;
    }

    function toggleNewVersion() {
        rules.newVersion = !rules.newVersion;
    }

    afterUpdate(() => {
        valid = isValid;
    });
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
    {#if editing && rules.enabled}
        <Toggle
            id="new-version"
            on:change={toggleNewVersion}
            checked={rules.newVersion && rulesDirty}
            label={$_("rules.promptExistingUsers")}
            disabled={!rulesDirty}
            small />

        <div class="instructions">
            {interpolateLevel("rules.promptExistingUsersInstructions", level, true)}
        </div>
    {/if}
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
