<script lang="ts">
  import Button from "./Button.svelte";
  import Logo from "./Logo.svelte";
  import { identityService } from "../fsm/identity.machine";
  import { onMount } from "svelte";
  const { send, state } = identityService;
  let username: string = "";
  let inp: HTMLInputElement;

  onMount(() => inp.focus());

  function registerUser(e: Event) {
    send({ type: "REGISTER_USER", username });
  }

  function logout() {
    send({ type: "LOGOUT" });
  }
</script>

<div class="register">
  <div class="register-panel">
    <h4>Tell us who you are ...</h4>
    <Logo />
    <h1>Register as a user</h1>
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
          loading={$state.matches("registering_user")}
          disabled={username === "" || $state.matches("registering_user")}
          on:click={registerUser}>
          Register
        </Button>
        <a
          class="signout"
          href="/#"
          on:click|preventDefault|stopPropagation={logout}>Sign out</a>
      </div>
    </form>
  </div>
  <img alt="Background" src="./assets/campfire.avif" />
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

  .actions {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .signout {
    color: #191919;
    min-width: 150px;
    text-align: center;
    text-decoration: underline;
  }

  .register {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    @include fullHeight();
    @include size-below(xs) {
      align-items: flex-end;
    }
  }
  .register-panel {
    padding: 30px 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 30px;
    width: 50%;
    max-width: 500px;
    background-color: var(--modal-bg);
    color: var(--modal-txt);
    box-shadow: var(--modal-sh);

    @include z-index(login);

    p {
      text-align: center;
      margin-bottom: 20px;
    }

    form {
      text-align: center;
    }

    @include size-below(xs) {
      width: 100%;
      border-radius: 20px 20px 0 0;
    }

    .username {
      padding: 20px;
      margin-bottom: 25px;
      width: 100%;
    }
  }
</style>
