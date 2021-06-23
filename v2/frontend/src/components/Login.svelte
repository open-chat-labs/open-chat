<script lang="ts">
  import Button from "./Button.svelte";
  import Logo from "./Logo.svelte";
  import { identityService } from "../fsm/identity.machine";
  import { _ } from "svelte-i18n";
  const { send, state } = identityService;
</script>

<div class="welcome">
  <div class="welcome-panel">
    <h4 class="subtitle">Welcome to ...</h4>
    <Logo />
    <h1 class="title">Open Chat</h1>
    <p>Before continuing you must sign into The Internet Computer</p>
    <Button
      loading={$state.matches("logging_in")}
      on:click={() => send({ type: "LOGIN" })}>{$_("sign_in")}</Button>
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

  .welcome {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    @include fullHeight();
    @include size-below(xs) {
      align-items: flex-end;
    }
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
      @include font(bold, normal, fs-180);
      margin: $sp5 0;
    }

    @include z-index(login);

    p {
      text-align: center;
      margin-bottom: $sp5;
    }

    @include size-below(xs) {
      width: 100%;
      border-radius: $sp5 $sp5 0 0;
    }
  }
</style>
