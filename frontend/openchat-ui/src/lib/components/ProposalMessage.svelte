<!-- Governance proposal. Outcome pill in the header (Open, Passing, Adopted, You voted to adopt/reject, Rejected, Expired) coloured by state.
     Native's two-threshold bar: ▾ softThreshold = passes when voting ends, ▼ hardThreshold = adopted immediately. Adopt/Reject only while you can vote.
     Without myVote it remembers the vote cast here. -->
<script lang="ts">
  import ThresholdBar from './ThresholdBar.svelte';

  type Vote = 'adopt' | 'reject';

  interface Props {
    title: string;
    /** Proposal type, e.g. "Transfer SNS treasury funds". */
    kind: string;
    proposer: string;
    /** Critical proposals use 20% / 67% thresholds by default. */
    critical?: boolean;
    state?: 'open' | 'rejected' | 'expired' | 'executed';
    /** Percent of voting power. */
    adopt: number;
    reject: number;
    softThreshold?: number;
    hardThreshold?: number;
    /** e.g. "Voting ends in 2d 4h"; closed proposals default to "Voting ended". */
    when?: string;
    myVote?: Vote | null;
    canVote?: boolean;
    time: string;
    lastInGroup?: boolean;
    onVote?: (side: Vote) => void;
    onDetails?: () => void;
  }

  let {
    title,
    kind,
    proposer,
    critical = false,
    state: status = 'open',
    adopt,
    reject,
    softThreshold,
    hardThreshold,
    when,
    myVote = null,
    canVote = true,
    time,
    lastInGroup = true,
    onVote,
    onDetails,
  }: Props = $props();

  let castHere = $state<Vote | null>(null);

  const open = $derived(status === 'open');
  const mine = $derived(myVote ?? castHere);
  const soft = $derived(softThreshold ?? (critical ? 20 : 3));
  const hard = $derived(hardThreshold ?? (critical ? 67 : 50));
  const passing = $derived(adopt >= soft);
  const adopted = $derived(adopt >= hard);
  const softLabel = $derived(`Passes when voting ends (${soft}%)`);
  const hardLabel = $derived(`Passes immediately (${hard}%)`);

  const tone = $derived(mine ? (mine === 'adopt' ? 'good' : 'bad') : status === 'rejected' ? 'bad' : status === 'expired' ? 'muted' : adopted || passing ? 'good' : 'info');
  const outcome = $derived(
    open
      ? mine
        ? mine === 'adopt' ? 'You voted to adopt' : 'You voted to reject'
        : adopted ? 'Adopted' : passing ? 'Passing' : 'Open'
      : status === 'rejected' ? 'Rejected' : status === 'executed' ? 'Executed' : 'Expired',
  );
  const icon = $derived(mine || status === 'executed' ? 'check' : status === 'rejected' ? 'close' : status === 'expired' ? 'clock' : 'dot');

  function cast(side: Vote) {
    if (!open || mine) return;
    if (myVote == null) castHere = side;
    onVote?.(side);
  }
</script>

