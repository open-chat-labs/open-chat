<script lang="ts">
    import {
        type BotClientConfigData,
        type ModerationFlag,
        ModerationFlags,
        type OpenChat,
        ROLE_NONE,
        type UserSummary,
        adultEnabledStore,
        anonUserStore,
        canExtendDiamondStore,
        communitiesStore,
        hideMessagesFromDirectBlocked,
        iconSize,
        isDiamondStore,
        isLifetimeDiamondStore,
        moderationFlagsEnabledStore,
        notificationStatus,
        notificationsSupported,
        offensiveEnabledStore,
        publish,
        referralsStore,
        sortedCommunitiesStore,
        suspendedUserStore,
        underReviewEnabledStore,
        userMetricsStore,
    } from "openchat-client";
    import { ErrorCode, type PublicProfile } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import {
        editmode,
        i18nKey,
        interpolate,
        setLocale,
        supportedLanguages,
    } from "../../../i18n/i18n";
    import {
        accountsSectionOpen,
        advancedSectionOpen,
        appearanceSectionOpen,
        chatsSectionOpen,
        dclickReply,
        deleteAccountSectionOpen,
        enterSend,
        linkDeviceSectionOpen,
        lowBandwidth,
        referralOpen,
        renderPreviews,
        restrictedSectionOpen,
        statsSectionOpen,
        storageSectionOpen,
        userInfoOpen,
        verificationSectionOpen,
        videoSectionOpen,
    } from "../../../stores/settings";
    import { toastStore } from "../../../stores/toast";
    import { uniquePersonGate } from "../../../utils/access";
    import { isTouchDevice } from "../../../utils/devices";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Verified from "../../icons/Verified.svelte";
    import Legend from "../../Legend.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Select from "../../Select.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import TextArea from "../../TextArea.svelte";
    import Toggle from "../../Toggle.svelte";
    import Translatable from "../../Translatable.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import Markdown from "../Markdown.svelte";
    import Stats from "../Stats.svelte";
    import Expiry from "../upgrade/Expiry.svelte";
    import AccountLinkingCode from "./AccountLinkingCode.svelte";
    import BotConfigData from "./BotConfigData.svelte";
    import ChitEvents from "./ChitEvents.svelte";
    import CommunityProfile from "./CommunityProfile.svelte";
    import ConfirmDeleteAccount from "./ConfirmDeleteAccount.svelte";
    import FontSize from "./FontSize.svelte";
    import LinkedAuthAccounts from "./LinkedAuthAccounts.svelte";
    import ReferredUsersList from "./ReferredUsersList.svelte";
    import ReferUsers from "./ReferUsers.svelte";
    import ThemeSelector from "./ThemeSelector.svelte";
    import UserProfileCard from "./UserProfileCard.svelte";
    import VideoCallSettings from "./VideoCallSettings.svelte";

    const client = getContext<OpenChat>("client");
    const MAX_BIO_LENGTH = 2000;

    interface Props {
        user: UserSummary;
        onUnsubscribeNotifications: () => void;
        onCloseProfile: () => void;
    }

    let { user, onCloseProfile, onUnsubscribeNotifications }: Props = $props();

    let userbio = $state("");
    let selectedLocale = $state(($locale as string).substring(0, 2));
    let usernameError: string | undefined = $state(undefined);
    let displayNameError: string | undefined = $state(undefined);
    let bioError: string | undefined = $state(undefined);
    let saving = $state(false);
    let username = $state("");
    let usernameValid = $state(true);
    let displayName: string | undefined = $state(undefined);
    let displayNameValid = $state(true);
    let checkingUsername: boolean = $state(false);
    let view: "global" | "communities" | "chit" = $state("global");
    let selectedCommunityId = $state("");
    let deleting = $state(false);
    let confirmDelete = $state(false);
    let botConfigData: BotClientConfigData | undefined = $state(undefined);

    let originalUsername = $derived(user?.username ?? "");
    let originalDisplayName = $derived(user?.displayName ?? undefined);
    let selectedCommunity = $derived(
        $communitiesStore.get({
            kind: "community",
            communityId: selectedCommunityId,
        }),
    );
    let readonly = $derived($suspendedUserStore || $anonUserStore);
    let verified = $derived(user.isUniquePerson);

    //@ts-ignore
    let version = window.OC_WEBSITE_VERSION;

    $effect(() => {
        setLocale(selectedLocale);
    });

    let originalProfile = $state<PublicProfile>({
        username: "",
        displayName: undefined,
        bio: "",
        isPremium: false,
        phoneIsVerified: false,
        created: 0n,
    });
    let candidateProfile: PublicProfile = $derived.by(() => {
        return {
            ...originalProfile,
            username: username,
            displayName: displayName,
            bio: userbio,
        };
    });
    let bioDirty = $derived(userbio !== originalProfile.bio);
    let usernameDirty = $derived(username !== originalUsername);
    let displayNameDirty = $derived(displayName !== originalDisplayName);
    let buttonEnabled = $derived(
        usernameValid &&
            displayNameValid &&
            bioError === undefined &&
            (bioDirty || usernameDirty || displayNameDirty) &&
            !saving &&
            !readonly,
    );
    let canEditTranslations = $derived(!$locale?.startsWith("en"));
    let referredUserIds = $derived(new Set($referralsStore.map((r) => r.userId)));

    onMount(() => {
        if (!$anonUserStore) {
            client.getPublicProfile(user.userId).subscribe({
                onResult: (profile) => {
                    if (profile) {
                        originalProfile = profile;
                        userbio = profile.bio;
                    }
                },
            });
        }
    });

    function onBackgroundImageUpdated(blobId: bigint) {
        originalProfile.backgroundId = blobId;
    }

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlagsEnabledStore ^ flag);
    }

    function saveUser(e: Event) {
        e.preventDefault();

        if ($anonUserStore) return;

        saving = true;
        usernameError = undefined;
        bioError = undefined;
        const promises = [];

        if (bioDirty) {
            promises.push(
                client
                    .setBio(userbio)
                    .then((resp) => {
                        if (resp.kind === "error" && resp.code === ErrorCode.TextTooLong) {
                            bioError = "register.bioTooLong";
                        } else {
                            originalProfile.bio = userbio;
                        }
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                        client.logError("Unable to save user bio: ", err);
                    }),
            );
        }

        if (usernameDirty) {
            promises.push(
                client
                    .setUsername(user.userId, username)
                    .then((resp) => {
                        if (resp !== "success") {
                            if (resp === "username_taken") {
                                usernameError = "register.usernameTaken";
                            } else if (resp === "user_not_found") {
                                usernameError = "register.userNotFound";
                            } else if (resp === "username_too_short") {
                                usernameError = "register.usernameTooShort";
                            } else if (resp === "username_too_long") {
                                usernameError = "register.usernameTooLong";
                            } else if (resp === "username_invalid") {
                                usernameError = "register.usernameInvalid";
                            }
                        }
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                        client.logError("Unable to save username: ", err);
                    }),
            );
        }

        if (displayNameDirty) {
            promises.push(
                client
                    .setDisplayName(user.userId, displayName)
                    .then((resp) => {
                        if (resp !== "success") {
                            if (resp === "user_not_found") {
                                displayNameError = "register.userNotFound";
                            } else if (resp === "display_name_too_short") {
                                displayNameError = "register.displayNameTooShort";
                            } else if (resp === "display_name_too_long") {
                                displayNameError = "register.displayNameTooLong";
                            } else if (resp === "display_name_invalid") {
                                displayNameError = "register.displayNameInvalid";
                            }
                        }
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                        client.logError("Unable to save display name: ", err);
                    }),
            );
        }

        Promise.all(promises).finally(() => (saving = false));
    }

    function toggleNotifications() {
        if ($notificationStatus !== "granted") {
            client.askForNotificationPermission();
        } else {
            onUnsubscribeNotifications();
        }
    }

    function onCopy() {
        navigator.clipboard.writeText(user.userId).then(() => {
            toastStore.showSuccessToast(i18nKey("userIdCopiedToClipboard"));
        });
    }

    function getBotConfig() {
        client
            .getBotConfig()
            .then((config) => (botConfigData = config))
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("bots.config.failure"), err);
            });
    }
