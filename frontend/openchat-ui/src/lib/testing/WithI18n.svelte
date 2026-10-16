<!-- Test helper: mounts `component` with `props` under a host translator (setI18n), as a host app's root would. -->
<script lang="ts" generics="P extends object">
  import type { Component } from 'svelte';
  import { setI18n, type I18n } from '../i18n';

  let { i18n, component: Inner, props }: { i18n: I18n; component: Component<P>; props: P } = $props();
  // set once, as a host does at its root
  // svelte-ignore state_referenced_locally
  setI18n(i18n);
</script>

<Inner {...props} />
