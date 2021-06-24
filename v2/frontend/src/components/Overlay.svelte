<script lang="ts">
  export let active: boolean;
  import { modalStore } from "../stores/modal";
</script>

<div class="overlay" class:active on:click={modalStore.hideModal}>
  {#if active}
    <slot />
  {/if}
</div>

<style type="text/scss">
  @import "../styles/mixins";

  .overlay {
    @include z-index("overlay");
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 0;
    left: 0;
    @include fullHeight();
    width: 100%;
    pointer-events: none;
    transition: background-color ease-in-out 100ms,
      backdrop-filter ease-in-out 100ms;

    @include size-below(xs) {
      align-items: flex-end;
    }

    &.active {
      backdrop-filter: var(--modal-filter);
      pointer-events: all;
      background-color: rgba(0, 0, 0, 0.5);
    }
  }
</style>
