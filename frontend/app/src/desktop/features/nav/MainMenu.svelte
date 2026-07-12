<script lang="ts">
    import type { OpenChat } from "@client";
    import {
        anonUserStore,
        canExtendDiamondStore,
        iconSize,
        platformOperatorStore,
        publish,
    } from "@client";
    import { navigate } from "@src/utils/navigation";
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
    import { i18nKey } from "@src/i18n/i18n";
    import Menu from "@src/desktop/shared/Menu.svelte";
    import MenuItem from "@src/desktop/shared/MenuItem.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    const client = getContext<OpenChat>("client");
</script>

<Menu>
    {#if !$anonUserStore}
        <MenuItem onclick={() => publish("wallet")}>
            {#snippet icon()}
                <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("wallet")} />
            {/snippet}
        </MenuItem>
        <MenuItem onclick={() => publish("profile")}>
            {#snippet icon()}
                <AccountSettings size={$iconSize} color={"var(--icon-inverted-txt)"} />
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
                        $canExtendDiamondStore ? "upgrade.extend" : "upgrade.diamond",
                    )} />
            {/snippet}
        </MenuItem>
        <MenuItem separator />
    {/if}
    <MenuItem onclick={() => navigate("/home")}>
        {#snippet icon()}
            <Home size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Home page
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/features")}>
        {#snippet icon()}
            <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Features
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/roadmap")}>
        {#snippet icon()}
            <Road size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Roadmap
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/whitepaper")}>
        {#snippet icon()}
            <Note size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Whitepaper
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/architecture")}>
        {#snippet icon()}
            <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Architecture
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/blog")}>
        {#snippet icon()}
            <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Blog
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/faq")}>
        {#snippet icon()}
            <Help size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            FAQs
        {/snippet}
    </MenuItem>
    <MenuItem onclick={() => navigate("/guidelines")}>
        {#snippet icon()}
            <Security size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Guidelines
        {/snippet}
    </MenuItem>
    <MenuItem href="https://tokenterminal.com/terminal/projects/openchat">
        {#snippet icon()}
            <ChartLine size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            Metrics
        {/snippet}
    </MenuItem>
    {#if $platformOperatorStore}
        <MenuItem separator />
        <MenuItem onclick={() => navigate("/admin")}>
            {#snippet icon()}
                <CogOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Admin"}
            {/snippet}
        </MenuItem>
    {/if}
    <MenuItem separator />
    {#if !$anonUserStore}
        <MenuItem onclick={() => client.logout()}>
            {#snippet icon()}
                <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                <Translatable resourceKey={i18nKey("logout")} />
            {/snippet}
        </MenuItem>
    {:else}
        <MenuItem onclick={() => client.updateIdentityState({ kind: "logging_in" })}>
            {#snippet icon()}
                <Login size={$iconSize} color={"var(--icon-inverted-txt)"} />
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
