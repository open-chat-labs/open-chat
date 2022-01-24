<script lang="ts">
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Input from "../../Input.svelte";
    import Button from "../../Button.svelte";
    import Radio from "../../Radio.svelte";
    import Select from "../../Select.svelte";
    import TextArea from "../../TextArea.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher, onMount } from "svelte";
    import { saveSeletedTheme, themeNameStore } from "theme/themes";
    import Toggle from "./Toggle.svelte";

    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    export let user: PartialUserSummary;

    let username = "";
    let enterSend = true;
    let notifications = true;
    let currentScrollStrategy = "latest";

    onMount(() => {
        username = user?.username ?? "";
    });

    function saveUser() {}

    function selectScrollStrategy() {}

    function selectTheme(theme: string) {
        saveSeletedTheme(theme);
    }

    function toggleSystemTheme() {
        saveSeletedTheme($themeNameStore === "system" ? "light" : "system");
    }

    function toggleEnterSend() {
        enterSend = !enterSend;
    }

    function toggleNotifications() {
        notifications = !notifications;
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {}

    function closeProfile() {
        dispatch("closeProfile");
    }
</script>

<form class="user-form" on:submit|preventDefault={saveUser}>
    <div class="user">
        <EditableAvatar image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        <h4 class="photo-legend">{$_("clickToUpdateAvatar")}</h4>
        <div class="close" on:click={closeProfile}>
            <HoverIcon>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>

        <div class="legend">{$_("usernameRules")}</div>
        <Input
            invalid={false}
            bind:value={username}
            autofocus={false}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("register.enterUsername")} />

        <div class="legend">{$_("supportsMarkdown")}</div>
        <TextArea
            rows={3}
            invalid={false}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("enterBio")} />
    </div>

    <div class="appearance">
        <CollapsibleCard open={true} headerText={$_("appearance")}>
            <div class="legend">{$_("preferredLanguage")}</div>
            <Select value={"en"}>
                <option value={"en"}>English</option>
                <option value={"cn"}>Chinese</option>
            </Select>

            <div class="legend">{$_("Theme")}</div>
            <Toggle
                id={"inherit-system"}
                on:change={toggleSystemTheme}
                label={$_("inheritSystem")}
                checked={$themeNameStore === "system"} />
            {#if $themeNameStore !== "system"}
                <div class="theme-selection">
                    {#each ["dark", "light", "original"] as t}
                        <div
                            class="theme"
                            class:dark={t === "dark"}
                            class:light={t === "light"}
                            class:original={t === "original"}
                            class:selected={$themeNameStore === t}
                            on:click={() => selectTheme(t)}>
                            {$_(t)}
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
                on:change={toggleEnterSend}
                label={$_("enterToSend")}
                checked={enterSend} />
            <Toggle
                id={"notifications"}
                on:change={toggleNotifications}
                label={$_("notificationsEnabled")}
                checked={notifications} />
            <div class="legend">{$_("scrollPosition")}</div>
            {#each ["latest", "firstMessage", "firstMention"] as scrollStrategy}
                <Radio
                    group="scrollPosition"
                    value={scrollStrategy}
                    checked={currentScrollStrategy === scrollStrategy}
                    id={scrollStrategy}
                    label={$_(scrollStrategy)}
                    on:change={selectScrollStrategy} />
            {/each}
        </CollapsibleCard>
    </div>

    <!-- <div class="account">
        <CollapsibleCard open={false} headerText={$_("account")}>
            <p>thing one</p>
            <p>thing two</p>
            <p>thing three</p>
            <p>thing four</p>
        </CollapsibleCard>
    </div> -->
</form>

<div class="cta">
    <Button fill={true}>{$_("update")}</Button>
</div>

<style type="text/scss">
    $vertical-gap: $sp4;

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

            &.selected {
                @include box-shadow(1);
            }

            &.dark {
                background-color: #191919;
            }

            &.original {
                background-color: #59df59;
            }

            &.light {
                background: linear-gradient(#22a7f2, #5f2583);
            }
        }
    }

    .cta {
        position: sticky;
        bottom: 0;
        height: 57px;
        margin-top: auto;
    }

    .user,
    .chats,
    .appearance {
        margin-bottom: var(--profile-section-mg);
        border-bottom: var(--profile-section-bd);
        color: var(--section-txt);

        @include size-below(xs) {
            margin-bottom: var(--profile-section-xs-mg);
            border-bottom: var(--profile-section-xs-bd);
        }
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

    .photo-legend {
        @include font(mediumBold, normal, fs-100);
        color: var(--section-txt);
        text-align: center;
        margin-top: $sp3;
        margin-bottom: $vertical-gap;
    }

    .close {
        position: absolute;
        top: $sp3;
        right: $sp3;
        width: 40px;
        height: 40px;
    }
</style>
