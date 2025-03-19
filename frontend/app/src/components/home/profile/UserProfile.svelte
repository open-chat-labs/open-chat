<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import {
        type UserSummary,
        type OpenChat,
        AvatarSize,
        type ModerationFlag,
        ModerationFlags,
        hideMessagesFromDirectBlocked,
        moderationFlags,
        communities,
        communitiesList,
        anonUser,
        suspendedUser,
        userMetrics,
        notificationStatus,
        isDiamond,
        isLifetimeDiamond,
        canExtendDiamond,
        globalStateStore as globalState,
        type BotClientConfigData,
    } from "openchat-client";
    import { isTouchDevice } from "../../../utils/devices";
    import Close from "svelte-material-icons/Close.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import Avatar from "../../Avatar.svelte";
    import Button from "../../Button.svelte";
    import Legend from "../../Legend.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Select from "../../Select.svelte";
    import TextArea from "../../TextArea.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import FontSize from "./FontSize.svelte";
    import Stats from "../Stats.svelte";
    import { notificationsSupported } from "../../../utils/notifications";
    import { _, locale } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import {
        advancedSectionOpen,
        appearanceSectionOpen,
        chatsSectionOpen,
        dclickReply,
        restrictedSectionOpen,
        videoSectionOpen,
        enterSend,
        lowBandwidth,
        referralOpen,
        statsSectionOpen,
        storageSectionOpen,
        userInfoOpen,
        renderPreviews,
        verificationSectionOpen,
        accountsSectionOpen,
        deleteAccountSectionOpen,
        disableChit,
    } from "../../../stores/settings";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Toggle from "../../Toggle.svelte";
    import {
        editmode,
        i18nKey,
        interpolate,
        setLocale,
        supportedLanguages,
    } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ReferUsers from "./ReferUsers.svelte";
    import Expiry from "../upgrade/Expiry.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import CommunityProfile from "./CommunityProfile.svelte";
    import ThemeSelector from "./ThemeSelector.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import Translatable from "../../Translatable.svelte";
    import VideoCallSettings from "./VideoCallSettings.svelte";
    import ChitEvents from "./ChitEvents.svelte";
    import Verified from "../../icons/Verified.svelte";
    import { uniquePersonGate } from "../../../utils/access";
    import ReferredUsersList from "./ReferredUsersList.svelte";
    import LinkedAuthAccounts from "./LinkedAuthAccounts.svelte";
    import ConfirmDeleteAccount from "./ConfirmDeleteAccount.svelte";
    import BotConfigData from "./BotConfigData.svelte";
    import Markdown from "../Markdown.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const MAX_BIO_LENGTH = 2000;

    interface Props {
        user: UserSummary;
    }

    let { user }: Props = $props();

    let originalBio = $state("");
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
    let adultEnabled = $derived(client.hasModerationFlag($moderationFlags, ModerationFlags.Adult));
    let offensiveEnabled = $derived(
        client.hasModerationFlag($moderationFlags, ModerationFlags.Offensive),
    );
    let underReviewEnabled = $derived(
        client.hasModerationFlag($moderationFlags, ModerationFlags.UnderReview),
    );
    let selectedCommunity = $derived(
        $communities.get({
            kind: "community",
            communityId: selectedCommunityId,
        }),
    );
    let readonly = $derived($suspendedUser || $anonUser);
    let verified = $derived(user.isUniquePerson);

    //@ts-ignore
    let version = window.OC_WEBSITE_VERSION;

    $effect(() => {
        setLocale(selectedLocale);
    });

    let bioDirty = $derived(userbio !== originalBio);
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
    let referrals = $derived($globalState.referrals);
    let referredUserIds = $derived(new Set(referrals.map((r) => r.userId)));

    onMount(() => {
        if (!$anonUser) {
            client.getBio().then((bio) => {
                originalBio = userbio = bio;
            });
        }
    });

    function toggleModerationFlag(flag: ModerationFlag) {
        client.setModerationFlags($moderationFlags ^ flag);
    }

    function saveUser(e: Event) {
        e.preventDefault();

        if ($anonUser) return;

        saving = true;
        usernameError = undefined;
        bioError = undefined;
        const promises = [];

        if (bioDirty) {
            promises.push(
                client
                    .setBio(userbio)
                    .then((resp) => {
                        if (resp === "bio_too_long") {
                            bioError = "register.bioTooLong";
                        } else {
                            originalBio = userbio;
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
            dispatch("unsubscribeNotifications");
        }
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        client.setUserAvatar(ev.detail.data, ev.detail.url).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
    }

    function closeProfile() {
        dispatch("closeProfile");
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
    <span title={$_("close")} class="close" onclick={closeProfile}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

{#if !$anonUser}
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
        {#if !$disableChit}
            <div
                tabindex="0"
                role="button"
                onclick={() => (view = "chit")}
                class:selected={view === "chit"}
                class="tab">
                <Translatable resourceKey={i18nKey("CHIT")} />
            </div>
        {/if}
    </div>
{/if}

{#if botConfigData !== undefined}
    <BotConfigData data={botConfigData} onClose={() => (botConfigData = undefined)} />
{/if}

{#if view === "global"}
    <form use:menuCloser class="user-form" onsubmit={saveUser}>
        <div class="user">
            <CollapsibleCard
                on:toggle={userInfoOpen.toggle}
                open={$userInfoOpen}
                headerText={i18nKey("userInfoHeader")}>
                <div class="avatar">
                    {#if readonly}
                        <Avatar
                            url={client.userAvatarUrl(user)}
                            userId={user.userId}
                            size={AvatarSize.Large} />
                    {:else}
                        <EditableAvatar
                            overlayIcon
                            image={client.userAvatarUrl(user)}
                            on:imageSelected={userAvatarSelected} />
                    {/if}
                    <div class="human">
                        <Verified size={"large"} {verified} tooltip={i18nKey("human.verified")} />
                    </div>
                </div>
                {#if $anonUser}
                    <div class="guest">
                        <p><Translatable resourceKey={i18nKey("guestUser")} /></p>
                        <Button on:click={() => client.updateIdentityState({ kind: "logging_in" })}
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
                        on:upgrade
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
        {#if !$anonUser && uniquePersonGate.enabled}
            <div class="verification">
                <CollapsibleCard
                    on:toggle={verificationSectionOpen.toggle}
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
                            <Button on:click={() => dispatch("verifyHumanity")} fill small>
                                <Translatable resourceKey={i18nKey("human.verify")} />
                            </Button>
                        </div>
                    {/if}
                </CollapsibleCard>
            </div>
        {/if}
        <div class="linked-accounts">
            <CollapsibleCard
                on:toggle={accountsSectionOpen.toggle}
                open={$accountsSectionOpen}
                headerText={i18nKey("identity.linkedAccounts.section")}>
                <LinkedAuthAccounts />
            </CollapsibleCard>
        </div>
        <div class="appearance">
            <CollapsibleCard
                on:toggle={appearanceSectionOpen.toggle}
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
                        on:change={() => editmode.set(!$editmode)}
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
        {#if !$anonUser}
            <div class="invite">
                <CollapsibleCard
                    on:toggle={referralOpen.toggle}
                    open={$referralOpen}
                    headerText={i18nKey("referralHeader")}>
                    <ReferUsers />
                </CollapsibleCard>
            </div>
            <ReferredUsersList referrals={referredUserIds} />
            <div class="chats">
                <CollapsibleCard
                    on:toggle={chatsSectionOpen.toggle}
                    open={$chatsSectionOpen}
                    headerText={i18nKey("chats")}>
                    <Toggle
                        id={"enter-send"}
                        small
                        on:change={() => enterSend.toggle()}
                        label={i18nKey("enterToSend")}
                        checked={$enterSend} />
                    <Toggle
                        id={"dclick-reply"}
                        small
                        on:change={() => dclickReply.toggle()}
                        label={i18nKey(isTouchDevice ? "doubleTapReply" : "doubleClickReply")}
                        checked={$dclickReply} />
                    {#if notificationsSupported}
                        <Toggle
                            id={"notifications"}
                            small
                            disabled={$notificationStatus === "hard-denied"}
                            on:change={toggleNotifications}
                            label={$notificationStatus === "hard-denied"
                                ? i18nKey("notificationsDisabled")
                                : i18nKey("enableNotificationsMenu")}
                            checked={$notificationStatus === "granted"} />
                    {/if}
                    <Toggle
                        id={"low-bandwidth"}
                        small
                        on:change={() => lowBandwidth.toggle()}
                        label={i18nKey("lowBandwidth")}
                        checked={$lowBandwidth} />
                    <Toggle
                        id={"render-previews"}
                        disabled={$lowBandwidth}
                        small
                        on:change={() => renderPreviews.toggle()}
                        label={i18nKey("renderPreviews")}
                        checked={$renderPreviews && !$lowBandwidth} />
                    <Toggle
                        id={"hide-blocked"}
                        small
                        on:change={() => hideMessagesFromDirectBlocked.toggle()}
                        label={i18nKey("hideBlocked")}
                        checked={$hideMessagesFromDirectBlocked} />
                    <Toggle
                        id={"disable-chit"}
                        small
                        on:change={() => disableChit.set(!$disableChit)}
                        label={i18nKey("hideChit")}
                        checked={$disableChit} />
                </CollapsibleCard>
            </div>
            <div class="video">
                <CollapsibleCard
                    on:toggle={videoSectionOpen.toggle}
                    open={$videoSectionOpen}
                    headerText={i18nKey("profile.videoSettings")}>
                    <VideoCallSettings />
                </CollapsibleCard>
            </div>
            <div class="restricted">
                <CollapsibleCard
                    on:toggle={restrictedSectionOpen.toggle}
                    open={$restrictedSectionOpen}
                    headerText={i18nKey("restrictedContent")}>
                    <p class="blurb">
                        <Translatable resourceKey={i18nKey("restrictedContentInfo")} />
                    </p>
                    <Toggle
                        id={"offensive"}
                        small
                        on:change={() => toggleModerationFlag(ModerationFlags.Offensive)}
                        label={i18nKey("communities.offensive")}
                        checked={offensiveEnabled} />
                    <Toggle
                        id={"adult"}
                        small
                        on:change={() => toggleModerationFlag(ModerationFlags.Adult)}
                        label={i18nKey("communities.adult")}
                        checked={adultEnabled} />
                    <Toggle
                        id={"underReview"}
                        small
                        on:change={() => toggleModerationFlag(ModerationFlags.UnderReview)}
                        label={i18nKey("communities.underReview")}
                        checked={underReviewEnabled} />
                </CollapsibleCard>
            </div>
            {#if !readonly}
                <div class="storage">
                    <CollapsibleCard
                        on:toggle={storageSectionOpen.toggle}
                        open={$storageSectionOpen}
                        headerText={i18nKey("upgrade.membership")}>
                        <StorageUsage />

                        {#if !$isDiamond}
                            <ButtonGroup align={"fill"}>
                                <Button on:click={() => dispatch("upgrade")} small
                                    ><Translatable
                                        resourceKey={i18nKey("upgrade.button")} /></Button>
                            </ButtonGroup>
                        {:else if $isLifetimeDiamond}
                            <Translatable resourceKey={i18nKey("upgrade.lifetimeMessage")} />
                        {:else}
                            <Expiry />
                            <ButtonGroup align={"fill"}>
                                <Button
                                    title={!$canExtendDiamond
                                        ? $_("upgrade.cannotExtend")
                                        : undefined}
                                    disabled={!$canExtendDiamond}
                                    on:click={() => dispatch("upgrade")}
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
                    on:toggle={statsSectionOpen.toggle}
                    open={$statsSectionOpen}
                    headerText={i18nKey("stats.userStats")}>
                    <Stats showReported stats={$userMetrics} />
                </CollapsibleCard>
            </div>
        {/if}
        <div class="advanced">
            <CollapsibleCard
                on:toggle={advancedSectionOpen.toggle}
                open={$advancedSectionOpen}
                headerText={i18nKey("advanced")}>
                {#if !$anonUser}
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
                        on:click={() =>
                            client.clearCachedData().then(() => window.location.reload())}>
                        <Translatable resourceKey={i18nKey("clearDataCache")} />
                    </Button>
                </div>

                <div class="para">
                    <p class="para smallprint">
                        <Markdown text={interpolate($_, i18nKey("bots.config.info"))}></Markdown>
                    </p>
                    <Button on:click={getBotConfig}>
                        <Translatable resourceKey={i18nKey("bots.config.title")} />
                    </Button>
                </div>
            </CollapsibleCard>
        </div>
        {#if !$anonUser}
            <div class="danger">
                <CollapsibleCard
                    on:toggle={deleteAccountSectionOpen.toggle}
                    open={$deleteAccountSectionOpen}
                    headerText={i18nKey("danger.deleteAccount")}>
                    <p class="para">
                        <Translatable resourceKey={i18nKey("danger.deleteAccountInfo")} />
                    </p>
                    <Button
                        danger
                        disabled={deleting}
                        loading={deleting}
                        on:click={() => (confirmDelete = true)}>
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
            {#each $communitiesList.filter((s) => s.membership?.role !== "none") as community}
                <option value={community.id.communityId}>{community.name}</option>
            {/each}
        </Select>
    </div>
    {#if selectedCommunity !== undefined}
        <CommunityProfile on:upgrade community={selectedCommunity} />
    {/if}
{:else if view === "chit" && !$disableChit}
    <ChitEvents />
{/if}

<style lang="scss">
    $vertical-gap: $sp4;

    .full-width-btn {
        display: flex;
        justify-content: center;
        margin-top: $sp4;
    }

    .avatar {
        margin: $sp4 0 $sp5 0;
        position: relative;
    }

    .human {
        position: absolute;
        bottom: 0;
        left: calc(50% + 32px);
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
</style>
