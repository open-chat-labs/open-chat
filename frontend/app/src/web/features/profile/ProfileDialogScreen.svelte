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
        chitStateStore,
        currentStreak,
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
        PremiumItem,
        premiumItemsStore,
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
    import { now500 } from "@src/stores/time";
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
        type AppChatSettings,
    } from "./profile.adapter";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import {
        AVATAR_SIZE,
        cropImage,
        PROFILE_BACKGROUND_SIZE,
        readImageFile,
        type CropArea,
    } from "@src/utils/imageCrop";
    import ImageCropDialog from "./ImageCropDialog.svelte";
    import PremiumItemDialog from "./PremiumItemDialog.svelte";

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

    // a cropped avatar or profile background, shown while it uploads
    let avatarPreview = $state<string>();
    let coverPreview = $state<string>();

    const header = $derived(
        profileProps(
            userId,
            user,
            profile,
            // the user's own CHIT, kept up to date as they claim, unlike their summary
            {
                streak: currentStreak($chitStateStore, $now500),
                balance: $chitStateStore.chitBalance,
            },
            {
                avatarUrl:
                    avatarPreview ?? buildUserAvatarUrl(blobUrlPattern, userId, profile.avatarId),
                coverUrl:
                    coverPreview ??
                    buildUserBackgroundUrl(blobUrlPattern, userId, profile.backgroundId),
            },
        ),
    );

    // whether a username is free; a check that couldn't be made is a failure to save, not "taken"
    async function checkHandle(handle: string): Promise<boolean> {
        const free = await form.username.checkNow(handle);
        if (form.username.status === "check_failed") throw new Error("username check failed");
        return free;
    }

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

    const storedChatSettings: AppChatSettings = $derived({
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
    });
    const chatSettings = $derived(chatSettingsProps(storedChatSettings));

    function toggleModerationFlag(flag: ModerationFlag): Promise<unknown> {
        return client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }

    // as the old UI: asking turns them on, off only stops showing them here. Where there are no
    // notifications, asking would throw
    async function setNotifications(on: boolean): Promise<void> {
        if (!on) return setSoftDisabled(true);
        if ($notificationStatus === "unsupported") return;
        try {
            await askForNotificationPermission();
        } catch (err) {
            console.warn("Unable to ask for notification permission", err);
        }
    }

    // the dialog sends its settings for a change of one, and shows the change until this settles
    async function changeChatSettings(next: ChatSettings): Promise<void> {
        const pending: Promise<unknown>[] = [];
        for (const key of changedChatSettings(storedChatSettings, next)) {
            switch (key) {
                case "enterSends":
                    enterSend.set(next.enterSends);
                    break;
                case "doubleClick":
                    dclickReply.set(next.doubleClick);
                    break;
                case "notifications":
                    pending.push(setNotifications(next.notifications));
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
                    pending.push(toggleModerationFlag(ModerationFlags.Offensive));
                    break;
                case "adult":
                    pending.push(toggleModerationFlag(ModerationFlags.Adult));
                    break;
                case "underReview":
                    pending.push(toggleModerationFlag(ModerationFlags.UnderReview));
                    break;
                case "ringtone":
                    selectedRingtone.set(ringtoneKeyOf(next.ringtone));
                    break;
            }
        }
        await Promise.allSettled(pending);
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

    // ---- the avatar and the profile background ----
    type ImageTarget = "avatar" | "cover";
    type ImageEdit =
        | { kind: "none" }
        // the profile background is a premium item, paid for with CHIT before its first use
        | { kind: "paying" }
        | { kind: "cropping"; target: ImageTarget; source: string };

    let imageEdit = $state<ImageEdit>({ kind: "none" });
    let fileInput = $state<HTMLInputElement>();
    let picking: ImageTarget = "avatar";
    // one upload at a time for each: another would race it to the store (and the preview)
    const uploading = $state<Record<ImageTarget, boolean>>({ avatar: false, cover: false });

    const FAILURES: Record<ImageTarget, string> = {
        avatar: "avatarUpdateFailed",
        cover: "profile.backgroundUpdateFailed",
    };

    function pick(target: ImageTarget) {
        if (uploading[target]) return;
        picking = target;
        fileInput?.click();
    }

    function editCover() {
        if ($premiumItemsStore.has(PremiumItem.CustomProfileBackground)) pick("cover");
        else imageEdit = { kind: "paying" };
    }

    async function picked(e: { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file === undefined) return;
        const target = picking;
        try {
            imageEdit = { kind: "cropping", target, source: await readImageFile(file) };
        } catch (err) {
            console.warn("Unable to read the picked image", err);
            toastStore.showFailureToast(i18nKey(FAILURES[target]));
        }
    }

    async function cropped(area: CropArea) {
        if (imageEdit.kind !== "cropping") return;
        const { target, source } = imageEdit;
        imageEdit = { kind: "none" };
        if (uploading[target]) return;
        const avatar = target === "avatar";
        uploading[target] = true;
        try {
            // a file that isn't an image after all (a corrupt one, HEIC named .jpg) fails here
            const size = avatar ? AVATAR_SIZE : PROFILE_BACKGROUND_SIZE;
            const image = await cropImage(source, area, size);
            if (image === undefined) throw new Error("the cropped image couldn't be encoded");
            if (avatar) avatarPreview = image.url;
            else coverPreview = image.url;
            const blobId = avatar
                ? await client.setUserAvatar(image.data, image.url)
                : await client.setUserProfileBackground(image.data);
            if (blobId === undefined) throw new Error("the upload failed");
        } catch (err) {
            console.warn(`Unable to save the ${target} image`, err);
            toastStore.showFailureToast(i18nKey(FAILURES[target]));
        } finally {
            // the saved image's URL from now on (the client has its id), or what was there before
            if (avatar) avatarPreview = undefined;
            else coverPreview = undefined;
            uploading[target] = false;
        }
    }
</script>

<!-- each prop on its own: a spread that changes (the streak's clock) would take the dialog back to
     its first section -->
<ProfileDialog
    userId={header.userId}
    handle={header.handle}
    name={header.name}
    about={header.about}
    joined={header.joined}
    streak={header.streak}
    balance={header.balance}
    isDiamond={header.isDiamond}
    isVerified={header.isVerified}
    avatar={header.avatar}
    cover={header.cover}
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
    {checkHandle}
    onLogout={() => client.logout()}
    onChatSettings={changeChatSettings}
    onPreviewRingtone={previewRingtone}
    onAppearance={changeAppearance}
    onPhotoEdit={readOnly ? undefined : () => pick("avatar")}
    onCoverEdit={readOnly ? undefined : editCover} />

<input
    hidden
    type="file"
    accept=".jpg, .jpeg, .png, .gif, .svg"
    onchange={picked}
    bind:this={fileInput} />

{#if imageEdit.kind === "paying"}
    <PremiumItemDialog
        item={PremiumItem.CustomProfileBackground}
        balance={$chitStateStore.chitBalance}
        useLabel="chooseImage"
        onUse={() => {
            imageEdit = { kind: "none" };
            pick("cover");
        }}
        onClose={() => (imageEdit = { kind: "none" })} />
{:else if imageEdit.kind === "cropping"}
    <ImageCropDialog
        source={imageEdit.source}
        size={imageEdit.target === "avatar" ? AVATAR_SIZE : PROFILE_BACKGROUND_SIZE}
        round={imageEdit.target === "avatar"}
        onCrop={cropped}
        onClose={() => (imageEdit = { kind: "none" })} />
{/if}
