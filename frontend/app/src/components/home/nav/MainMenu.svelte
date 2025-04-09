<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { anonUser, canExtendDiamond, platformOperator, publish, ui } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import AccountSettings from "svelte-material-icons/AccountSettingsOutline.svelte";
    import ChartLine from "svelte-material-icons/ChartLine.svelte";
    import CogOutline from "svelte-material-icons/CogOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Security from "svelte-material-icons/Security.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    let admin = $derived($platformOperator);
</script>

<Menu>
    {#if !$anonUser}
        <MenuItem onclick={() => publish("wallet")}>
            {#snippet icon()}
                <Wallet size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("wallet")} />
            {/snippet}
        </MenuItem>
        <MenuItem onclick={() => publish("profile")}>
            {#snippet icon()}
                <AccountSettings size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("profile.title")} />
            {/snippet}
        </MenuItem>
        <MenuItem onclick={() => publish("upgrade")}>
            {#snippet icon()}
                <span class="diamond-icon"></span>
            {/snippet}
            {#snippet text()}
                <Translatable
                    resourceKey={i18nKey(
                        $canExtendDiamond ? "upgrade.extend" : "upgrade.diamond",
                    )} />
            {/snippet}
        </MenuItem>
        <MenuItem separator />
    {/if}
    <MenuItem onclick={() => page("/home")}>
        {#snippet icon()}
            <Home size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Home page
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/features")}>
        {#snippet icon()}
            <InformationOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Features
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/roadmap")}>
        {#snippet icon()}
            <Road size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Roadmap
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/whitepaper")}>
        {#snippet icon()}
            <Note size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Whitepaper
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/architecture")}>
        {#snippet icon()}
            <Graph size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Architecture
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/blog")}>
        {#snippet icon()}
            <Blog size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Blog
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/faq")}>
        {#snippet icon()}
            <Help size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            FAQs
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => page("/guidelines")}>
        {#snippet icon()}
            <Security size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Guidelines
        {/snippet}
    </MenuItem>
    <MenuItem href="https://tokenterminal.com/terminal/projects/openchat">
        {#snippet icon()}
            <ChartLine size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Metrics
        {/snippet}
    </MenuItem>
    {#if admin}
        <MenuItem separator />
        <MenuItem onclick={() => page("/admin")}>
            {#snippet icon()}
                <CogOutline size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Admin"}
            {/snippet}
        </MenuItem>
    {/if}
    <MenuItem separator />
    {#if !$anonUser}
        <MenuItem onclick={() => client.logout()}>
            {#snippet icon()}
                <Logout size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("logout")} />
            {/snippet}
        </MenuItem>
    {:else}
        <MenuItem onclick={() => client.updateIdentityState({ kind: "logging_in" })}>
            {#snippet icon()}
                <Login size={ui.iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("login")} />
            {/snippet}
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
