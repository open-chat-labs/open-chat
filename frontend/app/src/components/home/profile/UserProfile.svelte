<script lang="ts">
    import SectionHeader from "../../SectionHeader.svelte";
    import { PartialUserSummary, ChatMetrics, OpenChat, ONE_GB } from "openchat-client";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
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
        accountSectionOpen,
        advancedSectionOpen,
        appearanceSectionOpen,
        chatsSectionOpen,
        enterSend,
        fullScreen,
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
    import { rollbar } from "../../../utils/logging";
    import ManageCryptoAccount from "./ManageCryptoAccount.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { Cryptocurrency, cryptoCurrencyList } from "openchat-client";
    import LinkButton from "../../LinkButton.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import ReferUsers from "./ReferUsers.svelte";

    const client = getContext<OpenChat>("client");

    const dispatch = createEventDispatcher();
    const MAX_BIO_LENGTH = 2000;

    export let user: PartialUserSummary;
    export let metrics: ChatMetrics;

    let originalBio = "";
    let userbio = "";
    let selectedLocale = ($locale as string).substring(0, 2);
    let usernameError: string | undefined = undefined;
    let bioError: string | undefined = undefined;
    let saving = false;
    let validUsername: string | undefined = undefined;
    let checkingUsername: boolean;
    let selectedCryptoAccount: Cryptocurrency | undefined = undefined;
    let showManageCryptoAccount = false;
    let balanceError: string | undefined;

    //@ts-ignore
    let version = window.OPENCHAT_WEBSITE_VERSION;

    $: notificationStatus = client.notificationStatus;
    $: storageStore = client.storageStore;
    $: cryptoBalance = client.cryptoBalance;
    $: userStore = client.userStore;
    $: {
        setLocale(selectedLocale);
    }

    $: bioDirty = userbio !== originalBio;

    onMount(() => {
        client.api.getBio().then((bio) => {
            originalBio = userbio = bio;
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
                client.api
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
                        rollbar.error("Unable to save user bio: ", err);
                    })
            );
        }

        if (validUsername !== undefined) {
            promises.push(
                client.api
                    .setUsername(user.userId, validUsername)
                    .then((resp) => {
                        if (resp === "success") {
                            userStore.add({
                                ...user,
                                username: validUsername,
                            });
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
                        rollbar.error("Unable to save username: ", err);
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

    function showManageCrypto(crypto: Cryptocurrency) {
        selectedCryptoAccount = crypto;
        showManageCryptoAccount = true;
    }

    function onBalanceRefreshed() {
        balanceError = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        balanceError = ev.detail;
    }
</script>

{#if showManageCryptoAccount && selectedCryptoAccount !== undefined}
    <ManageCryptoAccount bind:token={selectedCryptoAccount} bind:open={showManageCryptoAccount} />
{/if}

<SectionHeader flush={true} shadow={true}>
    <h4 class="title">{$_("profile")}</h4>
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
                <EditableAvatar
                    overlayIcon={true}
                    image={client.userAvatarUrl(user)}
                    on:imageSelected={userAvatarSelected} />
            </div>
            <Legend>{$_("username")} ({$_("usernameRules")})</Legend>
            <UsernameInput
                {client}
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
        </CollapsibleCard>
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

            <div class="para">
                <Legend>{$_("displayWidth")}</Legend>
                <Toggle
                    id={"full-screen"}
                    on:change={() => fullScreen.toggle()}
                    label={$_("fullScreen")}
                    checked={$fullScreen} />
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
                on:change={() => enterSend.toggle()}
                label={$_("enterToSend")}
                checked={$enterSend} />
            {#if notificationsSupported}
                <Toggle
                    id={"notifications"}
                    disabled={$notificationStatus === "hard-denied"}
                    on:change={toggleNotifications}
                    label={$notificationStatus === "hard-denied"
                        ? $_("notificationsDisabled")
                        : $_("enableNotificationsMenu")}
                    checked={$notificationStatus === "granted"} />
            {/if}
        </CollapsibleCard>
    </div>
    <div class="accounts">
        <CollapsibleCard
            on:toggle={accountSectionOpen.toggle}
            open={$accountSectionOpen}
            headerText={$_("accounts")}>
            <table>
                <thead>
                    <tr>
                        <th class="token">{$_("cryptoAccount.token")}</th>
                        <th class="balance">{$_("cryptoAccount.shortBalanceLabel")}</th>
                        <th class="manage" />
                    </tr>
                </thead>
                <tbody>
                    {#if process.env.ENABLE_MULTI_CRYPTO}
                        {#each cryptoCurrencyList as token}
                            <tr>
                                <td class="token">{token.toUpperCase()}</td>
                                <td class="balance"
                                    ><BalanceWithRefresh
                                        {token}
                                        value={$cryptoBalance[token]}
                                        on:refreshed={onBalanceRefreshed}
                                        on:error={onBalanceRefreshError} /></td>
                                <td class="manage">
                                    <LinkButton
                                        underline={"hover"}
                                        on:click={() => showManageCrypto(token)}
                                        >{$_("cryptoAccount.manage")}</LinkButton>
                                </td>
                            </tr>
                        {/each}
                    {:else}
                        <tr>
                            <td class="token">ICP</td>
                            <td class="balance"
                                ><BalanceWithRefresh
                                    token={"icp"}
                                    value={$cryptoBalance["icp"]}
                                    on:refreshed={onBalanceRefreshed}
                                    on:error={onBalanceRefreshError} /></td>
                            <td class="manage">
                                <LinkButton
                                    underline={"hover"}
                                    on:click={() => showManageCrypto("icp")}
                                    >{$_("cryptoAccount.manage")}</LinkButton>
                            </td>
                        </tr>
                        <tr>
                            <td class="token"
                                >BTC <span class="coming-soon"
                                    >{$_("cryptoAccount.comingSoon")}</span
                                ></td>
                            <td class="balance">
                                <BalanceWithRefresh value={BigInt(0)} disabled />
                            </td>
                            <td class="manage" />
                        </tr>
                        <tr>
                            <td class="token"
                                >CHAT <span class="coming-soon"
                                    >{$_("cryptoAccount.comingSoon")}</span
                                ></td>
                            <td class="balance">
                                <BalanceWithRefresh value={BigInt(0)} disabled />
                            </td>
                            <td class="manage" />
                        </tr>
                    {/if}
                </tbody>
            </table>
            {#if balanceError !== undefined}
                <ErrorMessage>{balanceError}</ErrorMessage>
            {/if}
        </CollapsibleCard>
    </div>
    <div class="storage">
        <CollapsibleCard
            on:toggle={storageSectionOpen.toggle}
            open={$storageSectionOpen}
            headerText={$_("storage")}>
            {#if $storageStore.byteLimit === 0}
                <p class="para">
                    {$_("noStorageAdvice")}
                </p>
                <p class="para last">
                    {$_("chooseUpgrade")}

                    <LinkButton underline={"always"} on:click={whySms}>
                        {$_("tellMeMore")}
                    </LinkButton>
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
                        <Button on:click={() => dispatch("upgrade", "icp")} fill={true} small={true}
                            >{$_("upgradeStorage")}</Button>
                    </div>
                {/if}
            {/if}
        </CollapsibleCard>
    </div>
    <div class="stats">
        <CollapsibleCard
            on:toggle={statsSectionOpen.toggle}
            open={$statsSectionOpen}
            headerText={$_("stats.userStats")}>
            <Stats stats={metrics} />
        </CollapsibleCard>
    </div>
    <div class="advanced">
        <CollapsibleCard
            on:toggle={advancedSectionOpen.toggle}
            open={$advancedSectionOpen}
            headerText={$_("advanced")}>
            <div class="userid">
                <Legend>{$_("userId")} ({$_("alsoCanisterId")})</Legend>
                <div>{user.userId}</div>
            </div>
            <div>
                <Legend>{$_("version")} ({$_("websiteVersion")})</Legend>
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

    .userid {
        margin-bottom: $sp4;
    }

    .user,
    .chats,
    .invite,
    .accounts,
    .stats,
    .appearance,
    .storage,
    .advanced {
        margin-bottom: $sp3;
        border-bottom: var(--profile-section-bd);
        color: var(--section-txt);
    }

    .advanced {
        margin-bottom: 0;
    }

    .para {
        margin-bottom: $sp4;
        &.last {
            margin-bottom: $sp4;
        }
    }

    .user-form {
        @include nice-scrollbar();

        padding: $sp3;
        @include size-above(xl) {
            padding: $sp3 0 0 0;
        }
    }

    .accounts {
        table {
            width: 100%;
            th,
            td {
                padding: $sp3;
            }
            .token {
                text-align: left;
            }
            th.balance {
                padding-right: 38px;
                @include mobile() {
                    padding-right: 34.2px;
                }
            }
            .balance,
            .manage {
                text-align: right;
            }
        }
    }

    .title {
        flex: 1;
        padding: 0 $sp4;
    }

    .close {
        flex: 0 0 30px;
    }

    .coming-soon {
        @include font(light, normal, fs-90);
    }
</style>
