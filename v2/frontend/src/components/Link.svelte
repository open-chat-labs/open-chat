<script lang="ts">
  import { stop_propagation } from "svelte/internal";
</script>

<a href="/#" on:click|preventDefault|stopPropagation>
  <slot />
</a>

<style type="text/scss">
  @import "../styles/mixins";
  button {
    transition: background ease-in-out 200ms;
    background: var(--button-bg);
    color: var(--button-txt);
    padding: 10px 30px;
    cursor: pointer;
    border: 1px solid var(--button-bd);
    min-height: 45px;
    min-width: 150px;

    &:hover {
      background: var(--button-hv);
    }

    &.loading {
      @include loading-spinner(1em, 0.5em, false, var(--spinner));
    }

    &.disabled {
      background: var(--button-disabled);
    }

    // todo this needs theming
    &.secondary {
      background: transparent;
      color: #cccccc;
      border: 1px solid #cccccc;
    }
  }
</style>
