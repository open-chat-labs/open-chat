<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        onClose: () => void;
        onSignIn: () => void;
        onSignUp: () => void;
    }

    let { onSignIn, onSignUp }: Props = $props();
</script>

<p class="blurb">Do you already have an OpenChat account or are you visiting for the first time?</p>
<div class="buttons">
    <ButtonGroup align="center">
        <Button onClick={onSignIn}><Translatable resourceKey={i18nKey("Sign In")} /></Button>
        <Button onClick={onSignUp}><Translatable resourceKey={i18nKey("Sign Up")} /></Button>
    </ButtonGroup>
</div>

<style lang="scss">
    .blurb {
        text-align: center;
        color: var(--landing-txt-light);
        margin: 0 $sp4 toRem(24) $sp4;
        @include font(book, normal, fs-120);

        @include mobile() {
            margin-bottom: toRem(16);
        }
    }
</style>
