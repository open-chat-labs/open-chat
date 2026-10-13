<!-- Generated from lib/ContextMenu.dc.html (source hash c325b36b) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ContextMenu.logic.js';
  import Menu from './Menu.svelte';

  interface Props {
    open?: boolean;
    items?: {label:string,variant?:'regular'|'danger'|'separator',mask?:string,onSelect?:()=>void}[];
    point?: {x:number,y:number};
    anchor?: {left:number,right:number,top:number,bottom:number};
    align?: string;
    minWidth?: string;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

{#if v.open}
  <div style="position:fixed;z-index:95;left:{v.left};top:{v.top};visibility:{v.vis};display:grid;grid-template-columns:max-content" use:ref={v.boxRef} role="menu" oncontextmenu={v.swallow}>
    <Menu items={v.items} minWidth={v.minWidth}></Menu>
  </div>
{/if}
