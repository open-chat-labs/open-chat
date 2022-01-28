<script lang="ts">
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import StorageUsage from "../../StorageUsage.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Input from "../../Input.svelte";
    import Button from "../../Button.svelte";
    import Radio from "../../Radio.svelte";
    import Select from "../../Select.svelte";
    import TextArea from "../../TextArea.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import { notificationStatus } from "../../../stores/notifications";
    import { askForNotificationPermission } from "../../../utils/notifications";
    import { supported as notificationsSupported } from "../../../utils/notifications";
    import { _, locale } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { enterSend, scrollStrategy } from "../../../stores/settings";
    import { createEventDispatcher } from "svelte";
    import { saveSeletedTheme, themeNameStore } from "theme/themes";
    import Toggle from "./Toggle.svelte";
    import { setLocale, supportedLanguages } from "i18n/i18n";
    import type { ScrollStrategy } from "../../../domain/chat/chat";
    import type { ServiceContainer } from "services/serviceContainer";
    import { toastStore } from "../../../stores/toast";
    import { rollbar } from "../../../utils/logging";
    import { userStore } from "../../../stores/user";
    import { ONE_GB, storageStore } from "../../../stores/storage";

    const dispatch = createEventDispatcher();
    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 25;
    const MAX_BIO_LENGTH = 2000;

    export let user: PartialUserSummary;
    export let api: ServiceContainer;

    let username = "";
    let originalBio = "";
    let userbio = "";
    let selectedLocale = ($locale as string).substring(0, 2);
    let dirty = false;
    let usernameError: string | undefined = undefined;
    let bioError: string | undefined = undefined;
    let supportsNotifications = notificationsSupported();
    let saving = false;

    $: {
        setLocale(selectedLocale);
    }

    $: usernameDirty = username !== user?.username ?? "";
    $: bioDirty = userbio !== originalBio;

    $: dirty = usernameDirty || bioDirty;
    $: valid = username.length >= 3;

    export function reset(user: PartialUserSummary) {
        usernameError = undefined;
        bioError = undefined;
        username = user.username ?? "";
        api.getBio().then((bio) => {
            originalBio = userbio = bio;
        });
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

        if (usernameDirty) {
            promises.push(
                api
                    .setUsername(username)
                    .then((resp) => {
                        if (resp === "success") {
                            userStore.add({
                                ...user,
                                username: username,
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
</script>

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

        <div class="legend">{$_("username")} ({$_("usernameRules")})</div>
        <Input
            invalid={false}
            bind:value={username}
            autofocus={true}
            minlength={MIN_USERNAME_LENGTH}
            maxlength={MAX_USERNAME_LENGTH}
            countdown={true}
            placeholder={$_("register.enterUsername")}>
            {#if usernameError !== undefined}
                <div class="error">{$_(usernameError)}</div>
            {/if}
        </Input>

        <div class="legend">{$_("bio")} ({$_("supportsMarkdown")})</div>
        <TextArea
            rows={3}
            bind:value={userbio}
            invalid={false}
            maxlength={MAX_BIO_LENGTH}
            placeholder={$_("enterBio")}>
            {#if bioError !== undefined}
                <div class="error">{bioError}</div>
            {/if}
        </TextArea>
        <div class="full-width-btn">
            <Button loading={saving} disabled={!dirty || !valid || saving} fill={true} small={true}
                >{$_("update")}</Button>
        </div>
    </div>

    <div class="appearance">
        <CollapsibleCard open={false} headerText={$_("appearance")}>
            <div class="legend">{$_("preferredLanguage")}</div>
            <Select disabled={true} bind:value={selectedLocale}>
                {#each supportedLanguages as lang}
                    <option value={lang.code}>{lang.name}</option>
                {/each}
            </Select>

            <div class="legend">{$_("theme")}</div>
            <Toggle
                id={"inherit-system"}
                on:change={toggleSystemTheme}
                label={$_("inheritSystem")}
                checked={$themeNameStore === "system"} />
            {#if $themeNameStore !== "system"}
                <div class="theme-selection">
                    {#each ["light", "original", "dark"] as t}
                        <div
                            class="theme"
                            class:dark={t === "dark"}
                            class:light={t === "light"}
                            class:original={t === "original"}
                            class:selected={$themeNameStore === t}
                            on:click={() => selectTheme(t)}>
                            <span class="theme-txt">
                                {$_(t)}
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </CollapsibleCard>
    </div>

    <div class="chats">
        <CollapsibleCard open={false} headerText={$_("chats")}>
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
            <div class="legend">{$_("scrollPosition")}</div>
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
        <CollapsibleCard open={true} headerText={$_("account")}>
            <div class="legend">{$_("storage")}</div>
            {#if $storageStore.byteLimit === 0}
                <p>
                    {$_("noStorageAdvice")}
                </p>
                <p>{$_("chooseUpgrade")}</p>
                <div class="full-width-btn">
                    <Button on:click={() => dispatch("upgrade", "direct")} fill={true} small={true}
                        >{$_("upgradeStorage")}</Button>
                </div>
            {:else}
                <StorageUsage />
                {#if $storageStore.byteLimit < ONE_GB}
                    <p>{$_("chooseTransfer")}</p>
                    <div class="full-width-btn">
                        <Button
                            on:click={() => dispatch("upgrade", "direct")}
                            fill={true}
                            small={true}>{$_("upgradeStorage")}</Button>
                    </div>
                {/if}
            {/if}
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

    .error {
        @include font(bold, normal, fs-100);
        text-transform: lowercase;
        color: var(--error);
        margin-bottom: $sp4;
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

            &.original {
                // background-color: #59df59;
                background-color: #3ec4ee;
                .theme-txt {
                    border-bottom-color: #59df59;
                }
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
        margin-bottom: var(--profile-section-mg);
        border-bottom: var(--profile-section-bd);
        color: var(--section-txt);

        @include size-below(xs) {
            margin-bottom: var(--profile-section-xs-mg);
            border-bottom: var(--profile-section-xs-bd);
        }
    }

    .account {
        p {
            margin-bottom: $sp3;
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

    .legend {
        @include font(light, normal, fs-60);
        margin-bottom: $sp2;
        text-transform: lowercase;
    }

    .close {
        position: absolute;
        top: $sp3;
        right: $sp3;
    }
</style>
