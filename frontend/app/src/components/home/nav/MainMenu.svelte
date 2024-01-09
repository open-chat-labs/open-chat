<script lang="ts">
    import { iconSize } from "../../../stores/iconSize";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import AccountSettings from "svelte-material-icons/AccountSettingsOutline.svelte";
    import CogOutline from "svelte-material-icons/CogOutline.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Security from "svelte-material-icons/Security.svelte";
    import Menu from "../../Menu.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import page from "page";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: canExtendDiamond = client.canExtendDiamond;
    $: anonUser = client.anonUser;
    $: admin = !$anonUser && true; // TODO we need to control this somehow
</script>

<Menu>
    {#if !$anonUser}
        <MenuItem on:click={() => dispatch("wallet")}>
            <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">
                <Translatable key={"wallet"} />
            </span>
        </MenuItem>
        <MenuItem on:click={() => dispatch("profile")}>
            <AccountSettings size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable key="profile.title" /></span>
        </MenuItem>
        <MenuItem on:click={() => dispatch("upgrade")}>
            <span class="diamond-icon" slot="icon"></span>
            <span slot="text"
                ><Translatable
                    key={$canExtendDiamond ? "upgrade.extend" : "upgrade.diamond"} /></span>
        </MenuItem>
        <MenuItem separator />
    {/if}
    <MenuItem on:click={() => page("/home")}>
        <Home size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Home page</span>
    </MenuItem>
    <MenuItem on:click={() => page("/features")}>
        <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Features</span>
    </MenuItem>
    <MenuItem on:click={() => page("/roadmap")}>
        <Road size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Roadmap</span>
    </MenuItem>
    <MenuItem on:click={() => page("/whitepaper")}>
        <Note size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Whitepaper</span>
    </MenuItem>
    <MenuItem on:click={() => page("/architecture")}>
        <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Architecture</span>
    </MenuItem>
    <MenuItem on:click={() => page("/blog")}>
        <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Blog</span>
    </MenuItem>
    <MenuItem on:click={() => page("/faq")}>
        <Help size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">FAQs</span>
    </MenuItem>
    <MenuItem on:click={() => page("/guidelines")}>
        <Security size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Guidelines</span>
    </MenuItem>
    <MenuItem separator />
    {#if !$anonUser}
        <MenuItem on:click={() => client.logout()}>
            <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable key="logout" /></span>
        </MenuItem>
    {:else}
        <MenuItem on:click={() => client.identityState.set({ kind: "logging_in" })}>
            <Login size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text"><Translatable key="login" /></span>
        </MenuItem>
    {/if}

    {#if admin}
        <MenuItem separator />
        <MenuItem on:click={() => page("/admin")}>
            <CogOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <span slot="text">{"Admin"}</span>
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
