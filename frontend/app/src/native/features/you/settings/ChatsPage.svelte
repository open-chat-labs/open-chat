<!-- You → Chats (native design notes §3.11): the chat and call settings the app has, as
     components_mobile's Chats & video calls and the web's profile keep them: low bandwidth, hiding
     blocked users' messages, how calls start, the ringtone (a value menu; picking one plays it for a
     moment), and which restricted communities and groups show (not in an app store build). The
     design's read receipts, typing indicator, link previews, translation and auto-download aren't
     settings the app has (GAPS.md). -->
<script lang="ts">
    import {
        adultEnabledStore,
        hideMessagesFromDirectBlocked,
        ModerationFlags,
        moderationFlagsEnabledStore,
        offensiveEnabledStore,
        underReviewEnabledStore,
        type ModerationFlag,
        type OpenChat,
    } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import {
        lowBandwidth,
        videoCameraOn,
        videoMicOn,
        videoSpeakerView,
    } from "@src/stores/settings";
    import {
        Ringtone,
        RINGTONE_KEYS,
        storedRingtoneKey,
        type RingtoneKey,
    } from "@src/stores/ringtone.svelte";
    import { selectedRingtone } from "@src/stores/video";
    import { disableRestrictedContent } from "@src/utils/features";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    // how long a picked ringtone plays
    const PREVIEW_MS = 3000;

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }

    const ringtones = $derived(
        RINGTONE_KEYS.map((key) => ({ id: key, label: $_(`native.you.chats.ringtones.${key}`) })),
    );

    // the one playing, stopped after a moment, when another is picked, or when the page goes
    let playing: Ringtone | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    function stopPreview() {
        clearTimeout(stopTimer);
        playing?.stop();
        playing = undefined;
    }
    onDestroy(stopPreview);

    function pickRingtone(id: string) {
        const key: RingtoneKey = storedRingtoneKey(id);
        selectedRingtone.set(key);
        stopPreview();
        playing = new Ringtone(key, key);
        playing.toggle();
        stopTimer = setTimeout(stopPreview, PREVIEW_MS);
    }
</script>

<SettingsGroup label={$_("native.you.chats.messages")}>
    <SettingsSwitch
        label={$_("lowBandwidth")}
        help={$_("native.you.chats.lowBandwidthHelp")}
        on={$lowBandwidth}
        onChange={(on) => lowBandwidth.set(on)} />
    <SettingsSwitch
        label={$_("native.you.chats.hideBlocked")}
        help={$_("native.you.chats.hideBlockedHelp")}
        on={$hideMessagesFromDirectBlocked}
        onChange={(on) => hideMessagesFromDirectBlocked.set(on)} />
</SettingsGroup>

<SettingsGroup label={$_("native.you.chats.calls")}>
    <SettingsSwitch
        label={$_("profile.videoCameraOn")}
        help={$_("native.you.chats.cameraOnHelp")}
        on={$videoCameraOn}
        onChange={(on) => videoCameraOn.set(on)} />
    <SettingsSwitch
        label={$_("profile.videoMicOn")}
        help={$_("native.you.chats.micOnHelp")}
        on={$videoMicOn}
        onChange={(on) => videoMicOn.set(on)} />
    <SettingsSwitch
        label={$_("profile.videoSpeakerView")}
        help={$_("native.you.chats.speakerViewHelp")}
        on={$videoSpeakerView}
        onChange={(on) => videoSpeakerView.set(on)} />
    <SettingsValue
        label={$_("native.you.chats.ringtone")}
        help={$_("native.you.chats.ringtoneHelp")}
        options={ringtones}
        value={storedRingtoneKey($selectedRingtone)}
        onChange={pickRingtone} />
</SettingsGroup>

{#if !disableRestrictedContent}
    <SettingsGroup label={$_("native.you.chats.restricted")}>
        <SettingsSwitch
            label={$_("communities.offensive")}
            help={$_("native.you.chats.offensiveHelp")}
            on={$offensiveEnabledStore}
            onChange={() => toggleModerationFlag(ModerationFlags.Offensive)} />
        <SettingsSwitch
            label={$_("communities.adult")}
            help={$_("native.you.chats.adultHelp")}
            on={$adultEnabledStore}
            onChange={() => toggleModerationFlag(ModerationFlags.Adult)} />
        <SettingsSwitch
            label={$_("communities.underReview")}
            help={$_("native.you.chats.underReviewHelp")}
            on={$underReviewEnabledStore}
            onChange={() => toggleModerationFlag(ModerationFlags.UnderReview)} />
    </SettingsGroup>
{/if}