</script>

{#if confirmDelete}
    <ConfirmDeleteAccount bind:deleting onClose={() => (confirmDelete = false)} />
{/if}

<SectionHeader border={false} flush shadow>
    <h4 class="title"><Translatable resourceKey={i18nKey("profile.title")} /></h4>
    <span title={$_("close")} class="close" onclick={onCloseProfile}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

{#if !$anonUserStore}
    <div class="tabs">
        <div
            tabindex="0"
            role="button"
            onclick={() => (view = "global")}
            class:selected={view === "global"}
            class="tab">
            <Translatable resourceKey={i18nKey("profile.global")} />
        </div>
        <div
            tabindex="0"
            role="button"
            onclick={() => (view = "communities")}
            class:selected={view === "communities"}
            class="tab">
            <Translatable resourceKey={i18nKey("communities.communityLabel")} />
        </div>
        <div
            tabindex="0"
            role="button"
            onclick={() => (view = "chit")}
            class:selected={view === "chit"}
            class="tab">
            <Translatable resourceKey={i18nKey("CHIT")} />
        </div>
    </div>
{/if}

{#if botConfigData !== undefined}
    <BotConfigData data={botConfigData} onClose={() => (botConfigData = undefined)} />
{/if}

{#if view === "global"}
    <form use:menuCloser class="user-form" onsubmit={saveUser}>
        <div class="user">
            <CollapsibleCard
                onToggle={userInfoOpen.toggle}
                open={$userInfoOpen}
                headerText={i18nKey("userInfoHeader")}>
                <div class="profile-card">
                    <UserProfileCard
                        {onBackgroundImageUpdated}
                        profile={candidateProfile}
                        {user}
                        userProfileMode></UserProfileCard>
                </div>
                {#if $anonUserStore}
                    <div class="guest">
                        <p><Translatable resourceKey={i18nKey("guestUser")} /></p>
                        <Button onClick={() => client.updateIdentityState({ kind: "logging_in" })}
                            ><Translatable resourceKey={i18nKey("login")} /></Button>
                    </div>
                {:else}
                    <Legend label={i18nKey("username")} rules={i18nKey("usernameRules")} />
                    <UsernameInput
                        {client}
                        {originalUsername}
                        disabled={readonly}
                        bind:username
                        bind:usernameValid
                        bind:checking={checkingUsername}
                        bind:error={usernameError}>
                        {#if usernameError !== undefined}
                            <ErrorMessage
                                ><Translatable
                                    resourceKey={i18nKey(usernameError)} /></ErrorMessage>
                        {/if}
                    </UsernameInput>
                    <Legend label={i18nKey("displayName")} rules={i18nKey("displayNameRules")} />
                    <DisplayNameInput
                        {client}
                        {originalDisplayName}
                        disabled={readonly}
                        bind:displayName
                        bind:displayNameValid>
                        {#if displayNameError !== undefined}
                            <ErrorMessage
                                ><Translatable
                                    resourceKey={i18nKey(displayNameError)} /></ErrorMessage>
                        {/if}
                    </DisplayNameInput>
                    <Legend label={i18nKey("bio")} rules={i18nKey("supportsMarkdown")} />
                    <TextArea
                        rows={3}
                        bind:value={userbio}
                        invalid={false}
                        disabled={readonly}
                        maxlength={MAX_BIO_LENGTH}
                        placeholder={i18nKey("enterBio")}>
                        {#if bioError !== undefined}
                            <ErrorMessage
                                ><Translatable resourceKey={i18nKey(bioError)} /></ErrorMessage>
                        {/if}
                    </TextArea>
                    <div class="full-width-btn">
                        <Button
                            loading={saving || checkingUsername}
                            disabled={!buttonEnabled}
                            fill
                            small><Translatable resourceKey={i18nKey("update")} /></Button>
                    </div>
                {/if}
            </CollapsibleCard>
        </div>
        {#if !$anonUserStore && uniquePersonGate.enabled}
            <div class="verification">
                <CollapsibleCard
                    onToggle={verificationSectionOpen.toggle}
                    open={$verificationSectionOpen}
                    headerText={i18nKey("human.verification")}>
                    {#if verified}
                        <div class="verified">
                            <div class="icon">
                                <Verified
                                    size={"large"}
                                    {verified}
                                    tooltip={i18nKey("human.verified")} />
                            </div>
                            <div class="msg">
                                <Translatable resourceKey={i18nKey("human.already")} />
                            </div>
                        </div>
                    {:else}
                        <Translatable resourceKey={i18nKey("human.notVerified")} />
                        <div class="full-width-btn">
                            <Button onClick={() => publish("verifyHumanity")} fill small>
                                <Translatable resourceKey={i18nKey("human.verify")} />
                            </Button>
                        </div>
                    {/if}
                </CollapsibleCard>
            </div>
        {/if}
        {#if !$anonUserStore}
            <div class="linked-accounts">
                <CollapsibleCard
                    onToggle={accountsSectionOpen.toggle}
                    open={$accountsSectionOpen}
                    headerText={i18nKey("identity.linkedAccounts.section")}>
                    <LinkedAuthAccounts />
                </CollapsibleCard>
            </div>
        {/if}
        <div class="appearance">
            <CollapsibleCard
                onToggle={appearanceSectionOpen.toggle}
                open={$appearanceSectionOpen}
                headerText={i18nKey("appearance")}>
                <Legend label={i18nKey("preferredLanguage")} />
                <Select bind:value={selectedLocale}>
                    {#each supportedLanguages as lang}
                        <option value={lang.code}>{lang.name}</option>
                    {/each}
                </Select>

                {#if canEditTranslations}
                    <Toggle
                        id={"translation-mode"}
                        small
                        onChange={() => editmode.set(!$editmode)}
                        label={i18nKey("toggleTranslationEditMode")}
                        checked={$editmode} />
                {/if}

                <div class="para">
                    <Legend label={i18nKey("theme.title")} />
                    <ThemeSelector />
                </div>

                <div class="para">
                    <Legend label={i18nKey("fontSize")} />
                    <FontSize />
                </div>
            </CollapsibleCard>
        </div>
        {#if !$anonUserStore}
            <div class="invite">
                <CollapsibleCard
                    onToggle={referralOpen.toggle}
                    open={$referralOpen}
                    headerText={i18nKey("referralHeader")}>
                    <ReferUsers />
                </CollapsibleCard>
            </div>
            <ReferredUsersList referrals={referredUserIds} />
            <div class="chats">
                <CollapsibleCard
                    onToggle={chatsSectionOpen.toggle}
                    open={$chatsSectionOpen}
                    headerText={i18nKey("chats")}>
                    <Toggle
                        id={"enter-send"}
                        small
                        onChange={() => enterSend.toggle()}
                        label={i18nKey("enterToSend")}
                        checked={$enterSend} />
                    <Toggle
                        id={"dclick-reply"}
                        small
                        onChange={() => dclickReply.toggle()}
                        label={i18nKey(isTouchDevice ? "doubleTapReply" : "doubleClickReply")}
                        checked={$dclickReply} />
                    {#if notificationsSupported}
                        <Toggle
                            id={"notifications"}
                            small
                            disabled={$notificationStatus === "hard-denied"}
                            onChange={toggleNotifications}
                            label={$notificationStatus === "hard-denied"
                                ? i18nKey("notificationsDisabled")
                                : i18nKey("enableNotificationsMenu")}
                            checked={$notificationStatus === "granted"} />
                    {/if}
                    <Toggle
                        id={"low-bandwidth"}
                        small
                        onChange={() => lowBandwidth.toggle()}
                        label={i18nKey("lowBandwidth")}
                        checked={$lowBandwidth} />
                    <Toggle
                        id={"render-previews"}
                        disabled={$lowBandwidth}
                        small
                        onChange={() => renderPreviews.toggle()}
                        label={i18nKey("renderPreviews")}
                        checked={$renderPreviews && !$lowBandwidth} />
                    <Toggle
                        id={"hide-blocked"}
                        small
                        onChange={() => hideMessagesFromDirectBlocked.toggle()}
                        label={i18nKey("hideBlocked")}
                        checked={$hideMessagesFromDirectBlocked} />
                </CollapsibleCard>
            </div>
            <div class="video">
                <CollapsibleCard
                    onToggle={videoSectionOpen.toggle}
                    open={$videoSectionOpen}
                    headerText={i18nKey("profile.videoSettings")}>
                    <VideoCallSettings />
                </CollapsibleCard>
            </div>
            <div class="restricted">
                <CollapsibleCard
                    onToggle={restrictedSectionOpen.toggle}
                    open={$restrictedSectionOpen}
                    headerText={i18nKey("restrictedContent")}>
                    <p class="blurb">
                        <Translatable resourceKey={i18nKey("restrictedContentInfo")} />
                    </p>
                    <Toggle
                        id={"offensive"}
                        small
                        onChange={() => toggleModerationFlag(ModerationFlags.Offensive)}
                        label={i18nKey("communities.offensive")}
                        checked={$offensiveEnabledStore} />
                    <Toggle
                        id={"adult"}
                        small
                        onChange={() => toggleModerationFlag(ModerationFlags.Adult)}
                        label={i18nKey("communities.adult")}
                        checked={$adultEnabledStore} />
                    <Toggle
                        id={"underReview"}
                        small
                        onChange={() => toggleModerationFlag(ModerationFlags.UnderReview)}
                        label={i18nKey("communities.underReview")}
                        checked={$underReviewEnabledStore} />
                </CollapsibleCard>
            </div>
            {#if !readonly}
                <div class="storage">
                    <CollapsibleCard
                        onToggle={storageSectionOpen.toggle}
                        open={$storageSectionOpen}
                        headerText={i18nKey("upgrade.membership")}>
                        <StorageUsage />

                        {#if !$isDiamondStore}
                            <ButtonGroup align={"fill"}>
                                <Button onClick={() => publish("upgrade")} small
                                    ><Translatable
                                        resourceKey={i18nKey("upgrade.button")} /></Button>
                            </ButtonGroup>
                        {:else if $isLifetimeDiamondStore}
                            <Translatable resourceKey={i18nKey("upgrade.lifetimeMessage")} />
                        {:else}
                            <Expiry />
                            <ButtonGroup align={"fill"}>
                                <Button
                                    title={!$canExtendDiamondStore
                                        ? $_("upgrade.cannotExtend")
                                        : undefined}
                                    disabled={!$canExtendDiamondStore}
                                    onClick={() => publish("upgrade")}
                                    small
                                    ><Translatable
                                        resourceKey={i18nKey("upgrade.extend")} /></Button>
                            </ButtonGroup>
                        {/if}
                    </CollapsibleCard>
                </div>
            {/if}
            <div class="stats">
                <CollapsibleCard
                    onToggle={statsSectionOpen.toggle}
                    open={$statsSectionOpen}
                    headerText={i18nKey("stats.userStats")}>
                    <Stats showReported stats={$userMetricsStore} />
                </CollapsibleCard>
            </div>
        {/if}
        <div class="advanced">
            <CollapsibleCard
                onToggle={advancedSectionOpen.toggle}
                open={$advancedSectionOpen}
                headerText={i18nKey("advanced")}>
                {#if !$anonUserStore}
                    <div class="userid">
                        <Legend label={i18nKey("userId")} rules={i18nKey("alsoCanisterId")} />
                        <div class="userid-txt">
                            <div>{user.userId}</div>
                            <div role="button" tabindex="0" onclick={onCopy} class="copy">
                                <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
                            </div>
                        </div>
                    </div>
                {/if}
                <div class="para">
                    <Legend label={i18nKey("version")} rules={i18nKey("websiteVersion")} />
                    <div>{version}</div>
                </div>
                <div class="para">
                    <p class="para smallprint">
                        <Translatable resourceKey={i18nKey("clearDataCacheInfo")} />
                    </p>
                    <Button
                        onClick={() =>
                            client.clearCachedData().then(() => window.location.reload())}>
                        <Translatable resourceKey={i18nKey("clearDataCache")} />
                    </Button>
                </div>

                <div class="para">
                    <p class="para smallprint">
                        <Markdown text={interpolate($_, i18nKey("bots.config.info"))}></Markdown>
                    </p>
                    <Button onClick={getBotConfig}>
                        <Translatable resourceKey={i18nKey("bots.config.title")} />
                    </Button>
                </div>
            </CollapsibleCard>
        </div>
        {#if !$anonUserStore}
            {#if client.accountLinkingCodeEnabled()}
                <div class="link-device">
                    <CollapsibleCard
                        onToggle={linkDeviceSectionOpen.toggle}
                        open={$linkDeviceSectionOpen}
                        headerText={i18nKey("accountLinkingCode.settingsMenu.title")}>
                        <AccountLinkingCode />
                    </CollapsibleCard>
                </div>
            {/if}
            <div class="danger">
                <CollapsibleCard
                    onToggle={deleteAccountSectionOpen.toggle}
                    open={$deleteAccountSectionOpen}
                    headerText={i18nKey("danger.deleteAccount")}>
                    <p class="para">
                        <Translatable resourceKey={i18nKey("danger.deleteAccountInfo")} />
                    </p>
                    <Button
                        danger
                        disabled={deleting}
                        loading={deleting}
                        onClick={() => (confirmDelete = true)}>
                        <Translatable resourceKey={i18nKey("danger.deleteAccount")} />
                    </Button>
                </CollapsibleCard>
            </div>
        {/if}
    </form>
{:else if view === "communities"}
    <div class="community-selector">
        <Legend label={i18nKey("communities.communityLabel")} />
        <Select bind:value={selectedCommunityId}>
            <option disabled selected value={""}
                ><Translatable resourceKey={i18nKey("profile.selectCommunity")} /></option>
            {#each $sortedCommunitiesStore.filter((s) => s.membership?.role !== ROLE_NONE) as community}
                <option value={community.id.communityId}>{community.name}</option>
            {/each}
        </Select>
    </div>
    {#if selectedCommunity !== undefined}
        <CommunityProfile community={selectedCommunity} />
    {/if}
{:else if view === "chit"}
    <ChitEvents />
{/if}

<style lang="scss">
    $vertical-gap: $sp4;

    .full-width-btn {
        display: flex;
        justify-content: center;
        margin-top: $sp4;
    }

    .userid {
        margin-bottom: $sp4;
        .userid-txt {
            display: flex;
            gap: $sp3;
            align-items: center;

            .copy {
                cursor: pointer;
            }
        }
    }

    .para {
        margin-bottom: $sp4;
    }

    .smallprint {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
    }

    .user-form {
        @include nice-scrollbar();
        padding: $sp3 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
    }

    .title {
        flex: 1;
        @include font-size(fs-120);

        @include mobile() {
            padding: 0 $sp3;
        }
    }

    .blurb {
        @include font-size(fs-80);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }

    .close {
        flex: 0 0 30px;
    }

    .tabs {
        display: flex;
        text-transform: capitalize;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin: 0 $sp5;

        @include mobile() {
            gap: $sp4;
            margin: 0 $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }

    .community-selector {
        padding: $sp5 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp4 $sp4 0 $sp4;
        }
    }

    .guest {
        text-align: center;
        @include font(bold, normal, fs-120);
        margin-bottom: $sp4;

        p {
            margin-bottom: $sp4;
        }
    }

    .verified {
        display: flex;
        gap: $sp4;
        align-items: center;
    }

    .profile-card {
        margin-bottom: $sp4;
    }
</style>
