<!-- A group's or channel's permissions (native plan 11): the Members and Moderation cards, a row
     per permission with the lowest role that has it at the end (in the accent where it's not the
     default) opening the role menu; the Messages card, who can send by default, with "Customise per
     message type" (the types' rows, each its own role or Same as default, under the switch; off,
     the types are as the defaults have them, so swap offers stay with nobody); the Threads card
     with "Separate thread permissions" (the same rows for threads under it, against the
     messages'); and Reset to defaults (the client's defaultChatPermissions), a text link under
     the cards, as the design has it. It edits the draft until it's saved.
     Someone whose role can't change them (`readOnly`: the owner's, as the backend has it) sees the
     roles only. -->
<script lang="ts">
    import {
        defaultChatPermissions,
        type ChatPermissions,
        type MessagePermissions,
    } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import type { UpdateGroupState } from "@src/logic/groupOrCommunity/group.svelte";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        changedPermissions,
        customisedPerType,
        generalRows,
        messageBaseline,
        messageTypeRows,
        PERMISSION_CARDS,
        roleId,
        roleOf,
        roleOptions,
        withMessages,
        withoutPerType,
        type GeneralPermission,
        type PermissionRow,
    } from "./settings.adapter";

    type Props = { editor: UpdateGroupState; readOnly: boolean };

    let { editor, readOnly }: Props = $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const permissions = $derived(editor.candidateGroup.permissions);
    const roles = $derived(roleOptions(t, false));
    const typeRoles = $derived(roleOptions(t, true));

    // what each set is compared with (messageBaseline): the defaults for the messages', the
    // messages' for threads'
    const messagesBaseline = $derived(messageBaseline("messagePermissions", permissions));
    const threadsBaseline = $derived(messageBaseline("threadPermissions", permissions));
    const baselineOf = (scope: Scope) =>
        scope === "messagePermissions" ? messagesBaseline : threadsBaseline;

    // whether the types' rows show: on where any type's role is other than the baseline's; off
    // puts them back as the baseline has them (withoutPerType)
    let perType = $state(
        untrack(() => customisedPerType(permissions.messagePermissions, messagesBaseline)),
    );
    let threadPerType = $state(
        untrack(() =>
            permissions.threadPermissions === undefined
                ? false
                : customisedPerType(permissions.threadPermissions, threadsBaseline),
        ),
    );

    function setPermissions(next: ChatPermissions) {
        editor.candidateGroup.permissions = next;
    }

    function setGeneral(key: GeneralPermission, id: string) {
        const role = roleOf(id);
        if (role !== undefined) setPermissions({ ...permissions, [key]: role });
    }

    type Scope = "messagePermissions" | "threadPermissions";

    // the messages' changed: threads that aren't customised per type follow their types
    // (withMessages), as their rows are hidden
    function setMessages(scope: Scope, next: MessagePermissions | undefined) {
        if (scope === "messagePermissions" && next !== undefined) {
            setPermissions(withMessages(permissions, next, threadPerType));
        } else {
            setPermissions({ ...permissions, [scope]: next });
        }
    }

    function setDefault(scope: Scope, current: MessagePermissions, id: string) {
        const role = roleOf(id);
        if (role !== undefined) setMessages(scope, { ...current, default: role });
    }

    function setType(scope: Scope, current: MessagePermissions, key: string, id: string) {
        setMessages(scope, { ...current, [key]: roleOf(id) });
    }

    function customise(scope: Scope, current: MessagePermissions, on: boolean) {
        if (scope === "messagePermissions") perType = on;
        else threadPerType = on;
        if (!on) setMessages(scope, withoutPerType(current, baselineOf(scope)));
    }

    // threads start as the messages' (so not customised against them)
    function separateThreads(on: boolean) {
        threadPerType = false;
        setMessages("threadPermissions", on ? { ...permissions.messagePermissions } : undefined);
    }

    function reset() {
        setPermissions(defaultChatPermissions());
        perType = false;
        threadPerType = false;
    }

    const changed = $derived(changedPermissions(permissions) > 0);
</script>

{#snippet roleRow(row: PermissionRow, onChange: (id: string) => void, sameAsDefault = false)}
    <SettingsValue
        label={row.label}
        options={sameAsDefault ? typeRoles : roles}
        value={row.value}
        accent={row.changed}
        {readOnly}
        {onChange} />
{/snippet}

{#snippet messageRows(scope: Scope, current: MessagePermissions, on: boolean)}
    {@render roleRow(
        {
            key: "default",
            label: t(
                scope === "threadPermissions"
                    ? "native.groupSettings.permissions.sendInThreads"
                    : "native.groupSettings.permissions.send",
            ),
            value: roleId(current.default),
            changed: current.default !== baselineOf(scope).default,
        },
        (id) => setDefault(scope, current, id),
    )}
    {#if !readOnly}
        <SettingsSwitch
            label={$_("native.groupSettings.permissions.customise")}
            help={$_("native.groupSettings.permissions.customiseHelp")}
            {on}
            disabled={editor.busy}
            onChange={(next) => customise(scope, current, next)} />
    {/if}
    {#if on || readOnly}
        {#each messageTypeRows(current, baselineOf(scope), t) as row (row.key)}
            {#if !readOnly || current[row.key as keyof MessagePermissions] !== undefined}
                {@render roleRow(row, (id) => setType(scope, current, row.key, id), true)}
            {/if}
        {/each}
    {/if}
{/snippet}

<div class="permissions">
    {#each PERMISSION_CARDS as card (card.card)}
        <SettingsGroup label={$_(`native.groupSettings.permissions.${card.card}`)}>
            {#each generalRows(permissions, card.card, t) as row (row.key)}
                {@render roleRow(row, (id) => setGeneral(row.key as GeneralPermission, id))}
            {/each}
        </SettingsGroup>
    {/each}

    <SettingsGroup label={$_("native.groupSettings.permissions.messages")}>
        {@render messageRows("messagePermissions", permissions.messagePermissions, perType)}
    </SettingsGroup>

    <SettingsGroup label={$_("native.groupSettings.permissions.threads")}>
        {#if readOnly}
            <SettingsValue
                label={$_("native.groupSettings.permissions.separateThreads")}
                options={[
                    { id: "on", label: "native.groupSettings.on" },
                    { id: "off", label: "native.you.off" },
                ]}
                value={permissions.threadPermissions === undefined ? "off" : "on"}
                readOnly
                onChange={() => {}} />
        {:else}
            <SettingsSwitch
                label={$_("native.groupSettings.permissions.separateThreads")}
                help={$_("native.groupSettings.permissions.separateThreadsHelp")}
                on={permissions.threadPermissions !== undefined}
                disabled={editor.busy}
                onChange={separateThreads} />
        {/if}
        {#if permissions.threadPermissions !== undefined}
            {@render messageRows("threadPermissions", permissions.threadPermissions, threadPerType)}
        {/if}
    </SettingsGroup>

    {#if !readOnly && changed}
        <!-- the design's: a text link under the cards -->
        <button type="button" class="reset" onclick={reset}>
            {$_("native.groupSettings.permissions.reset")}
        </button>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .reset {
        align-self: center;
        min-height: var(--touch-target);
        padding: 0 var(--space-16);
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .permissions {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) 0;
    }
</style>