<div class="shell" class:last={lastInGroup} class:expired={status === 'expired'}>
  <div class="stack">
    <div class="head">
      <div class="pills">
        <span class="pill outcome {tone}"><span class="pill-icon" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>{outcome}</span>
        {#if critical}<span class="pill critical"><span class="shield"></span>Critical</span>{/if}
      </div>
      <span class="title">{title}</span>
      <span class="byline">{kind} · by <span class="proposer">{proposer}</span></span>
    </div>
    <div class="tally">
      <ThresholdBar
        yes={adopt / 100}
        no={reject / 100}
        thresholds={[
          { at: soft / 100, label: softLabel },
          { at: hard / 100, label: hardLabel, strong: true },
        ]}
        label="{adopt.toFixed(2)}% adopt, {reject.toFixed(2)}% reject"
      />
      <div class="figures">
        <span class="figure yes">{adopt.toFixed(2)}%<span class="figure-label after">adopt</span></span>
        <span class="figure no"><span class="figure-label before">reject</span>{reject.toFixed(2)}%</span>
      </div>
      <div class="legend"><span class="key"><span class="soft-mark"></span>{softLabel}</span><span class="key"><span class="hard-mark"></span>{hardLabel}</span></div>
      <span class="when" class:open><span class="clock"></span>{when ?? (open ? '' : 'Voting ended')}</span>
    </div>
    {#if open && !mine && canVote}
      <div class="votes">
        <span class="vote adopt" onclick={() => cast('adopt')} role="button" tabindex="0"><span class="vote-icon check"></span>Adopt</span>
        <span class="vote reject" onclick={() => cast('reject')} role="button" tabindex="0"><span class="vote-icon cross"></span>Reject</span>
      </div>
    {/if}
    <span class="details" onclick={onDetails} role="button" tabindex="0">Proposal details<span class="external"></span></span>
  </div>
  <div class="time">{time}</div>
</div>

<style>
  .shell {
    width: 340px;
    max-width: 100%;
    padding: 4px;
    box-sizing: border-box;
    border-radius: var(--radius-xs, 4px) 22px 22px var(--radius-xs, 4px);
    background: var(--bubble-recv-bg, #191921);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .shell.last {
    border-bottom-left-radius: 22px;
  }

  .shell.expired {
    opacity: 0.75;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .head,
  .tally {
    display: flex;
    flex-direction: column;
    padding: 14px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
  }

  .head {
    gap: 8px;
    border-radius: 2px 18px 6px 6px;
  }

  .tally {
    gap: 10px;
    border-radius: 6px;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: 12px;
    font: 700 11.5px/1 var(--font-sans);
  }

  .pill-icon {
    width: 12px;
    height: 12px;
    background: currentColor;
  }

  .good {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 14%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .bad {
    background: var(--status-danger-soft, rgba(255, 77, 77, 0.12));
    color: var(--status-danger, #ff4d4d);
  }

  .info {
    background: color-mix(in oklch, var(--status-verified, #3d9bff) 15%, transparent);
    color: var(--status-verified, #3d9bff);
  }

  .muted {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
    color: var(--ink-3, #9a9aa8);
  }

  .critical {
    background: var(--status-danger-soft, rgba(255, 77, 77, 0.12));
    font-weight: 600;
    color: var(--status-danger, #ff4d4d);
  }

  .shield {
    width: 11px;
    height: 11px;
    background: currentColor;
    mask: var(--icon-shield) center/contain no-repeat;
  }

  .title {
    font: 700 15.5px/1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .byline {
    font: 400 12px/1.4 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .proposer {
    color: var(--accent-bright, #ff8298);
    font-weight: 600;
  }

  .figures {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .figure {
    font: 700 14px/1 var(--font-mono);
  }

  .yes {
    color: var(--status-online, #2ee6a8);
  }

  .no {
    color: var(--status-danger, #ff4d4d);
  }

  .figure-label {
    font: 500 11.5px/1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .after {
    margin-left: 5px;
  }

  .before {
    margin-right: 5px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font: 500 11.5px/1.3 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .key {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .soft-mark {
    width: 7px;
    height: 7px;
    margin: -3px 1px 0;
    box-sizing: border-box;
    border-right: 2px solid var(--ink-2, #c9c9d4);
    border-bottom: 2px solid var(--ink-2, #c9c9d4);
    transform: rotate(45deg);
  }

  .hard-mark {
    width: 0;
    height: 0;
    border-left: 4.5px solid transparent;
    border-right: 4.5px solid transparent;
    border-top: 6px solid var(--ink, #ececf1);
  }

  .when {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 12px/1 var(--font-sans);
    color: var(--ink-4, #8a8a99);
  }

  .when.open {
    color: var(--ink-2, #c9c9d4);
  }

  .clock {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-clock) center/contain no-repeat;
  }

  .votes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .vote {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border-radius: 6px;
    font: 700 13.5px/1 var(--font-sans);
    cursor: pointer;
  }

  .vote.adopt {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 16%, transparent);
    color: var(--status-online, #2ee6a8);
  }

  .vote.adopt:hover {
    background: color-mix(in oklch, var(--status-online, #2ee6a8) 24%, transparent);
  }

  .vote.reject {
    background: var(--status-danger-soft, rgba(255, 77, 77, 0.12));
    color: var(--status-danger, #ff4d4d);
  }

  .vote.reject:hover {
    background: color-mix(in oklch, var(--status-danger, #ff4d4d) 20%, transparent);
  }

  .vote-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .check {
    mask: var(--icon-check) center/contain no-repeat;
  }

  .cross {
    mask: var(--icon-close) center/contain no-repeat;
  }

  .details {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 14px;
    border-radius: 6px;
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    font: 600 12.5px/1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
    cursor: pointer;
  }

  .external {
    width: 12px;
    height: 12px;
    background: currentColor;
    mask: var(--icon-external) center/contain no-repeat;
  }

  .time {
    display: flex;
    justify-content: flex-end;
    padding: 6px 10px 4px;
    font: 400 11px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }
</style>
