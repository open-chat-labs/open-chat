<!-- Poll: header tile (question + rule chips), option rows with slim bars (voter avatars on public polls), footer tile.
     Results stay hidden until you vote (the host can say otherwise with showResults). Radios for single choice, checkboxes for multiple.
     Controlled via `myVotes` + onVote(indexes), or uncontrolled; readonly locks it. -->
<script lang="ts">
  import { useT } from '../i18n';
  import AvatarStack from './AvatarStack.svelte';

  const RULES = {
    pub: { label: 'ui.pollMessage.publicVotes', icon: 'eye' },
    anon: { label: 'ui.pollMessage.anonymous', icon: 'eye-off' },
    multi: { label: 'ui.pollMessage.pickAny', icon: 'check-double' },
    single: { label: 'ui.pollMessage.pickOne', icon: 'check' },
    change: { label: 'ui.pollMessage.canChangeVote', icon: 'rotate-back' },
  };

  interface Props {
    question: string;
    /** voters: CSS backgrounds for AvatarStack (public polls). */
    options: { label: string; votes?: number; voters?: string[] }[];
    multiple?: boolean;
    publicVotes?: boolean;
    canChange?: boolean;
    closed?: boolean;
    endsIn?: string;
    myVotes?: number[] | null;
    /** No voting at all (a DM, a read-only chat); closed and a cast vote that can't change lock it too. */
    readonly?: boolean;
    /** Whether the counts and bars show; defaults to once you've voted or it's closed. */
    showResults?: boolean;
    side?: 'received' | 'sent';
    time: string;
    lastInGroup?: boolean;
    onVote?: (indexes: number[]) => void;
    onViewVotes?: () => void;
  }

  let {
    question,
    options,
    multiple = false,
    publicVotes = false,
    canChange = true,
    closed = false,
    endsIn = '',
    myVotes = null,
    readonly = false,
    showResults,
    side = 'received',
    time,
    lastInGroup = true,
    onVote,
    onViewVotes,
  }: Props = $props();
  const t = useT();

  let own = $state<number[]>([]);

  const sent = $derived(side === 'sent');
  const mine = $derived(myVotes ?? own);
  const counts = $derived(options.map((o, j) => (o.votes || 0) + (myVotes == null && mine.includes(j) ? 1 : 0)));
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const voted = $derived(mine.length > 0);
  const show = $derived(showResults ?? (voted || closed));
  const locked = $derived(readonly || closed || (voted && !canChange));
  const rules = $derived([publicVotes ? RULES.pub : RULES.anon, multiple ? RULES.multi : RULES.single, ...(canChange ? [RULES.change] : [])]);
  const foot = $derived(
    t(closed ? 'ui.pollMessage.footClosed' : show ? 'ui.pollMessage.footVoted' : 'ui.pollMessage.footHidden', {
      count: total,
      hasEnd: endsIn ? 'yes' : 'no',
      endsIn,
    }),
  );

  function pick(j: number) {
    if (locked) return;
    const next = multiple ? (mine.includes(j) ? mine.filter((x) => x !== j) : [...mine, j]) : mine.includes(j) ? [] : [j];
    if (myVotes == null) own = next;
    onVote?.(next);
  }
</script>

