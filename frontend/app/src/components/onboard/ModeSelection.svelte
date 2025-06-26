<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlus.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import OnBoardOptionLogo from "@components/home/profile/OnBoardOptionLogo.svelte";
    import { userCreatedStore } from "openchat-client";

    interface Props {
        onSignIn: () => void;
        onSignUp: () => void;
    }

    let { onSignIn, onSignUp }: Props = $props();

    const hasExistingAccount = $userCreatedStore;

    function onClick(primary: boolean) {
        return primary === hasExistingAccount
            ? onSignIn
            : onSignUp;
    }

    function buttonLabel(primary: boolean) {
        return primary === hasExistingAccount
            ? "loginDialog.signin"
            : "register.createAccount";
    }
</script>

<div class="buttons">
    {#snippet button(primary)}
        <div class="button">
            <OnBoardOptionLogo>
                {#if primary === hasExistingAccount}
                    <Login size="1.5em" />
                {:else}
                    <AccountPlus size="1.5em" />
                {/if}
            </OnBoardOptionLogo>
            <Button fill secondary={!primary} onClick={onClick(primary)}>
                <Translatable resourceKey={i18nKey(buttonLabel(primary))} />
            </Button>
        </div>
    {/snippet}

    {@render button(true)}
    {@render button(false)}
</div>

<style lang="scss">
    .blurb {
        text-align: center;
        max-width: 300px;
        color: var(--landing-txt-light);
        margin: 0 $sp4 toRem(24) $sp4;

        @include mobile() {
            margin-bottom: toRem(16);
        }
    }

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
