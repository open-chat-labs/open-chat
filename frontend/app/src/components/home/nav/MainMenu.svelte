<script lang="ts">
    import { iconSize } from "../../../stores/iconSize";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import AccountSettings from "svelte-material-icons/AccountSettingsOutline.svelte";
    import CogOutline from "svelte-material-icons/CogOutline.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import ChartLine from "svelte-material-icons/ChartLine.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Security from "svelte-material-icons/Security.svelte";
    import Menu from "../../Menu.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import page from "page";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { anonUser, platformOperator, canExtendDiamond } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    interface Props {
        onProfile: () => void;
        onWallet: () => void;
        onUpgrade: () => void;
    }

    let { onProfile, onWallet, onUpgrade }: Props = $props();

    const client = getContext<OpenChat>("client");

    let admin = $derived($platformOperator);
</script>

<Menu>
    {#if !$anonUser}
        <MenuItem onclick={onWallet}>
            <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">
                <Translatable resourceKey={i18nKey("wallet")} />
            </span>
        </MenuItem>
        <MenuItem onclick={onProfile}>
            <AccountSettings size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable resourceKey={i18nKey("profile.title")} /></span>
        </MenuItem>
        <MenuItem onclick={onUpgrade}>
            <span class="diamond-icon" slot="icon"></span>
            <span slot="text"
                ><Translatable
                    resourceKey={i18nKey(
                        $canExtendDiamond ? "upgrade.extend" : "upgrade.diamond",
                    )} /></span>
        </MenuItem>
        <MenuItem separator />
    {/if}
    <MenuItem onclick={() => page("/home")}>
        <Home size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Home page</span>
    </MenuItem>
    <MenuItem onclick={() => page("/features")}>
        <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Features</span>
    </MenuItem>
    <MenuItem onclick={() => page("/roadmap")}>
        <Road size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Roadmap</span>
    </MenuItem>
    <MenuItem onclick={() => page("/whitepaper")}>
        <Note size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Whitepaper</span>
    </MenuItem>
    <MenuItem onclick={() => page("/architecture")}>
        <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Architecture</span>
    </MenuItem>
    <MenuItem onclick={() => page("/blog")}>
        <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Blog</span>
    </MenuItem>
    <MenuItem onclick={() => page("/faq")}>
        <Help size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">FAQs</span>
    </MenuItem>
    <MenuItem onclick={() => page("/guidelines")}>
        <Security size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Guidelines</span>
    </MenuItem>
    <MenuItem href="https://tokenterminal.com/terminal/projects/openchat">
        <ChartLine size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Metrics</span>
    </MenuItem>
    {#if admin}
        <MenuItem separator />
        <MenuItem onclick={() => page("/admin")}>
            <CogOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">{"Admin"}</span>
        </MenuItem>
    {/if}
    <MenuItem separator />
    {#if !$anonUser}
        <MenuItem onclick={() => client.logout()}>
            <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable resourceKey={i18nKey("logout")} /></span>
        </MenuItem>
    {:else}
        <MenuItem onclick={() => client.updateIdentityState({ kind: "logging_in" })}>
            <Login size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable resourceKey={i18nKey("login")} /></span>
        </MenuItem>
    {/if}
</Menu>

<style lang="scss">
    .diamond-icon {
        background-image: url("/assets/diamond.svg");
        background-repeat: no-repeat;
        background-size: cover;
        background-position: 0 1px;
        margin-inline-start: 3px;
        display: inline-block;
        width: 15px;
        height: 15px;
    }
</style>
