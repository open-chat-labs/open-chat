<script lang="ts">
    import { Button } from "component-lib";
    import { userCreatedStore } from "openchat-client";
    import AccountPlus from "svelte-material-icons/AccountPlus.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        onSignIn: () => void;
        onSignUp: () => void;
    }

    let { onSignIn, onSignUp }: Props = $props();

    const hasExistingAccount = $userCreatedStore;

    function onClick(primary: boolean) {
        return primary === hasExistingAccount ? onSignIn : onSignUp;
    }

    function buttonLabel(primary: boolean) {
        return primary === hasExistingAccount ? "loginDialog.signin" : "register.createAccount";
    }
</script>

<div class="buttons">
    {#snippet button(primary: boolean)}
        <Button secondary={!primary} onClick={onClick(primary)}>
            {#snippet icon(color)}
                {#if primary === hasExistingAccount}
                    <Login {color} />
                {:else}
                    <AccountPlus {color} />
                {/if}
            {/snippet}
            <Translatable resourceKey={i18nKey(buttonLabel(primary))} />
        </Button>
    {/snippet}

    {@render button(true)}
    {@render button(false)}
</div>

<style lang="scss">
    .buttons {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        max-width: 440px;
        width: 100%;
    }

    .button {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: auto;
    }

    :global(.button button) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
</style>
