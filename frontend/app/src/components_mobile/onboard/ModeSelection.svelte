<script lang="ts">
    import { Button, Container } from "component-lib";
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

    function onClick(primary: boolean) {
        return primary === $userCreatedStore ? onSignIn : onSignUp;
    }

    function buttonLabel(primary: boolean) {
        return primary === $userCreatedStore ? "loginDialog.signin" : "register.createAccount";
    }
</script>

{#snippet button(primary: boolean)}
    <Button secondary={!primary} onClick={onClick(primary)}>
        {#snippet icon(color)}
            {#if primary === $userCreatedStore}
                <Login {color} />
            {:else}
                <AccountPlus {color} />
            {/if}
        {/snippet}
        <Translatable resourceKey={i18nKey(buttonLabel(primary))} />
    </Button>
{/snippet}

<Container gap={"lg"} direction={"vertical"}>
    {@render button(true)}
    {@render button(false)}
</Container>
