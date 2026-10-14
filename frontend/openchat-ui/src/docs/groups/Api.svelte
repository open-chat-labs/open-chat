<!-- API: one section per component with props — PROP · TYPE · CONTROL · DEFAULT, from meta.json
     (regenerated from each component's Props interface and $props() defaults). -->
<script lang="ts">
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import PropsTable from '../PropsTable.svelte';
  import { api, apiComponents } from '../sections';
  import type { ComponentMeta } from '../props';
</script>

<div class="api">
  {#each apiComponents as c, i (c.name)}
    <Section {...api[i]} propsButton={false}>
      <Frame>
        <PropsTable component={c as unknown as ComponentMeta} />
      </Frame>
    </Section>
  {/each}
</div>

<style>
  .api { display: flex; flex-direction: column; gap: 56px; }
</style>
