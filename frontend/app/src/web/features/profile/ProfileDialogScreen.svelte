<!-- The user's profile and settings (?profile), ProfileDialog over the page (8c, #10129): the
     profile (name, username and bio, saved as the old UI's forms save them, app/src/logic/profile),
     stats, CHIT, chats & calls, communities, sign-in methods, appearance, storage, bots, linking a
     device, deleting the account, inviting, About and log out; Diamond opens ?diamond. What the
     dialog has that the app doesn't is in GAPS.md. -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        AuthProvider,
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
        setSoftDisabled,
        suspendedUserStore,
        userMetricsStore,
        type ModerationFlag,
        PremiumItem,
        premiumItemsStore,
        selectedAuthProviderStore,
        isDisplayNameValid,
        unlinkIdentityFailure,
        type LinkedAuthenticationPrincipal,
        type ResourceKey,
        memberDisplayNameResult,
        referralLink,
        sortedCommunitiesStore,
        storageStore,
        type BotClientConfigData,
    } from "@client";
    import ProfileDialog, {
        type ChatSettings,
        type ChitSettingsPatch,
        type ProfileSection,
        type SigninMethod,
    } from "@openchat/ui/src/features/components/ProfileDialog.svelte";
    import { fontScaleFor, fontSizeOf, isFontSize } from "@src/logic/profile/appearance";
    import { ProfileForm } from "@src/logic/profile/profileForm.svelte";
    import {
        chitPopup,
        dclickReply,
        disableChit,
        enterSend,
        hideChitIcon,
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
    import { SvelteMap } from "svelte/reactivity";
    import { _, locale } from "svelte-i18n";
    import { accentOf, accentStore } from "../../accent";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack, openFromDialog } from "../app/linkedDialogs.svelte";
    import { calendarDay } from "@src/logic/chit/claimDays";
    import {
        changedChatSettings,
        chatSettingsProps,
        profileProps,
        ringtoneKeyOf,
        statsProps,
        themePrefOf,
        type AppChatSettings,
        botConfigProps,
        communitiesProps,
        linkCodeProps,
        signinMethodsProps,
        memberDisplayNameOf,
        storageProps,
    } from "./profile.adapter";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { deleteAccount } from "@src/logic/auth/deleteAccount";
    import { clearCacheAndRestart } from "@src/utils/clearCache";
    import SignInAgainDialog from "../auth/SignInAgainDialog.svelte";
    import { SignInAgain, type SignedIn } from "../auth/signInAgain.svelte";
    import {
        IdentityLinking,
        linkedAs,
        linkingPrincipal,
        signInWithAuthClient,
        type LinkingIdentity,
        type LinkOutcome,
    } from "@src/logic/auth/identityLinking.svelte";
    import { shareLink } from "@src/utils/share";
    import { websiteVersion } from "@src/utils/openchatClient";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
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

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "profile" }>> = $props();

    const client = getContext<OpenChat>("client");
    const translate = (key: ResourceKey) => interpolate($_, key);

    // the sections built so far (ProfileDialog shows only these)
    const SECTIONS: ProfileSection[] = [
        "profile",
        "stats",
        "chit",
        "diamond",
        "chats",
        "communities",
        "appearance",
        "signin",
        "storage",
        "bots",
        "device",
        "delete",
        "invite",
        "about",
    ];
    // the About pages this app has (Learn's, and the guidelines); it has no metrics page
    const ABOUT_PAGES = [
        "features",
        "roadmap",
        "architecture",
        "whitepaper",
        "faq",
        "blog",
        "guidelines",
    ];

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

    // ---- communities ----
    const communities = $derived(
        communitiesProps($sortedCommunitiesStore, (c) =>
            client.communityAvatarUrl(c.id.communityId, c.avatar),
        ),
    );

    // the dialog shows the name until this settles, and goes back to the saved one if it throws
    async function setCommunityName(communityId: string, name: string | null): Promise<void> {
        const displayName = memberDisplayNameOf(name);
        // a name the backend would turn down isn't sent, as the old screens' DisplayNameInput
        if (displayName !== undefined && !isDisplayNameValid(displayName)) {
            throw new Error("community name not valid");
        }
        const resp = await client.setMemberDisplayName(
            { kind: "community", communityId },
            displayName,
        );
        const result = memberDisplayNameResult(resp);
        // TODO(design): the dialog says the name couldn't be saved, not why; GAPS.md
        if (result.kind !== "saved") throw new Error(`community name not saved: ${result.kind}`);
    }

    // ---- storage, bots, invite, about ----
    const storage = $derived(storageProps($storageStore));

    // loaded the first time its section shows, as the old UI loaded it on asking; a failure is
    // tried again the next time
    let botConfig = $state<BotClientConfigData>();
    let loadingBotConfig = false;

    async function sectionShown(section: ProfileSection) {
        if (section === "signin") refreshSigninMethods();
        if (section !== "bots" || botConfig !== undefined || loadingBotConfig) return;
        loadingBotConfig = true;
        try {
            botConfig = await client.getBotConfig();
        } catch (err) {
            // the bot configuration rows stay hidden
            console.warn("Unable to load the bot configuration", err);
        } finally {
            loadingBotConfig = false;
        }
    }
    const bots = $derived(botConfig && botConfigProps(botConfig));

    const inviteLink = $derived(referralLink(client.canonicalOrigin(), userId));

    // a day in the user's locale, as the dialog shows when the account was made and when each
    // sign-in method was last used
    const dayFormat = $derived(
        new Intl.DateTimeFormat($locale ?? "en", {
            day: "numeric",
            month: "short",
            year: "numeric",
        }),
    );

    // when the account was made, as the dialog would show its `joined` (which is the calendar's day
    // for it)
    const memberSince = $derived(dayFormat.format(header.joined));

    // ---- CHIT: its settings (the old UI's, in this browser) ----
    function changeChit(patch: ChitSettingsPatch) {
        if (patch.enabled !== undefined) disableChit.set(!patch.enabled);
        if (patch.notify !== undefined) chitPopup.set(patch.notify);
        if (patch.hideAfterClaim !== undefined) hideChitIcon.set(patch.hideAfterClaim);
    }

    // ---- sign-in methods, linking a device, deleting the account ----
    // the identities linked to the account, loaded each time their section shows
    let linked = $state<LinkedAuthenticationPrincipal[]>([]);
    // methods linked here before the list had them, shown under an id of their own: the identity
    // canister gives a passkey a principal that can't be known from the sign-in. Once the list has
    // one, it keeps that id (so the dialog doesn't list it twice), and unlinking it goes to its
    // principal
    const unlisted = new SvelteMap<string, LinkingIdentity>();
    const signinMethods = $derived(
        signinMethodsProps(
            linked,
            (type) => $_(`ui.profileDialog.signin.${type}`),
            (lastUsed) =>
                $_("ui.profileDialog.signin.lastUsed", {
                    values: { date: dayFormat.format(lastUsed) },
                }),
        ).map((m) => ({
            ...m,
            id: idOf(m.id),
        })),
    );

    function idOf(principal: string): string {
        for (const [id, identity] of unlisted) {
            if (linkedAs(linked, identity)?.principal === principal) return id;
        }
        return principal;
    }

    // only the latest load counts: an earlier one answering late would put back an older list
    let signinMethodsRun = 0;

    async function refreshSigninMethods() {
        const run = ++signinMethodsRun;
        try {
            const principals = await client.getAuthenticationPrincipals();
            if (run === signinMethodsRun) linked = principals;
        } catch (err) {
            console.warn("Unable to load the sign-in methods", err);
        }
    }

    // the dialog shows the method gone until this settles, and back with a message if it throws
    async function unlinkMethod(id: string): Promise<void> {
        const identity = unlisted.get(id);
        if (identity !== undefined) await refreshSigninMethods();
        const principal = identity === undefined ? id : linkedAs(linked, identity)?.principal;
        if (principal === undefined) throw new Error("the method isn't listed yet");
        const failure = unlinkIdentityFailure(await client.removeIdentityLink(principal));
        // TODO(design): the dialog says it couldn't unlink, not why; GAPS.md
        if (failure !== undefined) throw new Error(failure.key);
        unlisted.delete(id);
        await refreshSigninMethods();
    }

    async function requestLinkCode(): Promise<{ code: string; expiresAt: number }> {
        const code = await client.createAccountLinkingCode();
        if (code === undefined) throw new Error("no device-link code");
        return linkCodeProps(code);
    }

    // linking a passkey or II (logic/auth/identityLinking), as the old UI's LinkAccounts: sign in
    // with the new method, then again the way this session signed in (only that way is offered),
    // then link the two. A rejection says why, for the dialog to show; giving up on confirming
    // cancels quietly.
    async function linkMethod(type: "passkey" | "ii"): Promise<SigninMethod> {
        const initiator = await newSignIn(type);
        if (initiator === undefined) throw failure(i18nKey("identity.failure.loginInitiator"));
        const flow = new IdentityLinking(client);
        await flow.signedIn(initiator);
        let outcome: LinkOutcome | undefined;
        let linking: Promise<LinkOutcome> | undefined;
        let givenUp = false;
        const current = linked.find((p) => p.isCurrentIdentity)?.provider;
        try {
            await signInAgain(
                $_("identity.signIn_approver"),
                async (approver) => {
                    await flow.signedIn(approver);
                    // not this session's sign-in: the user can try again
                    if (flow.stage.kind !== "ready_to_link") return flow.error;
                    // given up while that was checked: the step is cancelled, so nothing's linked
                    if (givenUp) return;
                    linking = flow.link();
                    outcome = await linking;
                },
                current ?? selectedAuthProviderStore.value,
            );
        } catch {
            // given up: quietly, unless the link had started by then; that goes on regardless, so
            // its outcome is seen through (link never rejects)
            givenUp = true;
            if (linking === undefined) throw CANCELLED;
            outcome = await linking;
        }
        if (outcome?.kind !== "linked") {
            throw failure(outcome?.reason ?? i18nKey("identity.failure.link"));
        }
        return linkedMethod(outcome.initiator, type);
    }

    // the method just linked, as the dialog lists it. It's linked whatever happens here: if the
    // reloaded list doesn't have it (yet), it's shown from the sign-in, under an id of its own
    // (unlisted), until the list has it
    async function linkedMethod(
        initiator: LinkingIdentity,
        type: "passkey" | "ii",
    ): Promise<SigninMethod> {
        await refreshSigninMethods();
        const entry = linkedAs(linked, initiator);
        const listed = entry && signinMethods.find((m) => m.id === idOf(entry.principal));
        if (listed !== undefined) return listed;
        const id = linkingPrincipal(initiator);
        unlisted.set(id, initiator);
        return { type, id, title: $_(`ui.profileDialog.signin.${type}`) };
    }

    // what the dialog's sign-in steps reject with to cancel quietly
    const CANCELLED = { cancelled: true };

    // the new method's sign-in, undefined when it didn't go through
    async function newSignIn(type: "passkey" | "ii"): Promise<LinkingIdentity | undefined> {
        if (type === "ii") return signInWithAuthClient(client, AuthProvider.II);
        try {
            const [key, delegation, webAuthnKey] = await client.signUpWithWebAuthn(false);
            return { key, delegation, webAuthnKey, provider: AuthProvider.PASSKEY };
        } catch (err) {
            console.warn("Unable to create a passkey to link", err);
        }
    }

    // what the dialog's host calls reject with to say why (AuthFailure)
    function failure(reason: ResourceKey): { reason: string } {
        return { reason: translate(reason) };
    }

    // deleting asks the user to sign in again (SignInAgain), then deletes with that sign-in
    // (logic/auth/deleteAccount); the client logs out once it's gone. The dialog's promise settles
    // when that's done, or rejects if they give up signing in.
    function deleteAccountAfterSignIn(): Promise<void> {
        return signInAgain($_("danger.reauth"), async (outcome) =>
            (await deleteAccount(client, outcome))
                ? undefined
                : i18nKey("danger.deleteAccountFailed"),
        );
    }

    // asking the user to sign in again (SignInAgainDialog), only with `only` when given; `signedIn`
    // is what it's for and may say why that then failed. Settles once that's done, or rejects if
    // they give up.
    type SigningInAgain = {
        signIn: SignInAgain;
        reason: string;
        only?: AuthProvider;
        giveUp: () => void;
    };
    let signingInAgain = $state<SigningInAgain>();

    function signInAgain(reason: string, signedIn: SignedIn, only?: AuthProvider): Promise<void> {
        // one at a time: one still open (linking, when deleting starts) is given up, so its
        // promise settles and its attempts stop
        signingInAgain?.giveUp();
        return new Promise((resolve, reject) => {
            const signIn = new SignInAgain(client, translate, async (outcome) => {
                const failure = await signedIn(outcome);
                if (failure !== undefined) return failure;
                if (signingInAgain?.signIn === signIn) signingInAgain = undefined;
                resolve();
            });
            signingInAgain = {
                signIn,
                reason,
                only,
                giveUp: () => {
                    signIn.dispose();
                    if (signingInAgain?.signIn === signIn) signingInAgain = undefined;
                    reject(new Error("Signing in again given up"));
                },
            };
        });
    }
    onDestroy(() => signingInAgain?.signIn.dispose());

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
        // its Apply waits while the same image uploads (ImageCropDialog's busy), so nothing's lost
        if (uploading[target]) return;
        imageEdit = { kind: "none" };
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

    // opened from another dialog (the CHIT dialog's settings): its back arrow returns to it
    const back = $derived(canGoBack() ? goBack : undefined);
