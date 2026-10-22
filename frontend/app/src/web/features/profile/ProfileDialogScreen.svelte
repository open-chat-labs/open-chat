<!-- The user's profile and settings (?profile), ProfileDialog over the page. So far: the profile
     (name, username and bio, saved as the old UI's forms save them, app/src/logic/profile), stats,
     chats & calls, appearance and log out; Diamond opens ?diamond. The other sections come with the
     rest of 8c (#10129). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        askForNotificationPermission,
        buildUserAvatarUrl,
        buildUserBackgroundUrl,
        currentUserIdStore,
        currentUserProfileStore,
        fontScaleStore,
        hideMessagesFromDirectBlocked,
        minutesOnlineStore,
        ModerationFlags,
        moderationFlagsEnabledStore,
        notificationStatus,
        offensiveEnabledStore,
        adultEnabledStore,
        underReviewEnabledStore,
        OpenChat,
        publish,
        setSoftDisabled,
        suspendedUserStore,
        userMetricsStore,
        type ModerationFlag,
    } from "@client";
    import ProfileDialog, {
        type ChatSettings,
        type ProfileSection,
    } from "@openchat/ui/src/features/components/ProfileDialog.svelte";
    import { fontScaleFor, fontSizeOf, isFontSize } from "@src/logic/profile/appearance";
    import { ProfileForm } from "@src/logic/profile/profileForm.svelte";
    import {
        dclickReply,
        disableChit,
        enterSend,
        lowBandwidth,
        videoCameraOn,
        videoMicOn,
        videoSpeakerView,
    } from "@src/stores/settings";
    import { Ringtone, selectedRingtone } from "@src/stores/video";
    import { blobUrlPattern } from "@src/utils/openchatClient";
    import { themeType } from "@theme/themes";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { accentOf, accentStore } from "../../accent";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import {
        changedChatSettings,
        chatSettingsProps,
        profileProps,
        ringtoneKeyOf,
        statsProps,
        themePrefOf,
    } from "./profile.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "profile" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the sections built so far (ProfileDialog shows only these)
    const SECTIONS: ProfileSection[] = ["profile", "stats", "diamond", "chats", "appearance"];

    const userId = $derived($currentUserIdStore);
    const user = $derived($allUsersStore.get(userId) ?? client.nullUser("unknown"));
    const profile = $derived($currentUserProfileStore);

    const readOnly = $derived($suspendedUserStore || $anonUserStore);
    // username, display name and bio (app/src/logic/profile), saved as the client keeps them
    const form = new ProfileForm(
        client,
        () => $currentUserProfileStore,
        () => readOnly,
    );
    onDestroy(() => form.destroy());
    // as it may have changed on another device since sign-in
    onMount(() => client.refreshCurrentUserProfile());

    const header = $derived(
        profileProps(user, profile, {
            avatarUrl: buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId),
            coverUrl: buildUserBackgroundUrl(blobUrlPattern, userId, profile.backgroundId),
        }),
    );

    // the dialog saves one field at a time; the username it was given was checked (checkHandle)
    async function save(fields: { name: string; handle: string; about: string }) {
        // a username checked for an edit given up isn't saved with another field
        if (form.username.value !== fields.handle) await form.username.checkNow(fields.handle);
        form.displayName = fields.name;
        form.bio = fields.about;
        const outcome = await form.save();
        // TODO(design): the dialog shows any failure as "couldn't save", not the reason; GAPS.md
        if (outcome.kind !== "saved") throw new Error(`profile not saved: ${outcome.kind}`);
    }

    const stats = $derived(statsProps($userMetricsStore, $minutesOnlineStore));
    // the engagement labels are the app's own strings, translated here
    const engagement = $derived(stats.engagement.map((e) => ({ ...e, label: $_(e.label) })));

    const chatSettings = $derived(
        chatSettingsProps({
            enterSend: $enterSend,
            doubleClickReply: $dclickReply,
            notificationsGranted: $notificationStatus === "granted",
            lowBandwidth: $lowBandwidth,
            hideBlocked: $hideMessagesFromDirectBlocked,
            cameraOn: $videoCameraOn,
            micOn: $videoMicOn,
            speakerView: $videoSpeakerView,
            offensive: $offensiveEnabledStore,
            adult: $adultEnabledStore,
            underReview: $underReviewEnabledStore,
            ringtone: $selectedRingtone,
        }),
    );

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }

    // the dialog sends all its settings for a change of one
    function changeChatSettings(next: ChatSettings) {
        for (const key of changedChatSettings(chatSettings, next)) {
            switch (key) {
                case "enterSends":
                    enterSend.set(next.enterSends);
                    break;
                case "doubleClick":
                    dclickReply.set(next.doubleClick);
                    break;
                case "notifications":
                    // as the old UI: asking turns them on, off only stops showing them here
                    if (next.notifications) askForNotificationPermission();
                    else setSoftDisabled(true);
                    break;
                case "lowBandwidth":
                    lowBandwidth.set(next.lowBandwidth);
                    break;
                case "hideBlocked":
                    hideMessagesFromDirectBlocked.set(next.hideBlocked);
                    break;
                case "cameraOn":
                    videoCameraOn.set(next.cameraOn);
                    break;
                case "micOn":
                    videoMicOn.set(next.micOn);
                    break;
                case "activeSpeaker":
                    videoSpeakerView.set(next.activeSpeaker);
                    break;
                case "offensive":
                    toggleModerationFlag(ModerationFlags.Offensive);
                    break;
                case "adult":
                    toggleModerationFlag(ModerationFlags.Adult);
                    break;
                case "underReview":
                    toggleModerationFlag(ModerationFlags.UnderReview);
                    break;
                case "ringtone":
                    selectedRingtone.set(ringtoneKeyOf(next.ringtone));
                    break;
            }
        }
    }

    function previewRingtone(tone: ChatSettings["ringtone"]): () => void {
        const ringtone = new Ringtone(ringtoneKeyOf(tone), tone);
        ringtone.toggle();
        return () => ringtone.stop();
    }

    function changeAppearance(patch: { theme?: string; accent?: string; font?: string }) {
        if (patch.theme !== undefined) themeType.set(themePrefOf(patch.theme));
        if (patch.accent !== undefined) accentStore.set(accentOf(patch.accent));
        if (patch.font !== undefined && isFontSize(patch.font)) {
            fontScaleStore.set(fontScaleFor(patch.font, $fontScaleStore));
        }
    }
</script>

<ProfileDialog
    {...header}
    sections={SECTIONS}
    chitEnabled={!$disableChit}
    onlineMinutes={stats.onlineMinutes}
    onlineMinutesPrev={stats.onlineMinutesPrev}
    messageMix={stats.messageMix}
    {engagement}
    reported={stats.reported}
    {chatSettings}
    themePref={themePrefOf($themeType)}
    accentPref={$accentStore}
    fontSize={fontSizeOf($fontScaleStore)}
    {onClose}
    onDiamond={() => publish("upgrade")}
    onSave={save}
    checkHandle={(handle) => form.username.checkNow(handle)}
    onLogout={() => client.logout()}
    onChatSettings={changeChatSettings}
    onPreviewRingtone={previewRingtone}
    onAppearance={changeAppearance} />
