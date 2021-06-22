<script lang="ts">
  import { onMount } from "svelte";

  import "./i18n/i18n";
  import { loadSavedTheme } from "./theme/themes";
  import { rtlStore } from "./stores/rtl";
  import { _ } from "svelte-i18n";

  onMount(() => {
    loadSavedTheme();
    calculateHeight();
  });

  function calculateHeight() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }

  $: {
    document.dir = $rtlStore ? "rtl" : "ltr";
  }
</script>

<h1>Hello from svelte</h1>
<button>{$_("sign_in")}</button>

<svelte:window on:resize={calculateHeight} />

<style type="text/scss">
  h1 {
    padding: 10px;
    background-color: red;
    color: white;
    font-weight: bold;
  }
</style>
