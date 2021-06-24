<script lang="ts">
    import Button from "./Button.svelte";
    import Logo from "./Logo.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { onMount } from "svelte";
    import Link from "./Link.svelte";
    export let busy = false;
    let username: string = "";
    let inp: HTMLInputElement;

    onMount(() => inp.focus());

    function registerUser(e: Event) {
        dispatch("registerUser", username);
    }

    function logout() {
        dispatch("logout");
    }
</script>

<div class="register">
    <div class="register-panel">
        <h4 class="subtitle">Tell us who you are ...</h4>
        <Logo />
        <h1 class="title">Register as a user</h1>
        <form on:submit|preventDefault|stopPropagation={registerUser}>
            <input
                minlength={3}
                maxlength={25}
                placeholder="choose a username"
                bind:this={inp}
                class="username"
                bind:value={username} />
            <div class="actions">
                <Button
                    loading={busy}
                    disabled={username === "" || busy}
                    on:click={registerUser}>
                    Register
                </Button>
                <Link on:click={logout}>Sign out</Link>
            </div>
        </form>
    </div>
</div>

<style type="text/scss">
    @import "../styles/mixins";

    .actions {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .register {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        @include fullScreenImg("../assets/underwater.jpg");
        @include fullHeight();
    }

    .register-panel {
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

        p {
            text-align: center;
            margin-bottom: $sp4;
        }

        form {
            text-align: center;
        }

        @include size-below(xs) {
            width: 100%;
            margin: 0 $sp4;
        }

        .username {
            padding: $sp4;
            margin-bottom: $sp5;
            width: 100%;
        }
    }
</style>
