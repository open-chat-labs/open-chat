<script lang="ts">
    import { _ } from "svelte-i18n";
    import TextArea from "../TextArea.svelte";
    import Legend from "../Legend.svelte";
    import Toggle from "../Toggle.svelte";
    import type { UpdatedRules, Level, ResourceKey } from "openchat-client";

    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const MAX_RULES_LENGTH = 1024;

    interface Props {
        rules: UpdatedRules;
        level: Level;
        valid: boolean;
        editing: boolean;
    }

    let { rules = $bindable(), level, valid = $bindable(false), editing }: Props = $props();

    let originalRules: UpdatedRules = { ...rules };

    let isValid = $derived(
        !rules.enabled || (rules.text.length > 0 && rules.text.length <= MAX_RULES_LENGTH),
    );
    let rulesDirty = $derived(
        rules.text !== originalRules.text || rules.enabled !== originalRules.enabled,
    );

    function buildRulesExplanation(level: Level): ResourceKey | undefined {
        switch (level) {
            case "community":
                return i18nKey("rules.communityRulesExplanation");
            case "channel":
                return i18nKey("rules.channelRulesExplanation");
            case "group":
                return undefined;
        }
    }

    function toggleRules() {
        rules.enabled = !rules.enabled;
    }

    function toggleNewVersion() {
        rules.newVersion = !rules.newVersion;
    }

    $effect(() => {
        if (isValid !== valid) {
            valid = isValid;
        }
    });
</script>

<div class="rules" class:disabled={!rules.enabled}>
    <Toggle
        small
        id="enable-rules"
        onChange={toggleRules}
        label={i18nKey("rules.enable")}
        checked={rules.enabled} />
    <div class="instructions">
        <Translatable resourceKey={i18nKey("rules.instructions", undefined, level, true)} />
    </div>

    <Legend
        label={i18nKey("rules.levelRules", undefined, level)}
        rules={buildRulesExplanation(level)} />
    <TextArea
        bind:value={rules.text}
        minlength={0}
        maxlength={MAX_RULES_LENGTH}
        rows={8}
        placeholder={i18nKey("rules.placeholder", undefined, level, true)} />
    {#if editing && rules.enabled}
        <Toggle
            id="new-version"
            onChange={toggleNewVersion}
            checked={rules.newVersion && rulesDirty}
            label={i18nKey("rules.promptExistingUsers")}
            disabled={!rulesDirty}
            small />

        <div class="instructions">
            <Translatable
                resourceKey={i18nKey(
                    "rules.promptExistingUsersInstructions",
                    undefined,
                    level,
                    true,
                )} />
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
