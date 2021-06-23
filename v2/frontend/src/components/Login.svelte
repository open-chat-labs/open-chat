<script lang="ts">
    import Button from "./Button.svelte";
    import Logo from "./Logo.svelte";
    import { identityService } from "../fsm/identity.machine";
    import { _ } from "svelte-i18n";
    const { send, state } = identityService;
</script>

<div class="welcome">
    <div class="welcome-panel">
        <h4 class="subtitle">{$_("login.welcomeTo")}</h4>
        <Logo />
        <h1 class="title">{$_("openChat")}</h1>
        <p class="blurb">
            {$_("login.blurbPartOne")}<a href="https://internetcomputer.org/"
                >{$_("theInternetComputer")}</a
            >{$_("login.blurbPartTwo")}
        </p>
        <Button
            loading={$state.matches("logging_in")}
            on:click={() => send({ type: "LOGIN" })}
            >{$_("login.signIn")}</Button>
    </div>
</div>

<style type="text/scss">
    @import "../styles/mixins";
    img {
        filter: brightness(50%);
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        object-fit: cover;
    }

    .welcome {
        display: flex;
        justify-content: center;
        align-items: center;
        @include size-above(sm) {
            // @include fullScreenImg("../assets/campfire.avif");
            // @include fullScreenImg("../assets/wood.jpg");
            // @include fullScreenImg("../assets/sunset.jpg");
            @include fullScreenImg("../assets/underwater.jpg");
            // @include fullScreenImg("../assets/coral.jpg");
        }
        @include fullHeight();
    }
    .welcome-panel {
        padding: $sp5 $sp6;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: $sp5;
        width: 50%;
        max-width: 500px;
        background-color: var(--modal-bg);
        color: var(--modal-txt);
        box-shadow: var(--modal-sh);

        .subtitle {
            @include font(bold, normal, fs-140);
            margin-bottom: $sp5;
        }

        .title {
            @include font(bold, normal, fs-220);
            margin: $sp5 0;
        }

        @include z-index(login);

        .blurb {
            text-align: center;
            margin-bottom: $sp5;
            @include font(light, italic, fs-100);
        }

        @include size-below(xs) {
            width: 100%;
            margin: 0 $sp4;
        }

        a {
            text-decoration: underline;
            text-decoration-color: var(--link-underline);
            text-underline-offset: $sp1;
            cursor: pointer;
        }
    }
</style>
