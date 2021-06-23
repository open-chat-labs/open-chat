<script lang="ts">
  import Button from "./Button.svelte";
  export let error = { message: "Unknown error" };
</script>

<div class="background">
  <div class="message-box">
    <h1>Oh no - something went wrong</h1>
    <p class="msg">{error.message}</p>
    <Button on:click={() => location.reload()}>Reload</Button>
  </div>
</div>

<style type="text/scss">
  @import "../styles/mixins";
  .background {
    display: flex;
    justify-content: center;
    align-items: center;
    @include fullHeight();
    @include fullScreenImg("../assets/error.jpg");

    @include size-below(xs) {
      align-items: flex-end;
    }
  }
  .message-box {
    padding: 40px;
    text-align: center;
    width: 50%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 30px;
    background-color: var(--modal-bg);
    color: var(--modal-txt);
    box-shadow: var(--modal-sh);

    @include size-below(xs) {
      padding: 20px;
      width: 100%;
      border-radius: 20px 20px 0 0;

      h1 {
        font-size: 18px;
      }
    }
  }
  .msg {
    max-height: 250px;
    overflow: auto;
    word-break: break-all;

    @include size-below(xs) {
      max-height: 150px;
    }
  }
</style>