</script>

<!-- each prop on its own: a spread that changes (the streak's clock) would take the dialog back to
     its first section -->
<ProfileDialog
    userId={header.userId}
    handle={header.handle}
    name={header.name}
    about={header.about}
    joined={calendarDay(header.joined)}
    {memberSince}
    streak={header.streak}
    balance={header.balance}
    chitEarned={$chitStateStore.totalChitEarned}
    isDiamond={header.isDiamond}
    isVerified={header.isVerified}
    avatar={header.avatar}
    cover={header.cover}
    sections={SECTIONS}
    section={dialog.section}
    chitEnabled={!$disableChit}
    chitNotify={$chitPopup}
    chitHideAfterClaim={$hideChitIcon}
    onChitHistory={readOnly || $disableChit
        ? undefined
        : () => openFromDialog({ kind: "claim_history" })}
    puzzleSetting={false}
    onChitSettings={changeChit}
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
    onBack={back}
    onDiamond={() => openFromDialog({ kind: "diamond" })}
    onSave={save}
    {checkHandle}
    onLogout={() => client.logout()}
    onChatSettings={changeChatSettings}
    onPreviewRingtone={previewRingtone}
    onAppearance={changeAppearance}
    communities={communities.communities}
    communityNames={communities.communityNames}
    onCommunityName={setCommunityName}
    storageUsedMB={storage.storageUsedMB}
    storageLimitMB={storage.storageLimitMB}
    onClearCache={() => clearCacheAndRestart(client)}
    icHost={bots?.icHost}
    storageIndex={bots?.storageIndex}
    publicKey={bots?.publicKey}
    {inviteLink}
    onShareApp={shareLink}
    aboutBaseUrl={client.canonicalOrigin()}
    aboutPages={ABOUT_PAGES}
    platform="Web"
    version={websiteVersion}
    onPhotoEdit={readOnly ? undefined : () => pick("avatar")}
    onCoverEdit={readOnly ? undefined : editCover}
    onSectionChange={sectionShown}
    {signinMethods}
    onLinkMethod={readOnly ? undefined : linkMethod}
    onUnlinkMethod={unlinkMethod}
    onRequestLinkCode={client.accountLinkingCodeEnabled() ? requestLinkCode : undefined}
    onDeleteAccount={readOnly ? undefined : deleteAccountAfterSignIn}>
    {#snippet qrCode(link: string)}
        <!-- as the old UI's QRCode: a spinner while it loads, and a failure says so -->
        {#await import("svelte-qrcode-image")}
            <div class="qr-state"><Spinner size={24} /></div>
        {:then { QRCodeImage }}
            <QRCodeImage
                text={link}
                errorCorrectionLevel="Q"
                margin={0}
                altText={$_("ui.profileDialog.invite.qrAlt")} />
        {:catch}
            <div class="qr-state">{$_("qrCodeLoadFailed")}</div>
        {/await}
    {/snippet}
</ProfileDialog>

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
        busy={uploading[imageEdit.target]}
        onCrop={cropped}
        onClose={() => (imageEdit = { kind: "none" })} />
{/if}

{#if signingInAgain !== undefined}
    <SignInAgainDialog
        flow={signingInAgain.signIn}
        reason={signingInAgain.reason}
        only={signingInAgain.only}
        onClose={() => signingInAgain?.giveUp()} />
{/if}

<style>
    .qr-state {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        text-align: center;
        font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
        color: var(--ink-3);
    }
</style>
