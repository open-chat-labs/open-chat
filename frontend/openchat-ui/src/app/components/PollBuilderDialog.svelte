<!-- Generated from lib/PollBuilderDialog.dc.html (source hash 4e7ef431) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './PollBuilderDialog.logic.js';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import PollMessage from '../../lib/components/PollMessage.svelte';
  import SortableInputList from '../../lib/components/SortableInputList.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    z?: number;
    preview?: boolean;
    onPublish?: (poll: { question: string; options: { label: string; votes: number }[]; multiple: boolean; publicVotes: boolean; canChange: boolean; hideResults: boolean; endsIn: string; endsAt: number }) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:{v.dlgW};max-height:100%;outline:none;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45)" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label="Create a poll" onkeydown={v.onKey}>
          <div style="flex:none;display:flex;align-items:center;gap:12px;height:var(--header-h,66px);box-sizing:border-box;padding:0 12px 0 22px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;font:700 17px/1 var(--font-sans);color:var(--ink,#ECECF1)">Create a poll</span>
            <IconButton variant="ghost" icon="close" label="Close" onClick={v.onClose}></IconButton>
          </div>
          <div style="flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:{v.grid}">
            <div style="display:flex;flex-direction:column;gap:22px;padding:20px 22px 22px;min-width:0">
              <div style="display:flex;flex-direction:column;gap:8px">
                <label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Question</label>
                <div style="display:flex;align-items:flex-start;gap:8px;padding:12px 14px;border-radius:12px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
                  <textarea style="flex:1;min-width:0;resize:none;overflow:hidden;min-height:44px;border:0;outline:none;background:transparent;padding:0;font:600 15px/1.45 var(--font-sans);color:var(--ink,#ECECF1)" rows="2" data-autogrow="" value={v.q} oninput={v.onQ} placeholder="What do you want to ask?" aria-label="Poll question"></textarea>
                  <span style="display:{v.qCountShow};font:500 11.5px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.qLeft)}</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:baseline;justify-content:space-between"><label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Answers</label><span style="font:400 12px/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(v.ansHint)}</span></div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <SortableInputList values={v.ansValues} onChange={v.onAnsList} min={2} max={10} maxLength={v.ansMax} itemLabel="Answer" label="Poll answers"></SortableInputList>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px">
                <label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Duration</label>
                <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px" role="radiogroup" aria-label="Poll duration">
                  {#each v.durations ?? [] as m, i0}
                    <span style="display:flex;align-items:center;justify-content:center;height:34px;padding:0 4px;white-space:nowrap;overflow:hidden;border-radius:17px;background:{m.bg};box-shadow:{m.ring};font:600 12.5px/1 var(--font-sans);letter-spacing:-.01em;color:{m.ink};cursor:pointer;user-select:none" onclick={m.pick} role="radio" aria-checked={m.checked} tabindex="0">{t(m.label)}</span>
                  {/each}
                </div>
              </div>
              {#if v.isFull}<div style="display:flex;flex-direction:column;gap:4px">
                <label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4);padding-bottom:6px">Settings</label>
                {#each v.settings ?? [] as s, i1}
                  <div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0">
                    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 13.5px/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(s.label)}</span><span style="font:400 12.5px/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(s.help)}</span></span>
                    <Toggle on={s.on} label="" onChange={s.toggle}></Toggle>
                  </div>
                {/each}
              </div>{/if}
              {#if v.isDisclosure}
                <div style="display:flex;flex-direction:column;border-radius:12px;background:var(--overlay-1,rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                  <span style="display:flex;align-items:center;gap:10px;min-height:48px;padding:8px 14px;cursor:pointer" onclick={v.toggleOpen} role="button" tabindex="0" aria-expanded={v.openStr}>
                    <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:var(--icon-gear) center/contain no-repeat"></span>
                    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 13.5px/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Settings</span><span style="font:400 12px/1.35 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.summary)}</span></span>
                    <span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:var(--icon-chevron-down) center/contain no-repeat;transform:{v.chev};transition:transform var(--duration-base,.2s)"></span>
                  </span>
                  {#if v.open}<div style="display:flex;flex-direction:column;padding:0 14px 6px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">{#each v.settings ?? [] as s, i2}
                  <div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0">
                    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 13.5px/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(s.label)}</span><span style="font:400 12.5px/1.45 var(--font-sans);color:var(--ink-3,#9A9AA8);text-wrap:pretty">{t(s.help)}</span></span>
                    <Toggle on={s.on} label="" onChange={s.toggle}></Toggle>
                  </div>
                {/each}</div>{/if}
                </div>
              {/if}
              {#if v.isChips}
                <div style="display:flex;flex-direction:column;gap:10px">
                  <label style="font:600 13px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">Settings</label>
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    {#each v.settings ?? [] as s, i3}
                      <span style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border-radius:17px;background:{s.bg};box-shadow:{s.ring};font:600 12.5px/1 var(--font-sans);color:{s.ink};cursor:pointer;user-select:none" onclick={s.toggle} role="switch" aria-checked={s.onStr} tabindex="0" title={s.help}><span style="width:14px;height:14px;background:currentColor;mask:{s.mask}"></span>{t(s.label)}</span>
                    {/each}
                  </div>
                  <span style="font:400 12px/1.45 var(--font-sans);color:var(--ink-4,#8A8A99);text-wrap:pretty">{t(v.chipNote)}</span>
                </div>
              {/if}
            </div>
            {#if v.hasPreview}
              <div style="display:flex;flex-direction:column;gap:12px;padding:20px 22px;border-left:1px solid var(--line-1,rgba(255,255,255,.07));background:var(--surface-0,#07070a)">
                <span style="font:600 10.5px/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#8A8A99)">PREVIEW · HOW IT LOOKS IN THE CHAT</span>
                <PollMessage side="sent" question={v.pq} options={v.pOpts} multiple={v.multi} publicVotes={v.pub} canChange={v.change} endsIn={v.endsIn} time="now"></PollMessage>
              </div>
            {/if}
          </div>
          <div style="display:flex;align-items:center;gap:14px;padding:14px 22px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;font:500 12.5px/1.4 var(--font-sans);color:{v.reasonInk};text-wrap:pretty">{t(v.reason)}</span>
            <span style="flex:none;display:flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:var(--radius-md,10px);background:{v.pubBg};font:600 14px/1 var(--font-sans);color:{v.pubInk};cursor:{v.pubCursor}" onclick={v.publish} role="button" tabindex={v.pubTab} aria-disabled={v.pubDisabled}><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-poll) center/contain no-repeat"></span>{t(v.pubLabel)}</span>
          </div>
          {#if v.confirming}
            <div style="position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--scrim,rgba(3,3,6,.6));backdrop-filter:blur(4px)">
              <div style="width:min(360px,100%);display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:18px;background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 18px 48px rgba(0,0,0,.5)" role="alertdialog" aria-label="Discard this poll?">
                <span style="font:700 16px/1.2 var(--font-sans);color:var(--ink,#ECECF1)">Discard this poll?</span>
                <span style="font:400 13px/1.5 var(--font-sans);color:var(--ink-3,#9A9AA8)">Your question and answers will be lost.</span>
                <div style="display:flex;justify-content:flex-end;gap:8px">
                  <Button label="Keep editing" variant="ghost" onClick={v.keep}></Button>
                  <Button label="Discard" variant="danger" onClick={v.discard}></Button>
                </div>
              </div>
            </div>
          {/if}
        </div>
</div>
