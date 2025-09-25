<script lang="ts">
    import { MenuItem } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import {
        anonUserStore,
        canExtendDiamondStore,
        platformOperatorStore,
        publish,
    } from "openchat-client";
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
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");
</script>

{#if !$anonUserStore}
    <MenuItem onclick={() => publish("wallet")}>
        {#snippet icon(color, size)}
            <Wallet {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("wallet")} />
    </MenuItem>
    <MenuItem onclick={() => publish("profile")}>
        {#snippet icon(color, size)}
            <AccountSettings {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("profile.title")} />
    </MenuItem>
    <MenuItem onclick={() => publish("upgrade")}>
        {#snippet icon()}
            <span class="diamond-icon"></span>
        {/snippet}
        <Translatable
            resourceKey={i18nKey($canExtendDiamondStore ? "upgrade.extend" : "upgrade.diamond")} />
    </MenuItem>
    <MenuItem separator />
{/if}
<MenuItem onclick={() => page("/home")}>
    {#snippet icon(color, size)}
        <Home {color} {size} />
    {/snippet}
    Home page
</MenuItem>
<MenuItem onclick={() => page("/features")}>
    {#snippet icon(color, size)}
        <InformationOutline {color} {size} />
    {/snippet}
    Features
</MenuItem>
<MenuItem onclick={() => page("/roadmap")}>
    {#snippet icon(color, size)}
        <Road {color} {size} />
    {/snippet}
    Roadmap
</MenuItem>
<MenuItem onclick={() => page("/whitepaper")}>
    {#snippet icon(color, size)}
        <Note {color} {size} />
    {/snippet}
    Whitepaper
</MenuItem>
<MenuItem onclick={() => page("/architecture")}>
    {#snippet icon(color, size)}
        <Graph {color} {size} />
    {/snippet}
    Architecture
</MenuItem>
<MenuItem onclick={() => page("/blog")}>
    {#snippet icon(color, size)}
        <Blog {color} {size} />
    {/snippet}
    Blog
</MenuItem>
<MenuItem onclick={() => page("/faq")}>
    {#snippet icon(color, size)}
        <Help {color} {size} />
    {/snippet}
    FAQs
</MenuItem>
<MenuItem onclick={() => page("/guidelines")}>
    {#snippet icon(color, size)}
        <Security {color} {size} />
    {/snippet}
    Guidelines
</MenuItem>
<MenuItem href="https://tokenterminal.com/terminal/projects/openchat">
    {#snippet icon(color, size)}
        <ChartLine {color} {size} />
    {/snippet}
    Metrics
</MenuItem>
{#if $platformOperatorStore}
    <MenuItem separator />
    <MenuItem onclick={() => page("/admin")}>
        {#snippet icon(color, size)}
            <CogOutline {color} {size} />
        {/snippet}
        {"Admin"}
    </MenuItem>
{/if}
<MenuItem separator />
{#if !$anonUserStore}
    <MenuItem onclick={() => client.logout()}>
        {#snippet icon(color, size)}
            <Logout {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("logout")} />
    </MenuItem>
{:else}
    <MenuItem onclick={() => client.updateIdentityState({ kind: "logging_in" })}>
        {#snippet icon(color, size)}
            <Login {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("login")} />
    </MenuItem>
{/if}

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
