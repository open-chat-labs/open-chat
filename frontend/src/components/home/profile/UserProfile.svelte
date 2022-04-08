<script lang="ts">
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { CreatedUser, PartialUserSummary } from "../../../domain/user/user";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import Link from "../../Link.svelte";
    import Button from "../../Button.svelte";
    import Legend from "../../Legend.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Radio from "../../Radio.svelte";
    import Select from "../../Select.svelte";
    import TextArea from "../../TextArea.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import FontSize from "./FontSize.svelte";
    import { notificationStatus } from "../../../stores/notifications";
    import { formatICP } from "../../../utils/cryptoFormatter";
    import {
        askForNotificationPermission,
        supported as notificationsSupported,
    } from "../../../utils/notifications";
    import { _, locale } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import {
        accountSectionOpen,
        appearanceSectionOpen,
        chatsSectionOpen,
        enterSend,
        scrollStrategy,
    } from "../../../stores/settings";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { saveSeletedTheme, themeNameStore } from "theme/themes";
    import Toggle from "./Toggle.svelte";
    import { setLocale, supportedLanguages } from "i18n/i18n";
    import type { ScrollStrategy } from "../../../domain/chat/chat";
    import { toastStore } from "../../../stores/toast";
    import { rollbar } from "../../../utils/logging";
    import { userStore } from "../../../stores/user";
    import { ONE_GB, storageStore } from "../../../stores/storage";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import ManageIcpAccount from "./ManageICPAccount.svelte";
    import { currentUserKey } from "../../../fsm/home.controller";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { icpBalanceE8sStore } from "../../../stores/balance";

    const api: ServiceContainer = getContext(apiKey);
    const createdUser: CreatedUser = getContext(currentUserKey);

    const dispatch = createEventDispatcher();
    const MAX_BIO_LENGTH = 2000;

    export let user: PartialUserSummary;

    let originalBio = "";
    let userbio = "";
    let selectedLocale = ($locale as string).substring(0, 2);
    let usernameError: string | undefined = undefined;
    let bioError: string | undefined = undefined;
    let supportsNotifications = notificationsSupported();
    let saving = false;
    let validUsername: string | undefined = undefined;
    let usernameInput: UsernameInput;
    let checkingUsername: boolean;
    let manageIcpAccount: ManageIcpAccount;
    let managingIcpAccount = false;
    let balanceError: string | undefined = undefined;

    $: {
        setLocale(selectedLocale);
    }

    $: bioDirty = userbio !== originalBio;

    export function reset() {
        usernameInput.reset();
        usernameError = undefined;
        bioError = undefined;
        api.getBio().then((bio) => {
            originalBio = userbio = bio;
        });
    }

    onMount(() => {
        api.refreshAccountBalance(createdUser.icpAccount).catch((err) => {
            balanceError = "unableToRefreshAccountBalance";
            rollbar.error("Unable to refresh user's account balance", err);
        });
    });

    function whySms() {
        dispatch("showFaqQuestion", "sms_icp");
    }

    function saveUser() {
        saving = true;
        usernameError = undefined;
        bioError = undefined;
        const promises = [];

        if (bioDirty) {
            promises.push(
                api
                    .setBio(userbio)
                    .then((resp) => {
                        if (resp === "bio_too_long") {
                            bioError = "register.bioTooLong";
                        }
                    })
                    .catch((err) => {
                        toastStore.showFailureToast($_("unableToSaveUserProfile"));
                        rollbar.error("Unable to save user bio: ", err);
                    })
            );
        }

        if (validUsername !== undefined) {
            promises.push(
                api
                    .setUsername(validUsername)
                    .then((resp) => {
                        if (resp === "success") {
                            userStore.add({
                                ...user,
                                username: validUsername,
                            });
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
                        rollbar.error("Unable to save username: ", err);
                    })
            );
        }

        Promise.all(promises).finally(() => (saving = false));
    }

    function toggleNotifications() {
        if ($notificationStatus !== "granted") {
            askForNotificationPermission();
        } else {
            dispatch("unsubscribeNotifications");
        }
    }

    function selectScrollStrategy(ev: Event) {
        scrollStrategy.set((ev.target as HTMLInputElement).value as ScrollStrategy);
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

    function showManageIcp() {
        manageIcpAccount.reset();
        managingIcpAccount = true;
    }
</script>

<ManageIcpAccount bind:this={manageIcpAccount} bind:open={managingIcpAccount} />

<form class="user-form" on:submit|preventDefault={saveUser}>
    <div class="user">
        <div class="avatar">
            <EditableAvatar
                overlayIcon={true}
                image={avatarUrl(user)}
                on:imageSelected={userAvatarSelected} />
        </div>
        <div class="close" on:click={closeProfile}>
            <HoverIcon>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>

        <Legend>{$_("username")} ({$_("usernameRules")})</Legend>
        <UsernameInput
            bind:this={usernameInput}
            {api}
            originalUsername={user?.username ?? ""}
            bind:validUsername
            bind:checking={checkingUsername}
            bind:error={usernameError}>
            {#if usernameError !== undefined}
                <ErrorMessage>{$_(usernameError)}</ErrorMessage>
            {/if}
        </UsernameInput>

        <Legend>{$_("bio")} ({$_("supportsMarkdown")})</Legend>
        <TextArea
            rows={3}
            bind:value={userbio}
            invalid={false}
            maxlength={MAX_BIO_LENGTH}
            placeholder={$_("enterBio")}>
            {#if bioError !== undefined}
                <ErrorMessage>{bioError}</ErrorMessage>
            {/if}
        </TextArea>
        <div class="full-width-btn">
            <Button
                loading={saving || checkingUsername}
                disabled={(!bioDirty && validUsername === undefined) || saving}
                fill={true}
                small={true}>{$_("update")}</Button>
        </div>
    </div>

    <div class="appearance">
        <CollapsibleCard
            on:toggle={appearanceSectionOpen.toggle}
            open={$appearanceSectionOpen}
            headerText={$_("appearance")}>
            <Legend>{$_("preferredLanguage")}</Legend>
            <Select bind:value={selectedLocale}>
                {#each supportedLanguages as lang}
                    <option value={lang.code}>{lang.name}</option>
                {/each}
            </Select>

            <div class="para">
                <Legend>{$_("theme")}</Legend>
                <Toggle
                    id={"inherit-system"}
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
                {/if}
            </div>

            <div class="para">
                <Legend>{$_("fontSize")}</Legend>
                <FontSize />
            </div>
        </CollapsibleCard>
    </div>

    <div class="chats">
        <CollapsibleCard
            on:toggle={chatsSectionOpen.toggle}
            open={$chatsSectionOpen}
            headerText={$_("chats")}>
            <Toggle
                id={"enter-send"}
                on:change={() => enterSend.toggle()}
                label={$_("enterToSend")}
                checked={$enterSend} />
            {#if supportsNotifications}
                <Toggle
                    id={"notifications"}
                    disabled={$notificationStatus === "hard-denied"}
                    on:change={toggleNotifications}
                    label={$notificationStatus === "hard-denied"
                        ? $_("notificationsDisabled")
                        : $_("enableNotificationsMenu")}
                    checked={$notificationStatus === "granted"} />
            {/if}
            <Legend>{$_("scrollPosition")}</Legend>
            {#each ["latestMessage", "firstMessage", "firstMention"] as strategy}
                <Radio
                    group="scrollPosition"
                    value={strategy}
                    checked={$scrollStrategy === strategy}
                    id={strategy}
                    label={$_(strategy)}
                    on:change={selectScrollStrategy} />
            {/each}
        </CollapsibleCard>
    </div>

    <div class="account">
        <CollapsibleCard
            on:toggle={accountSectionOpen.toggle}
            open={$accountSectionOpen}
            headerText={$_("account")}>
            <div class="storage">
                <Legend>{$_("storage")}</Legend>
                {#if $storageStore.byteLimit === 0}
                    <p class="para">
                        {$_("noStorageAdvice")}
                    </p>
                    <p class="para last">
                        {$_("chooseUpgrade")}

                        <Link underline={"always"} on:click={whySms}>
                            {$_("tellMeMore")}
                        </Link>
                    </p>
                    <ButtonGroup align={"fill"}>
                        <Button on:click={() => dispatch("upgrade", "sms")} small={true}
                            >{$_("upgradeBySMS")}</Button>
                        <Button on:click={() => dispatch("upgrade", "icp")} small={true}
                            >{$_("upgradeByTransfer")}</Button>
                    </ButtonGroup>
                {:else}
                    <StorageUsage />
                    {#if $storageStore.byteLimit < ONE_GB}
                        <p class="para">{$_("chooseTransfer")}</p>
                        <div class="full-width-btn">
                            <Button
                                on:click={() => dispatch("upgrade", "icp")}
                                fill={true}
                                small={true}>{$_("upgradeStorage")}</Button>
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="icp">
                <Legend>{$_("icpAccount.balanceLabel")}</Legend>
                <div class="icp-balance">
                    <div class="icp-balance-value">
                        {formatICP($icpBalanceE8sStore.e8s, 4)}
                    </div>
                    <Button on:click={showManageIcp} fill={true} small={true}
                        >{$_("icpAccount.manage")}</Button>
                </div>
                {#if balanceError !== undefined}
                    <ErrorMessage>{$_(balanceError)}</ErrorMessage>
                {/if}
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
        .theme {
            text-align: center;
            padding: 22px;
            height: 65px;
            flex: 1;
            color: #fff;
            cursor: pointer;

            .theme-txt {
                border-bottom: $sp2 solid hotpink;
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

    .user,
    .chats,
    .account,
    .appearance {
        margin-bottom: $sp3;
        border-bottom: var(--profile-section-bd);
        color: var(--section-txt);

        @include mobile() {
            margin-bottom: 0;
            border-bottom: var(--profile-section-xs-bd);
        }
    }

    .para {
        margin-bottom: $sp4;
        &.last {
            margin-bottom: $sp4;
        }
    }

    .user-form {
        @include nice-scrollbar();
    }

    .user {
        padding: $sp4;
        background-color: var(--profile-section-bg);
        position: relative;
    }

    .close {
        position: absolute;
        top: $sp3;
        right: $sp3;
    }

    .storage {
        margin-bottom: $sp5;
    }

    .icp-balance {
        display: flex;
        gap: $sp3;
        justify-content: space-between;
    }

    .icp-balance-value {
        @include font(book, normal, fs-140);
        color: var(--input-txt);
        height: 45px;
        padding: $sp3;
        width: 100%;
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        border-radius: $sp2;
        text-align: right;
    }
</style>
