<!-- A group's or channel's rules (native plan 11, "Rules: Enable switch, template cards,
     auto-growing text"): the switch, then while they're on, the design's templates (a card each,
     filling the text with its rules, the one the text is marked), the text, growing as it's typed,
     with its length, Clear and why it can't be saved, and, once the text has changed, whether
     members have to accept them again (the old pages' "Prompt existing members"). It edits the
     draft (`editor.rules`) until it's saved. -->
<script lang="ts">
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import {
        MAX_RULES_LENGTH,
        type UpdateGroupOrCommunityState,
    } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
    import { _ } from "svelte-i18n";
    import {
        RULE_TEMPLATES,
        rulesProblem,
        rulesProblemKey,
        templateText,
    } from "./settings.adapter";

    let { editor }: { editor: UpdateGroupOrCommunityState } = $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const rules = $derived(editor.rules);
    const templates = $derived(
        RULE_TEMPLATES.map((key) => ({ key, text: templateText(key, t) })),
    );
    const tooLong = $derived(rules.text.length > MAX_RULES_LENGTH);
    // why they can't be saved, said under the text
    const problem = $derived(rulesProblem(rules));

    function grow(el: HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }

    let field = $state<HTMLTextAreaElement>();
    function setText(text: string) {
        editor.rules.text = text;
        if (field !== undefined) {
            field.value = text;
            grow(field);
        }
    }
</script>

<div class="rules">
    <SettingsGroup>
        <SettingsSwitch
            label={$_("native.groupSettings.rules.enable")}
            help={$_("native.groupSettings.rules.enableHelp")}
            on={rules.enabled}
            disabled={editor.busy}
            onChange={(on) => (editor.rules.enabled = on)} />
    </SettingsGroup>

    {#if rules.enabled}
        <div class="section">
            <div class="label"><ListSectionLabel label={$_("native.groupSettings.rules.templates")} /></div>
            <div class="templates">
                {#each templates as template (template.key)}
                    <button
                        type="button"
                        class="template"
                        class:selected={rules.text === template.text}
                        disabled={editor.busy}
                        onclick={() => setText(template.text)}>
                        <span class="template-label">
                            {$_(`native.groupSettings.templates.${template.key}.label`)}
                        </span>
                        <span class="template-desc">
                            {$_(`native.groupSettings.templates.${template.key}.desc`)}
                        </span>
                    </button>
                {/each}
            </div>
        </div>

        <div class="section">
            <div class="label text-label">
                <ListSectionLabel label={$_("native.groupSettings.rules.text")} />
                {#if rules.text.length > 0}
                    <button type="button" class="clear" disabled={editor.busy} onclick={() => setText("")}>
                        {$_("native.groupSettings.rules.clear")}
                    </button>
                {/if}
                <span class="count" class:warn={tooLong}>{rules.text.length} / {MAX_RULES_LENGTH}</span>
            </div>
            <textarea
                bind:this={field}
                class="text"
                class:warn={!editor.rulesValid}
                value={rules.text}
                oninput={(e) => {
                    editor.rules.text = e.currentTarget.value;
                    grow(e.currentTarget);
                }}
                {@attach grow}
                rows="6"
                placeholder={$_("native.groupSettings.rules.placeholder")}
                aria-label={$_("native.groupSettings.rules.text")}
                disabled={editor.busy}></textarea>
            <span class="note" class:warn={problem !== undefined}>
                {$_(
                    problem === undefined
                        ? "native.groupSettings.rules.markdown"
                        : rulesProblemKey(problem),
                )}
            </span>
        </div>

        {#if editor.rulesChanged}
            <SettingsGroup>
                <SettingsSwitch
                    label={$_("native.groupSettings.rules.newVersion")}
                    help={$_("native.groupSettings.rules.newVersionHelp")}
                    on={rules.newVersion}
                    disabled={editor.busy}
                    onChange={(on) => (editor.rules.newVersion = on)} />
            </SettingsGroup>
        {/if}
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .rules {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) 0;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .label {
        padding-inline-start: 4px;
    }

    .text-label {
        display: flex;
        align-items: center;
        gap: 12px;

        :global(> :first-child) {
            flex: 1;
        }
    }

    .templates {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    .template {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 72px;
        padding: 12px 14px;
        box-sizing: border-box;
        border: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &.selected {
            box-shadow: inset 0 0 0 1.5px var(--accent);

            .template-label {
                color: var(--accent-bright);
            }
        }

        &:active {
            background: var(--overlay-2);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .template-label {
        font: var(--weight-semibold) text-size(14px) / 1.25 var(--font-sans);
    }

    .template-desc {
        font: var(--weight-medium) text-size(12px) / 1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .clear {
        position: relative;
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        cursor: pointer;

        // the tap area is the touch target
        &::before {
            content: "";
            position: absolute;
            inset: calc((13px - var(--touch-target)) / 2) -8px;
        }
    }

    .count {
        font: var(--weight-medium) text-size(11.5px) / 1 var(--font-mono);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }

    .text {
        display: block;
        width: 100%;
        min-height: 150px;
        box-sizing: border-box;
        padding: 14px var(--space-16);
        border: 0;
        outline: 0;
        resize: none;
        overflow: hidden;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) text-size(15px) / 1.45 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    .note {
        padding: 0 4px;
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }
</style>