<div class="shell" class:sent class:last={lastInGroup}>
  <div class="stack">
    <div class="tile head">
      <span class="kicker"><span class="poll-icon"></span>{t('ui.pollMessage.poll')}</span>
      <span class="question">{question}</span>
      <div class="rules">
        {#each rules as rule}<span class="rule"><span class="rule-icon" style:mask="var(--icon-{rule.icon}) center/contain no-repeat"></span>{t(rule.label)}</span>{/each}
      </div>
    </div>
    <div class="tile options" role={multiple ? 'group' : 'radiogroup'} aria-label={t('ui.pollMessage.options')}>
      {#each options as option, j}
        {@const on = mine.includes(j)}
        {@const pct = total ? Math.round((counts[j] / total) * 100) : 0}
        <div class="option" class:on class:locked onclick={() => pick(j)} role={multiple ? 'checkbox' : 'radio'} aria-checked={on} tabindex="0">
          <div class="line">
            <span class="mark" class:multiple><span class="mark-tick"></span></span>
            <span class="label">{option.label}</span>
            {#if show && publicVotes && option.voters?.length}
              <span class="voters"><AvatarStack people={option.voters.slice(0, 3)} size={20} max={4} ring={sent ? 'var(--bubble-send-bg)' : 'var(--bubble-recv-bg)'} /></span>
            {/if}
            {#if show}<span class="pct">{pct}%</span>{/if}
          </div>
          <div class="track"><span class="bar" style:width="{show ? pct : 0}%"></span></div>
        </div>
      {/each}
    </div>
    <div class="tile foot">
      <span class="foot-text">{foot}</span>
      {#if publicVotes && show && onViewVotes}<span class="view" onclick={onViewVotes} role="button" tabindex="0">{t('ui.pollMessage.viewVotes')}</span>{/if}
    </div>
  </div>
  <div class="time">{time}</div>
</div>

<style>
  .shell {
    --msg-bg: var(--bubble-recv-bg);
    --msg-ink: var(--bubble-recv-text);
    --msg-soft: var(--ink-4);
    --msg-seg: var(--overlay-1);
    --msg-chip: var(--overlay-2);
    --msg-track: var(--overlay-2);
    --msg-link: var(--accent-bright);
    --msg-on-mark: var(--on-accent);
    --msg-fill: var(--accent);
    --msg-idle: var(--ink-4);
    --msg-ring: var(--line-3);
    width: 330px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs) 22px 22px var(--radius-xs);
    background: var(--msg-bg);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .shell.sent {
    --msg-bg: var(--bubble-send-bg);
    --msg-ink: var(--bubble-text);
    --msg-soft: var(--bubble-text-soft);
    --msg-seg: rgba(0, 0, 0, 0.18);
    --msg-chip: rgba(0, 0, 0, 0.2);
    --msg-track: rgba(0, 0, 0, 0.25);
    --msg-link: var(--bubble-text);
    --msg-on-mark: var(--bubble-send-bg);
    --msg-fill: #fff;
    --msg-idle: rgba(255, 255, 255, 0.45);
    --msg-ring: rgba(255, 255, 255, 0.6);
    box-shadow: none;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tile {
    border-radius: 6px;
    background: var(--msg-seg);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 2px 18px 6px 6px;
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 600 11.5px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .poll-icon {
    width: 13px;
    height: 13px;
    background: currentColor;
    mask: var(--icon-poll) center/contain no-repeat;
  }

  .question {
    font: 700 16px/1.3 var(--font-sans);
    color: var(--msg-ink);
    text-wrap: pretty;
  }

  .rules {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .rule {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    background: var(--msg-chip);
    font: 500 11.5px/1 var(--font-sans);
    color: var(--msg-soft);
  }

  .rule-icon {
    width: 11px;
    height: 11px;
    background: currentColor;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 14px;
  }

  .option {
    display: flex;
    flex-direction: column;
    gap: 7px;
    cursor: pointer;
    outline: none;
  }

  .option.locked {
    cursor: default;
  }

  .option:focus-visible {
    box-shadow: var(--focus-ring);
    border-radius: 6px;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mark {
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--msg-ring);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mark.multiple {
    border-radius: 5px;
  }

  .on .mark {
    box-shadow: none;
    background: var(--msg-fill);
  }

  .mark-tick {
    display: none;
    width: 11px;
    height: 11px;
    background: var(--msg-on-mark);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .on .mark-tick {
    display: block;
  }

  .label {
    flex: 1;
    min-width: 0;
    font: 500 14px/1.3 var(--font-sans);
    color: var(--msg-ink);
  }

  .on .label {
    font-weight: 600;
  }

  .voters {
    display: flex;
    margin-right: 2px;
  }

  .pct {
    font: 700 12.5px/1 var(--font-mono);
    color: var(--msg-ink);
  }

  .track {
    margin-left: 28px;
    height: 6px;
    border-radius: 3px;
    background: var(--msg-track);
    overflow: hidden;
  }

  .bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--msg-idle);
    transition: width 0.45s cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  .on .bar {
    background: var(--msg-fill);
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 14px;
  }

  .foot-text {
    flex: 1;
    min-width: 0;
    font: 500 12px/1.3 var(--font-sans);
    color: var(--msg-soft);
  }

  .view {
    font: 600 12.5px/1 var(--font-sans);
    color: var(--msg-link);
    cursor: pointer;
  }

  .time {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
    font: 400 11px/1 var(--font-mono);
    color: var(--msg-soft);
  }
</style>
