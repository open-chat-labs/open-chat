<!-- Generated from lib/AccessGatesCards.dc.html (source hash 7f4effa4) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './AccessGatesCards.logic.js';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';

  interface Props {
    isDiamond?: boolean;
    onUpgrade?: () => void;
    onChange?: (state: object) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-22)">

  {#if v.locked}
    <div style="display:flex;flex-direction:column;gap:var(--space-16);min-width:0;padding:var(--space-22);box-sizing:border-box;border-radius:var(--radius-xl);background:linear-gradient(150deg,rgba(255,86,114,.14),rgba(61,155,255,.12));box-shadow:inset 0 0 0 1px rgba(255,130,152,.4)">
      <span style="font:var(--weight-bold) var(--text-lg)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">Upgrade to Diamond</span>
      <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">Only diamond members can add access gates.</span>
      <div style="display:flex;align-items:center;justify-content:center;height:var(--control-lg,40px);box-sizing:border-box;border-radius:var(--radius-md);background:var(--accent,#FF5672);font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.onUpgrade} role="button" tabindex="0">Get Diamond</div>
    </div>
  {/if}

  {#if v.unlocked}
    <div style="display:flex;align-items:center;gap:var(--space-16);min-width:0;padding-inline:var(--space-2)">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
        <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">ACCESS GATES {t(v.countLabel)}</span>
        <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Invited people never have to pass gates.</span>
      </div>
      <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr);width:190px"><SegmentedTabs labels={v.modeLabels} selectedIndex={v.modeIndex} dotIndexes={v.noDots} onSelect={v.onMode}></SegmentedTabs></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
      {#each v.cards ?? [] as c, i0}
        <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding:var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px {c.line}">
          <div style="display:flex;align-items:flex-start;gap:var(--space-12);min-width:0">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-md);background:{c.tile};box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
              <span style="width:20px;height:20px;background:{c.iconInk};mask:{c.mask}"></span>
            </span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#ECECF1);text-wrap:pretty">{t(c.title)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(c.desc)}</span>
            </div>
            <div style="flex:none;display:flex;gap:2px">
              {#if c.configurable}
                <span class="dc-p0" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={c.onEdit} role="button" tabindex="0" aria-label="Edit values" title="Edit values">
                  <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.editMask}"></span>
                </span>
              {/if}
              <span class="dc-p1" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={c.onRemove} role="button" tabindex="0" aria-label="Remove gate" title="Remove gate">
                <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
              </span>
            </div>
          </div>

          {#if c.hasChips}
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0;padding-inline-start:50px">
              {#each c.chips ?? [] as chip, i1}
                <span style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
                  {#if chip.hasDot}
                    <span style="flex:none;width:13px;height:13px;border-radius:var(--radius-pill);background:{chip.dot}"></span>
                  {/if}
                  <span style="font:var(--weight-medium) var(--text-sm)/1.2 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(chip.label)}</span>
                </span>
              {/each}
            </div>
          {/if}

          {#if c.editing}
            <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding-inline-start:50px">
              {#if c.needsAsset}
                <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0">
                  {#each c.assets ?? [] as a, i2}
                    <span style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);border-radius:var(--radius-pill);background:{a.bg};box-shadow:inset 0 0 0 1px {a.line};font:var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans);color:{a.ink};cursor:{a.cursor};user-select:none" onclick={a.onSelect} role="button" tabindex="0">
                      <span style="flex:none;width:14px;height:14px;border-radius:var(--radius-pill);background:{a.dot}"></span>
                      <span>{t(a.label)}</span>
                    </span>
                  {/each}
                </div>
              {/if}
              {#each c.fields ?? [] as f, i3}
                <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;max-width:320px;padding:0 var(--space-12);height:42px;box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {f.line}">
                  <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)" value={f.value} oninput={f.onInput} placeholder={f.placeholder} inputmode="numeric">
                  <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(f.unit)}</span>
                </div>
              {/each}
              <div style="display:flex;gap:var(--space-8)">
                <div style="flex:none;display:flex;align-items:center;justify-content:center;padding:0 var(--space-14);height:34px;box-sizing:border-box;border-radius:var(--radius-md);background:{c.doneBg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{c.doneInk};cursor:{c.doneCursor};user-select:none" onclick={c.onDone} role="button" tabindex="0">Done</div>
              </div>
            </div>
          {/if}
        </div>
      {/each}

      {#if v.empty}
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
          <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">No gates yet</span>
          <span style="max-width:320px;text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">Add a gate to control who can join.</span>
        </div>
      {/if}

      <div class="dc-p2" style="display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:44px;box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.18));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onOpenPicker} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.plusMask}"></span>
        <span>Add gate</span>
      </div>
    </div>

    <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

    <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding-inline:var(--space-2)">
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><TimedToggle density="flush" label="Re-check members periodically" prefix="Every" offHint="Members are checked once, when they join." on={v.intervalOn} value={v.every} options={v.intervals} onChange={v.onIntervalOn} onDurationChange={v.onEvery}></TimedToggle></div>
    </div>
  {/if}

  {#if v.pickerOpen}
    <div style="position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
      <div style="position:absolute;inset:0;background:var(--scrim)" onclick={v.onClosePicker} aria-hidden="true"></div>
      <div style="position:relative;width:100%;max-width:480px;max-height:100%;display:flex;flex-direction:column;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 30px 70px rgba(0,0,0,.45);overflow:hidden">
        <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
          <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Add a gate</span>
          <span class="dc-p3" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClosePicker} role="button" tabindex="0">
            <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
          </span>
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-12);display:flex;flex-direction:column;gap:2px">
          {#each v.catalogue ?? [] as g, i4}
            <div class="dc-p4" style="display:flex;align-items:flex-start;gap:var(--space-12);min-width:0;padding:var(--space-12);border-radius:var(--radius-md);cursor:{g.cursor}" onclick={g.onAdd} role="button" tabindex="0">
              <span style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:var(--radius-sm);background:var(--overlay-1,rgba(255,255,255,.05))">
                <span style="width:17px;height:17px;background:{g.ink};mask:{g.mask}"></span>
              </span>
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
                <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
                  <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:{g.ink}">{t(g.label)}</span>
                  {#if g.soon}
                    <span style="flex:none;padding:1px var(--space-6);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-2xs)/1.4 var(--font-mono);color:var(--ink-4,#7C7C8C)">SOON</span>
                  {/if}
                </div>
                <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(g.desc)}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>
