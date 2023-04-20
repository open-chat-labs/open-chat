<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import { PartialUserSummary, OpenChat, AvatarSize } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import CommunityThemes from "./CommunityThemes.svelte";
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
        enterSend,
        lowBandwidth,
        referralOpen,
        statsSectionOpen,
        storageSectionOpen,
        userInfoOpen,
    } from "../../../stores/settings";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { saveSeletedTheme, themeNameStore } from "theme/themes";
    import Toggle from "../../Toggle.svelte";
    import { setLocale, supportedLanguages } from "i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import { logger } from "../../../utils/logging";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ReferUsers from "./ReferUsers.svelte";
    import Expiry from "../upgrade/Expiry.svelte";

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();
    const MAX_BIO_LENGTH = 2000;

    export let user: PartialUserSummary;

    let originalBio = "";
    let userbio = "";
    let selectedLocale = ($locale as string).substring(0, 2);
    let usernameError: string | undefined = undefined;
    let bioError: string | undefined = undefined;
    let saving = false;
    let validUsername: string | undefined = undefined;
    let checkingUsername: boolean;
    let readonly = client.isReadOnly();

    //@ts-ignore
    let version = window.OPENCHAT_WEBSITE_VERSION;

    $: userMetrics = client.userMetrics;
    $: notificationStatus = client.notificationStatus;
    $: isDiamond = client.isDiamond;
    $: canExtendDiamond = client.canExtendDiamond;
    $: {
        setLocale(selectedLocale);
    }

    $: bioDirty = userbio !== originalBio;

    onMount(() => {
        client.getBio().then((bio) => {
            originalBio = userbio = bio;
        });
    });

    function saveUser() {
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
                        toastStore.showFailureToast($_("unableToSaveUserProfile"));
                        logger.error("Unable to save user bio: ", err);
                    })
            );
        }

        if (validUsername !== undefined) {
            promises.push(
                client
                    .setUsername(user.userId, validUsername)
                    .then((resp) => {
                        if (resp === "success") {
                            validUsername = undefined;
                        } else {
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
                        toastStore.showFailureToast($_("unableToSaveUserProfile"));
                        logger.error("Unable to save username: ", err);
                    })
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

    function selectTheme(theme: string) {
        saveSeletedTheme(theme);
    }

    function toggleSystemTheme() {
        saveSeletedTheme($themeNameStore === "system" ? "light" : "system");
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        dispatch("userAvatarSelected", ev.detail);
    }

    function closeProfile() {
        dispatch("closeProfile");
    }
</script>

<SectionHeader flush={true} shadow={true}>
    <h4 class="title">{$_("profile.title")}</h4>
    <span title={$_("close")} class="close" on:click={closeProfile}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<form class="user-form" on:submit|preventDefault={saveUser}>
    <div class="user">
        <CollapsibleCard
            on:toggle={userInfoOpen.toggle}
            open={$userInfoOpen}
            headerText={$_("userInfoHeader")}>
            <div class="avatar">
                {#if readonly}
                    <Avatar
                        url={client.userAvatarUrl(user)}
                        userId={user.userId}
                        size={AvatarSize.Large} />
                {:else}
                    <EditableAvatar
                        overlayIcon={true}
                        image={client.userAvatarUrl(user)}
                        on:imageSelected={userAvatarSelected} />
                {/if}
            </div>
            <Legend label={$_("username")} rules={$_("usernameRules")} />
            <UsernameInput
                {client}
                originalUsername={user?.username ?? ""}
                disabled={readonly}
                bind:validUsername
                bind:checking={checkingUsername}
                bind:error={usernameError}>
                {#if usernameError !== undefined}
                    <ErrorMessage>{$_(usernameError)}</ErrorMessage>
                {/if}
            </UsernameInput>

            <Legend label={$_("bio")} rules={$_("supportsMarkdown")} />
            <TextArea
                rows={3}
                bind:value={userbio}
                invalid={false}
                disabled={readonly}
                maxlength={MAX_BIO_LENGTH}
                placeholder={$_("enterBio")}>
                {#if bioError !== undefined}
                    <ErrorMessage>{bioError}</ErrorMessage>
                {/if}
            </TextArea>
            <div class="full-width-btn">
                <Button
                    loading={saving || checkingUsername}
                    disabled={(!bioDirty && validUsername === undefined) || saving || readonly}
                    fill={true}
                    small>{$_("update")}</Button>
            </div>
        </CollapsibleCard>
    </div>
    <div class="appearance">
        <CollapsibleCard
            on:toggle={appearanceSectionOpen.toggle}
            open={$appearanceSectionOpen}
            headerText={$_("appearance")}>
            <Legend label={$_("preferredLanguage")} />
            <Select bind:value={selectedLocale}>
                {#each supportedLanguages as lang}
                    <option value={lang.code}>{lang.name}</option>
                {/each}
            </Select>

            <div class="para">
                <Legend label={$_("theme")} />
                <Toggle
                    id={"inherit-system"}
                    small
                    on:change={toggleSystemTheme}
                    label={$_("inheritSystem")}
                    checked={$themeNameStore === "system"} />
                {#if $themeNameStore !== "system"}
                    <div class="theme-selection">
                        {#each ["light", "dark"] as t}
                            <div
                                class="theme"
                                class:dark={t === "dark"}
                                class:light={t === "light"}
                                class:selected={$themeNameStore === t}
                                on:click={() => selectTheme(t)}>
                                <span class="theme-txt">
                                    {$_(t)}
                                </span>
                            </div>
                        {/each}
                    </div>
                    <CommunityThemes />
                {/if}
            </div>

            <div class="para">
                <Legend label={$_("fontSize")} />
                <FontSize />
            </div>
        </CollapsibleCard>
    </div>
    <div class="invite">
        <CollapsibleCard
            on:toggle={referralOpen.toggle}
            open={$referralOpen}
            headerText={$_("referralHeader")}>
            <ReferUsers />
        </CollapsibleCard>
    </div>
    <div class="chats">
        <CollapsibleCard
            on:toggle={chatsSectionOpen.toggle}
            open={$chatsSectionOpen}
            headerText={$_("chats")}>
            <Toggle
                id={"enter-send"}
                small
                on:change={() => enterSend.toggle()}
                label={$_("enterToSend")}
                checked={$enterSend} />
            {#if notificationsSupported}
                <Toggle
                    id={"notifications"}
                    small
                    disabled={$notificationStatus === "hard-denied"}
                    on:change={toggleNotifications}
                    label={$notificationStatus === "hard-denied"
                        ? $_("notificationsDisabled")
                        : $_("enableNotificationsMenu")}
                    checked={$notificationStatus === "granted"} />
            {/if}
            <Toggle
                id={"low-bandwidth"}
                small
                on:change={() => lowBandwidth.toggle()}
                label={$_("lowBandwidth")}
                checked={$lowBandwidth} />
        </CollapsibleCard>
    </div>
    {#if !readonly}
        <div class="storage">
            <CollapsibleCard
                on:toggle={storageSectionOpen.toggle}
                open={$storageSectionOpen}
                headerText={$_("upgrade.membership")}>
                <StorageUsage />

                {#if !$isDiamond}
                    <ButtonGroup align={"fill"}>
                        <Button on:click={() => dispatch("upgrade")} small
                            >{$_("upgrade.button")}</Button>
                    </ButtonGroup>
                {:else}
                    <Expiry />
                    <ButtonGroup align={"fill"}>
                        <Button
                            title={!$canExtendDiamond ? $_("upgrade.cannotExtend") : undefined}
                            disabled={!$canExtendDiamond}
                            on:click={() => dispatch("upgrade")}
                            small>{$_("upgrade.extend")}</Button>
                    </ButtonGroup>
                {/if}
            </CollapsibleCard>
        </div>
    {/if}
    <div class="stats">
        <CollapsibleCard
            on:toggle={statsSectionOpen.toggle}
            open={$statsSectionOpen}
            headerText={$_("stats.userStats")}>
            <Stats showReported stats={$userMetrics} />
        </CollapsibleCard>
    </div>
    <div class="advanced">
        <CollapsibleCard
            on:toggle={advancedSectionOpen.toggle}
            open={$advancedSectionOpen}
            headerText={$_("advanced")}>
            <div class="userid">
                <Legend label={$_("userId")} rules={$_("alsoCanisterId")} />
                <div>{user.userId}</div>
            </div>
            <div>
                <Legend label={$_("principal")} />
                <div>{client.principal}</div>
            </div>
            <div>
                <Legend label={$_("version")} rules={$_("websiteVersion")} />
                <div>{version}</div>
            </div>
        </CollapsibleCard>
    </div>
</form>

<style type="text/scss">
    $vertical-gap: $sp4;

    .full-width-btn {
        display: flex;
        justify-content: center;
        margin-top: $sp4;
    }

    .theme-selection {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp4;
        .theme {
            text-align: center;
            padding: 22px;
            height: 65px;
            flex: 1;
            color: #fff;
            cursor: pointer;

            .theme-txt {
                border-bottom: $sp2 solid var(--accent);
                padding-bottom: $sp2;
            }

            &.selected {
                @include box-shadow(2);
            }

            &.dark {
                background-color: #191919;
            }

            &.light {
                background: linear-gradient(#22a7f2, #5f2583);
            }
        }
    }

    .avatar {
        margin: $sp4 0 $sp5 0;
    }

    .userid {
        margin-bottom: $sp4;
    }

    .para {
        margin-bottom: $sp4;
        &.last {
            margin-bottom: $sp4;
        }
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

    .expiry {
        margin-bottom: $sp3;
    }

    .close {
        flex: 0 0 30px;
    }
</style>
