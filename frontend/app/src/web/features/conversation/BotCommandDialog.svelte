<!-- A bot command's arguments, asked for when what was typed after its name isn't enough (the old
     trees' CommandInstanceBuilder): what the command does, then a field per parameter it shows
     (shownParams: a parameter, or a choice, can hang on an earlier one's value), by its kind: text,
     a number, one of its choices, on or off, someone in the chat, a date and time. Send runs it
     (CommandPicker.submit), Cancel or closing drops it (CommandPicker.cancel); either way the form
     closes (CommandPicker.form).
     TODO(design): the design has no bot command dialog; drawn from the library's dialog, text
     area, chips and toggle, and the plain fields the reminder dialog uses. -->
<script lang="ts">
    import {
        type BotCommandResult,
        type CommandArg,
        type CommandParam,
        type FlattenedCommand,
        type MessageContext,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import DurationChips from "@openchat/ui/src/lib/components/DurationChips.svelte";
    import TextArea from "@openchat/ui/src/lib/components/TextArea.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import UserChip from "@openchat/ui/src/lib/components/UserChip.svelte";
    import type { CommandPicker } from "@src/logic/bots/commandPicker.svelte";
    import {
        argField,
        argFromChoice,
        argFromText,
        argText,
        choiceIndex,
        localDateTime,
    } from "@src/logic/bots/commandArgs";
    import { mentionsFor } from "@src/logic/composer/composer";
    import { now } from "@src/stores/time";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        picker: CommandPicker;
        command: FlattenedCommand;
        context: MessageContext;
        me: string;
        /** Who a user parameter's user is, by id. */
        userName: (userId: string) => string;
        /** It's running: `result` settles with how that went. */
        onSent: (result: Promise<BotCommandResult>) => void;
    }

    let { picker, command, context, me, userName, onSent }: Props = $props();

    const client = getContext<OpenChat>("client");

    const shown = $derived(picker.shown);
    // the future-only dates that have passed: shown as such, and Send waits (the picker checks too)
    const past = $derived(picker.pastDates($now));

    // a parameter's label: its name, and "Optional" for one that may be left out
    function label(param: CommandParam): string {
        const name = $_(param.name);
        return param.required ? name : `${name} (${$_("reminders.optional")})`;
    }

    function set(index: number, arg: CommandArg) {
        picker.setArg(index, arg);
    }

    // a user parameter: who in the chat matches what's typed
    let userQuery = $state<Record<number, string>>({});
    function usersFor(index: number): UserSummary[] {
        const typed = (userQuery[index] ?? "").trim();
        if (typed === "") return [];
        return mentionsFor(client, typed, me).flatMap((c) =>
            c.kind === "user_group" || c.kind === "everyone" ? [] : [c],
        );
    }

    let sending = $state(false);

    function send() {
        if (sending) return;
        const result = picker.submit(context);
        if (result === undefined) return;
        sending = true;
        onSent(result);
    }

    function cancel() {
        picker.cancel();
    }
</script>

<DialogShell title={`/${command.name}`} width={460} height="auto" onClose={cancel}>
    <form
        class="body"
        onsubmit={(e) => {
            e.preventDefault();
            send();
        }}>
        {#if command.description}
            <p class="description">{$_(command.description)}</p>
        {/if}
        {#each shown as param, i}
            {@const arg = picker.args[i]}
            {#if param !== undefined && arg !== undefined}
                {@const field = argField(param)}
                <div class="param">
                    {#if field.kind === "choice"}
                        <DurationChips
                            branch={false}
                            title={label(param)}
                            hint={param.description ? $_(param.description) : undefined}
                            options={field.names.map((n) => $_(n))}
                            value={choiceIndex(param, arg) < 0
                                ? ""
                                : $_(field.names[choiceIndex(param, arg)])}
                            selectedIndex={choiceIndex(param, arg)}
                            onChange={(_picked, index) =>
                                set(i, argFromChoice(param, arg, index))} />
                    {:else if field.kind === "toggle"}
                        <Toggle
                            on={arg.kind === "boolean" && arg.value === true}
                            label={label(param)}
                            help={param.description ? $_(param.description) : ""}
                            onChange={(on) => set(i, { kind: "boolean", name: arg.name, value: on })} />
                    {:else}
                        <label class="label" for="bot-arg-{i}">{label(param)}</label>
                        {#if param.description}
                            <p class="hint">{$_(param.description)}</p>
                        {/if}
                        {#if field.kind === "text" && field.multiLine}
                            <TextArea
                                value={argText(arg)}
                                placeholder={param.placeholder ? $_(param.placeholder) : ""}
                                maxLength={field.maxLength}
                                onInput={(e) => set(i, argFromText(arg, e.currentTarget.value))} />
                        {:else if field.kind === "text"}
                            <input
                                id="bot-arg-{i}"
                                class="input"
                                type="text"
                                maxlength={field.maxLength}
                                placeholder={param.placeholder ? $_(param.placeholder) : ""}
                                value={argText(arg)}
                                oninput={(e) => set(i, argFromText(arg, e.currentTarget.value))} />
                        {:else if field.kind === "number"}
                            <input
                                id="bot-arg-{i}"
                                class="input"
                                type="number"
                                step={field.step}
                                min={field.min}
                                max={field.max}
                                placeholder={param.placeholder ? $_(param.placeholder) : ""}
                                value={argText(arg)}
                                oninput={(e) => set(i, argFromText(arg, e.currentTarget.value))} />
                        {:else if field.kind === "date_time"}
                            <input
                                id="bot-arg-{i}"
                                class="input"
                                type="datetime-local"
                                min={field.futureOnly ? localDateTime($now) : undefined}
                                value={argText(arg)}
                                aria-invalid={past.includes(i)}
                                aria-describedby={past.includes(i) ? `bot-arg-${i}-error` : undefined}
                                oninput={(e) => set(i, argFromText(arg, e.currentTarget.value))} />
                            {#if past.includes(i)}
                                <!-- TODO(design): the old trees' words; the design has no form -->
                                <p class="error" id="bot-arg-{i}-error">
                                    {$_("mustBeFutureDateError")}
                                </p>
                            {/if}
                        {:else if field.kind === "user" && arg.kind === "user"}
                            {#if arg.userId !== undefined}
                                <div class="chosen">
                                    <UserChip
                                        label={userName(arg.userId)}
                                        showRemove
                                        onRemove={() => set(i, { ...arg, userId: undefined })} />
                                </div>
                            {:else}
                                <input
                                    id="bot-arg-{i}"
                                    class="input"
                                    type="text"
                                    autocomplete="off"
                                    placeholder={param.placeholder ? $_(param.placeholder) : ""}
                                    value={userQuery[i] ?? ""}
                                    oninput={(e) =>
                                        (userQuery = {
                                            ...userQuery,
                                            [i]: e.currentTarget.value,
                                        })} />
                                {#each usersFor(i) as user (user.userId)}
                                    <button
                                        type="button"
                                        class="user"
                                        onclick={() => set(i, { ...arg, userId: user.userId })}>
                                        <span class="user-name">{user.displayName ?? user.username}</span>
                                        <span class="user-handle">@{user.username}</span>
                                    </button>
                                {/each}
                            {/if}
                        {/if}
                    {/if}
                </div>
            {/if}
        {/each}
        <div class="actions">
            <Button label={$_("cancel")} variant="secondary" onClick={cancel} />
            <Button label={$_("send")} disabled={!picker.valid || past.length > 0 || sending} onClick={send} />
        </div>
    </form>
</DialogShell>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
    }

    .description,
    .hint {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .error {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--status-danger);
    }

    .param {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .label {
        font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .input {
        box-sizing: border-box;
        width: 100%;
        padding: var(--space-10) var(--space-14);
        border: none;
        border-radius: var(--radius-md);
        background: var(--surface-2);
        box-shadow: inset 0 0 0 1px var(--line-2);
        color: var(--ink);
        font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
        color-scheme: light dark;

        &:focus-visible {
            outline: none;
            box-shadow: inset 0 0 0 1px var(--accent);
        }
    }

    .chosen {
        display: flex;
    }

    .user {
        display: flex;
        align-items: baseline;
        gap: var(--space-8);
        padding: var(--space-8) var(--space-10);
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        text-align: start;
        cursor: pointer;

        &:hover,
        &:focus-visible {
            background: var(--overlay-1);
            outline: none;
        }
    }

    .user-name {
        font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .user-handle {
        font: var(--weight-regular) var(--text-xs) / 1.3 var(--font-sans);
        color: var(--ink-4);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
