<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import AccountPlus from "svelte-material-icons/AccountPlus.svelte";
    import Login from "svelte-material-icons/Login.svelte";
    import OnBoardOptionLogo from "@components/home/profile/OnBoardOptionLogo.svelte";

    interface Props {
        onSignIn: () => void;
        onSignUp: () => void;
    }

    let { onSignIn, onSignUp }: Props = $props();
</script>

<div class="buttons">
    <div class="button">
        <OnBoardOptionLogo>
            <AccountPlus size="1.5em" />
        </OnBoardOptionLogo>
        <Button fill onClick={onSignUp}>
            <Translatable resourceKey={i18nKey("register.createAccount")} />
        </Button>
    </div>
    <div class="button">
        <OnBoardOptionLogo>
            <Login size="1.5em" />
        </OnBoardOptionLogo>
        <Button fill secondary onClick={onSignIn}>
            <Translatable resourceKey={i18nKey("loginDialog.signin")} />
        </Button>
    </div>
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
