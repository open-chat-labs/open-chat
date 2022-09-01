<script lang="ts">
    import Button from "./Button.svelte";
    import Logo from "./Logo.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import ModalPage from "./ModalPage.svelte";
    import { selectedAuthProviderStore, showAuthProvidersStore } from "../stores/authProviders";
    import { AuthProvider } from "../domain/auth";

    const dispatch = createEventDispatcher();
    export let loading: boolean = false;
</script>

<ModalPage>
    <h4 class="subtitle">{$_("login.welcomeTo")}</h4>
    <Logo />
    <h1 class="title">{$_("openChat")}</h1>
    <p class="blurb">
        {$_("login.blurbPartOne")}<a target="_blank" href="https://internetcomputer.org/"
            >{$_("theInternetComputer")}</a
        >{$_("login.blurbPartTwo")}
        <a
            target="_blank"
            href="https://medium.com/dfinity/openchat-a-truly-decentralized-alternative-to-whatsapp-d0d051479b9a"
            >{$_("here")}</a
        >.
    </p>
    <Button disabled={loading} {loading} on:click={() => dispatch("login")}
        >{$_("login.signInOrRegister")}</Button>
    {#if $showAuthProvidersStore}
        <div class="auth-providers">
            <label>
                <input
                    type="radio"
                    bind:group={$selectedAuthProviderStore}
                    name="authProviders"
                    value={AuthProvider.II} />
                {AuthProvider.II}
            </label>
            <label>
                <input
                    type="radio"
                    bind:group={$selectedAuthProviderStore}
                    name="authProviders"
                    value={AuthProvider.NFID} />
                {AuthProvider.NFID}
            </label>
        </div>
    {/if}
</ModalPage>

<style type="text/scss">
    .subtitle {
        @include font(bold, normal, fs-140);
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-220);
        margin: $sp5 0;
    }
    .blurb {
        text-align: center;
        margin-bottom: $sp5;
        @include font(light, italic, fs-100);
    }

    a {
        text-decoration: underline;
        text-decoration-color: var(--link-underline);
        text-underline-offset: $sp1;
        cursor: pointer;
    }

    .auth-providers {
        @include font(book, normal, fs-80);
        margin-top: toRem(8);
        display: flex;
        gap: toRem(8);
        input {
            margin: 0;
        }
    }
</style>
