<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        onSignIn: () => void;
        onSignUp: () => void;
    }

    let { onSignIn, onSignUp }: Props = $props();
</script>

<p class="blurb">
    <Translatable resourceKey={i18nKey("register.chooseMode")} />
</p>
<div class="buttons">
    <Button fill secondary onClick={onSignIn}
        ><Translatable resourceKey={i18nKey("loginDialog.signin")} /></Button>
    <Button fill onClick={onSignUp}
        ><Translatable resourceKey={i18nKey("register.createAccount")} /></Button>
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
</style>
