<!-- A chat's disappearing messages in its details' This chat card (native plan 10), a DM's or a
     group's or channel's, for those who may set them: the library's TimedToggle, as the web's.
     The switch, and "After 1 day ⌄" (or "Off") under the label; switching on opens the lengths
     (5 min … 30 days, 4 × 2), picking one closes them, tapping the row opens them again. It
     starts at a day, and switched off it keeps the length it had (logic/chats/chatDisappearing).
     One setting with the conversation menu's submenu: both save through setChatDisappearing.
     Shown at once, and back as it was with a toast if it's refused. -->
<script lang="ts">
    import type { ChatSummary, OpenChat } from "@client";
    import TimedToggle from "@openchat/ui/src/lib/components/TimedToggle.svelte";
    import {
        ChatDisappearing,
        setChatDisappearing,
    } from "@src/logic/chats/chatDisappearing.svelte";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import { durationLabel } from "./details.adapter";

    let { chat, context }: { chat: ChatSummary; context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });

    const disappear = new ChatDisappearing(
        () => chat.eventsTTL,
        (setting) => setChatDisappearing(client, chat, setting),
    );
    $effect.pre(() => {
        void chat.eventsTTL;
        untrack(() => disappear.sync());
    });

    // "After {value}" in the app's language, its placeholder kept for TimedToggle to fill in; the
    // lengths are the app's words too (the library's are English only)
    const after = $derived($_("native.details.disappearAfter", { values: { value: "{value}" } }));

    async function set(on: boolean, after: string) {
        if (!(await disappear.set(on, after))) context.toast($_("native.details.saveFailed"));
    }
</script>

<div class="settings-row">
    <TimedToggle
        label={$_("native.details.disappearing")}
        on={disappear.current.on}
        value={disappear.current.after}
        options={disappear.choices}
        valueLabel={(id) => durationLabel(id, t)}
        prefix={after}
        offHint={$_("native.you.off")}
        onChange={(on) => set(on, disappear.current.after)}
        onDurationChange={(length) => set(true, length)} />
</div>
