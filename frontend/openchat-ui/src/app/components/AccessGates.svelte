<!-- Generated from lib/AccessGates.dc.html (source hash fceffeb8) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './AccessGates.logic.js';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import TimedToggle from '../../lib/components/TimedToggle.svelte';
  import UpgradeBanner from './UpgradeBanner.svelte';

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
    <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
      <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">WHAT ARE ACCESS GATES</span>
      <span style="font:var(--weight-regular) var(--text-md)/1.55 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">Gates are conditions people must meet before they can join. OpenChat checks them automatically, so you don't have to screen members by hand.</span>
    </div>

    <div style="display:flex;flex-direction:column;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
      {#each v.lockedWhy ?? [] as w, i0}
        <div style="display:flex;align-items:center;gap:var(--space-14);min-height:56px;padding:var(--space-10) var(--space-16);box-sizing:border-box;border-block-start:{w.divider}">
          <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07))"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{w.mask}"></span></span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
            <span style="font:var(--weight-semibold) var(--text-base)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(w.title)}</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(w.body)}</span>
          </div>
        </div>
      {/each}
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
      <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">EXAMPLE</span>
      <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0;pointer-events:none">
        {#each v.lockedExample ?? [] as r, i1}
          {#if r.showJoiner}
            <div style="display:flex;align-items:center;gap:var(--space-10);padding-inline:var(--space-18)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--accent-bright,#FF8298)">AND</span>
              <span style="flex:1;height:1px;background:var(--line-1,rgba(255,255,255,.07))"></span>
            </div>
          {/if}
          <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07))"><span style="width:17px;height:17px;background:var(--ink-2,#C9C9D4);mask:{r.mask}"></span></span>
            <div style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-8) var(--space-6)">
              <span style="font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">Members <span style="font-weight:var(--weight-semibold);color:var(--ink,#ECECF1)">{t(r.sentence)}</span></span>
              <span style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-4) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
                {#if r.dot}<span style="flex:none;width:13px;height:13px;border-radius:var(--radius-pill);background:{r.dot}"></span>{/if}
                <span style="font:var(--weight-medium) var(--text-sm)/1.45 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(r.chip)}</span>
              </span>
            </div>
          </div>
        {/each}
      </div>
      <span style="padding-inline:var(--space-4);font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">A holders' group: only people with 500 CHAT and a verified unique identity can join.</span>
    </div>

    <UpgradeBanner text="Access gates are a Diamond feature." onUpgrade={v.onUpgrade}></UpgradeBanner>
  {/if}

  {#if v.unlocked}
    <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--space-12) var(--space-16);min-width:0">
      <div style="flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:var(--space-6)">
        <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">WHO CAN JOIN</span>
        <span style="font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(v.summary)}</span>
      </div>
      {#if v.showJoinerPicker}
        <div style="flex:none;display:grid;grid-template-columns:minmax(0,1fr);width:190px"><SegmentedTabs labels={v.joinerLabels} selectedIndex={v.joinerIndex} dotIndexes={v.noDots} onSelect={v.onJoiner}></SegmentedTabs></div>
      {/if}
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0">
      {#each v.rules ?? [] as r, i2}
        <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0">
          {#if r.showJoiner}
            <div style="display:flex;align-items:center;gap:var(--space-10);padding-inline:var(--space-18)">
              <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--accent-bright,#FF8298)">{t(v.joinerLabel)}</span>
              <span style="flex:1;height:1px;background:var(--line-1,rgba(255,255,255,.07))"></span>
            </div>
          {/if}

          <div style="display:flex;align-items:{r.align};gap:var(--space-12);min-width:0;padding:var(--space-14) var(--space-14);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px {r.line}">
            <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07))">
              <span style="width:17px;height:17px;background:{r.iconInk};mask:{r.mask}"></span>
            </span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-10)">
              <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-8) var(--space-6);min-width:0">
                <span style="font:var(--weight-regular) var(--text-base)/1.45 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">Members <span style="font-weight:var(--weight-semibold);color:var(--ink,#ECECF1)">{t(r.sentence)}</span></span>
                {#if r.hasChips}
                  {#each r.chips ?? [] as chip, i3}
                    <span style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-4) var(--space-10);border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
                      {#if chip.hasDot}
                        <span style="flex:none;width:13px;height:13px;border-radius:var(--radius-pill);background:{chip.dot}"></span>
                      {/if}
                      <span style="font:var(--weight-medium) var(--text-sm)/1.45 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(chip.label)}</span>
                    </span>
                  {/each}
                {/if}
              </div>

              {#if r.editing}
                <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0;padding-top:var(--space-2)">
                  {#if r.needsAsset}
                    <div style="display:flex;flex-direction:column;gap:var(--space-6);min-width:0">
                      <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(r.assetLabel)}</span>
                      <div style="display:flex;flex-wrap:wrap;gap:var(--space-6);min-width:0">
                        {#each r.assets ?? [] as a, i4}
                          <span style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);border-radius:var(--radius-pill);background:{a.bg};box-shadow:inset 0 0 0 1px {a.line};font:var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans);color:{a.ink};cursor:{a.cursor};user-select:none" onclick={a.onSelect} role="button" tabindex="0">
                            <span style="flex:none;width:14px;height:14px;border-radius:var(--radius-pill);background:{a.dot}"></span>
                            <span>{t(a.label)}</span>
                          </span>
                        {/each}
                        {#if r.browseAll}
                          <span class="dc-p0" style="display:inline-flex;align-items:center;gap:var(--space-6);padding:var(--space-6) var(--space-10);border-radius:var(--radius-pill);border:1px dashed var(--line-2,rgba(255,255,255,.18));font:var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={r.onBrowse} role="button" tabindex="0">
                            <span style="flex:none;width:13px;height:13px;background:var(--accent,#FF5672);mask:{v.searchMask}"></span>
                            <span>{t(r.browseLabel)}</span>
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#each r.fields ?? [] as f, i5}
                    <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0;max-width:320px;padding:0 var(--space-12);height:42px;box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {f.line}">
                      <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)" value={f.value} oninput={f.onInput} placeholder={f.placeholder} inputmode="numeric">
                      <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(f.unit)}</span>
                    </div>
                  {/each}

                  <div style="display:flex;gap:var(--space-8);min-width:0">
                    <div style="flex:none;display:flex;align-items:center;justify-content:center;padding:0 var(--space-14);height:34px;box-sizing:border-box;border-radius:var(--radius-md);background:{r.doneBg};font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{r.doneInk};cursor:{r.doneCursor};user-select:none" onclick={r.onDone} role="button" tabindex="0">Done</div>
                    <div class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;padding:0 var(--space-12);height:34px;box-sizing:border-box;border-radius:var(--radius-md);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--status-danger,#F5493D);cursor:pointer;user-select:none" onclick={r.onRemove} role="button" tabindex="0">Remove</div>
                  </div>
                </div>
              {/if}
            </div>

            {#if r.showActions}
              <div style="flex:none;display:flex;gap:2px">
                {#if r.configurable}
                  <span class="dc-p2" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={r.onEdit} role="button" tabindex="0" aria-label="Edit" title="Edit">
                    <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.editMask}"></span>
                  </span>
                {/if}
                <span class="dc-p3" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--radius-sm);cursor:pointer" onclick={r.onRemove} role="button" tabindex="0" aria-label="Remove" title="Remove">
                  <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if v.empty}
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
          <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">Anyone invited can join</span>
          <span style="max-width:340px;text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.emptyHint)}</span>
        </div>
      {/if}
    </div>

    {#if v.canEdit}
    <div class="dc-p4" style="display:flex;align-items:center;justify-content:center;gap:var(--space-8);height:44px;box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.18));font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onOpenAdd} role="button" tabindex="0">
      <span style="width:15px;height:15px;background:var(--accent,#FF5672);mask:{v.plusMask}"></span>
      <span>Add requirement</span>
    </div>
    {/if}

    <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

    {#if v.readOnly}
      <div style="display:flex;align-items:flex-start;gap:var(--space-12);min-width:0">
        <span style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);background:var(--overlay-2,rgba(255,255,255,.07))"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.recheckMask}"></span></span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding-top:2px">
          <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.recheckTitle)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.recheckBody)}</span>
        </div>
      </div>
    {/if}
    {#if v.canEdit}
    <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><TimedToggle density="flush" label="Re-check members periodically" prefix="Every" offHint="Members are checked once, when they join." on={v.intervalOn} value={v.every} options={v.intervals} onChange={v.onIntervalOn} onDurationChange={v.onEvery}></TimedToggle></div>
    </div>
    {/if}
  {/if}

  {#if v.addOpen}
    <div style="position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
      <div style="position:absolute;inset:0;background:var(--scrim)" onclick={v.onCloseAdd} aria-hidden="true"></div>
      <div style="position:relative;width:100%;max-width:480px;max-height:100%;display:flex;flex-direction:column;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 30px 70px rgba(0,0,0,.45);overflow:hidden">
        <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
          <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Add a requirement</span>
          <span class="dc-p5" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCloseAdd} role="button" tabindex="0">
            <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
          </span>
        </div>
        <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-12);display:flex;flex-direction:column;gap:2px">
          {#each v.catalogue ?? [] as g, i6}
            <div class="dc-p6" style="display:flex;align-items:flex-start;gap:var(--space-12);min-width:0;padding:var(--space-12);border-radius:var(--radius-md);cursor:{g.cursor}" onclick={g.onAdd} role="button" tabindex="0">
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

  {#if v.tokenOpen}
    <div style="position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" role="dialog" aria-modal="true">
      <div style="position:absolute;inset:0;background:var(--scrim)" onclick={v.onCloseToken} aria-hidden="true"></div>
      <div style="position:relative;width:100%;max-width:440px;height:min(560px,100%);display:flex;flex-direction:column;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 30px 70px rgba(0,0,0,.45);overflow:hidden">
        <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-16) var(--space-18);border-block-end:1px solid var(--line-1,rgba(255,255,255,.07))">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <span style="font:var(--weight-bold) var(--text-lg)/1.2 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.tokenTitle)}</span>
            <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(v.tokenSub)}</span>
          </div>
          <span class="dc-p7" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onCloseToken} role="button" tabindex="0">
            <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
          </span>
        </div>

        <div style="flex:none;padding:var(--space-12) var(--space-12) var(--space-6)">
          <div style="display:flex;align-items:center;gap:var(--space-10);height:42px;padding:0 var(--space-12);box-sizing:border-box;border-radius:var(--radius-md);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))">
            <span style="flex:none;width:15px;height:15px;background:var(--ink-4,#7C7C8C);mask:{v.searchMask}"></span>
            <input style="flex:1;min-width:0;background:none;border:0;outline:none;font:var(--weight-medium) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1)" value={v.tokenQuery} oninput={v.onTokenQuery} placeholder={v.tokenPlaceholder} autofocus={true}>
            {#if v.hasQuery}
              <span style="flex:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));cursor:pointer" onclick={v.onClearQuery} role="button" tabindex="0">
                <span style="width:11px;height:11px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
              </span>
            {/if}
          </div>
        </div>

        <div style="flex:1;min-height:0;overflow-y:auto;padding:var(--space-6) var(--space-12) var(--space-12);display:flex;flex-direction:column;gap:var(--space-10)">
          {#each v.tokenGroups ?? [] as g, i7}
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
              <span style="padding:var(--space-6) var(--space-8);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">{t(g.label)}</span>
              {#each g.tokens ?? [] as tk, i8}
                <div class="dc-p8" style="display:flex;align-items:center;gap:var(--space-12);min-width:0;padding:var(--space-8) var(--space-8);border-radius:var(--radius-md);background:{tk.bg};cursor:{tk.cursor};user-select:none" onclick={tk.onSelect} role="button" tabindex="0">
                  <span style="flex:none;width:28px;height:28px;border-radius:var(--radius-pill);background:{tk.dot};opacity:{tk.dim}"></span>
                  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
                    <span style="font:var(--weight-semibold) var(--text-md)/1.2 var(--font-mono);color:{tk.ink}">{t(tk.symbol)}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">{t(tk.name)}</span>
                  </div>
                  {#if tk.taken}
                    <span style="flex:none;padding:2px var(--space-8);border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.07));font:var(--weight-semibold) var(--text-2xs)/1.4 var(--font-mono);color:var(--ink-4,#7C7C8C)">IN USE</span>
                  {/if}
                  {#if tk.selected}
                    <span style="flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)">
                      <span style="width:12px;height:12px;background:var(--on-accent,#2E0512);mask:{v.checkMask}"></span>
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
          {#if v.noTokenResults}
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-6);padding:var(--space-26) var(--space-18);box-sizing:border-box;border-radius:var(--radius-lg);border:1px dashed var(--line-2,rgba(255,255,255,.14))">
              <span style="font:var(--weight-semibold) var(--text-base)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">Nothing matches “{t(v.tokenQuery)}”</span>
              <span style="text-align:center;font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.tokenEmptyHint)}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p4:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
  .dc-p5:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p6:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p7:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p8:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>
