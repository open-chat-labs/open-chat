<!-- Message composer: + menu (photo/video, file, poll, prize, send / swap crypto, Meme Fighter), emoji/GIF picker, auto-growing text,
     mic ↔ send swap, and a voice flow: recording (live waveform + timer) → review (play back, seek) → send or delete.
     Optional reply / edit strip (context) and a staged attachment (chip or media tray). Esc closes menus, cancels the
     reply/edit, or deletes a recording. `demo` forces a state for docs/screenshots; otherwise fully interactive.
     Sending: when onSend returns a promise the draft stays until it resolves (and stays, with an error, if it rejects).
     Voice is real: the mic records with MediaRecorder (live levels from the microphone) and onVoice gets the audio Blob;
     the mic only shows with onVoice and a browser that can record. Forced demo states are visual only and never send. -->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { ComposerAttachment, ComposerContext, MenuItem } from '../types';
  import EmojiPicker from './EmojiPicker.svelte';
  import Menu from './Menu.svelte';
  import SegmentedTabs from './SegmentedTabs.svelte';
  import TokenAvatar from './TokenAvatar.svelte';
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';

  type AttachKind = 'media' | 'file' | 'poll' | 'prize' | 'crypto' | 'swap' | 'memeFighter';

  const GIF_CATS = ['Trending', 'Reactions', 'Celebrate', 'Crypto', 'Thanks'] as const;
  // GIF_WORDS are placeholder GIF results (data), only the category names are UI copy.
  // Kept until implementation: real results need a host-fed GIF source (see EXPORT.md, Known gaps).
  const GIF_CAT_KEYS: Record<(typeof GIF_CATS)[number], string> = { Trending: 'ui.messageComposer.gifTrending', Reactions: 'ui.messageComposer.gifReactions', Celebrate: 'ui.messageComposer.gifCelebrate', Crypto: 'ui.messageComposer.gifCrypto', Thanks: 'ui.messageComposer.gifThanks' };
  const GIF_TONES = [
    'linear-gradient(150deg,#5CB8FF,#2F6BFF)',
    'linear-gradient(150deg,#FF8FA8,#E0456A)',
    'linear-gradient(150deg,#FFC061,#F58A2E)',
    'linear-gradient(150deg,#2EE6A8,#1FA6B8)',
    'linear-gradient(150deg,#E27BFF,#9B3FD9)',
    'linear-gradient(150deg,#8B7BFF,#5B3FD9)',
  ];
  const GIF_WORDS: Record<(typeof GIF_CATS)[number], string[]> = {
    Trending: ['mic drop', "let's go", 'this is fine', 'no way', 'mood', 'facepalm', 'slow clap', 'hype'],
    Reactions: ['lol', 'shocked', 'eye roll', 'nod', 'shrug', 'yikes'],
    Celebrate: ['confetti', 'dance', 'cheers', 'woohoo', 'fireworks', 'trophy'],
    Crypto: ['to the moon', 'hodl', 'wagmi', 'gm', 'number go up', 'diamond hands'],
    Thanks: ['thank you', 'bow', 'high five', 'appreciate it', 'hug', 'legend'],
  };
  const HEIGHTS = ['112px', '150px', '132px', '96px', '140px', '118px', '104px', '146px'];
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // demo states only: the forced recording/review screens draw a made-up waveform
  const amp = () => 0.18 + Math.random() * 0.82;

  interface Props {
    /** Forces a state for docs and screenshots. */
    demo?: 'interactive' | 'idle' | 'typing' | 'plus' | 'emoji' | 'gif' | 'recording' | 'review';
    /** Resource key (or literal text). */
    placeholder?: string;
    /** The draft to start from, read when the composer mounts (key the composer to start another). */
    text?: string;
    /** The draft as it changes while it's being written (typed, an emoji picked, cleared on send); not while editing. */
    onInput?: (text: string) => void;
    /** Whether Enter sends (Shift+Enter a new line); off, Enter is a new line and Ctrl/⌘+Enter sends. */
    enterSends?: boolean;
    /** Send the text. Return a promise to keep the draft until it resolves (kept with an error if it rejects). */
    onSend?: (text: string) => Promise<unknown> | void;
    onAttach?: (kind: AttachKind) => void;
    onGif?: (query: string) => void;
    /** A recorded voice message (duration in seconds). The mic is hidden without it. Reject to keep the take. */
    onVoice?: (r: { blob: Blob; duration: number; mimeType: string }) => Promise<unknown> | void;
    attachment?: ComposerAttachment | null;
    onEditAttachment?: () => void;
    onRemoveAttachment?: () => void;
    onAddMedia?: () => void;
    onRemoveMediaItem?: (index: number) => void;
    context?: ComposerContext | null;
    onCancelContext?: () => void;
    onSubmitEdit?: (text: string) => void;
    onJumpContext?: () => void;
  }

  let {
    demo = 'interactive',
    placeholder = 'ui.messageComposer.placeholder',
    text = '',
    onInput,
    enterSends = true,
    onSend,
    onAttach,
    onGif,
    onVoice,
    attachment = null,
    onEditAttachment,
    onRemoveAttachment,
    onAddMedia,
    onRemoveMediaItem,
    context = null,
    onCancelContext,
    onSubmitEdit,
    onJumpContext,
  }: Props = $props();
  const t = useT();

  let root: HTMLDivElement;
  let input = $state<HTMLTextAreaElement>();
  let search = $state<HTMLInputElement>();
  let wave = $state<HTMLDivElement>();

  // mounting straight into edit mode starts from the original text (later context changes are handled below)
  let draft = $state(untrack(() => (context?.mode === 'edit' ? context.text ?? '' : text)));
  let menu = $state<'plus' | 'picker' | null>(null);
  let tab = $state(0);
  let query = $state('');
  let gifCat = $state(0);
  let voice = $state<'recording' | 'review' | null>(null);
  let secs = $state(0);
  let levels = $state<number[]>([]);
  let playing = $state(false);
  let playPos = $state(0);
  let focused = $state(false);
  let seeking = $state(false);
  let barCount = $state(40);

  let recTimer: ReturnType<typeof setInterval> | undefined;
  // a live recording, and the finished take under review
  let take: { recorder: MediaRecorder; stream: MediaStream; ctx: AudioContext; chunks: Blob[]; started: number } | null = null;
  let clip: { blob: Blob; url: string; duration: number } | null = null;
  let audio: HTMLAudioElement | null = null;
  let sending = $state(false);
  let failure = $state<'send' | 'voice' | 'mic' | null>(null);
  const canRecord = $derived(
    demo !== 'interactive' || (!!onVoice && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'),
  );
  let playTimer: ReturnType<typeof setInterval> | undefined;
  let endSeek: (() => void) | null = null;

  const editing = $derived(context?.mode === 'edit');

  // the host hears the draft as it changes, not the text it started from or an edit's
  let reported = untrack(() => draft);
  $effect(() => {
    const current = draft;
    if (current === reported || untrack(() => editing)) return;
    reported = current;
    untrack(() => onInput?.(current));
  });
  const att = $derived(editing ? null : attachment);
  const hasContent = $derived(!!draft.trim() || !!att);
  const needle = $derived(query.trim().toLowerCase());
  const gifWords = $derived(needle ? [...GIF_WORDS.Trending, ...GIF_WORDS.Reactions].filter((w) => w.includes(needle)) : GIF_WORDS[GIF_CATS[gifCat]]);

  // waveform: recording shows the latest samples scrolling in from the right; review shows the whole take, played part highlighted
  const bars = $derived.by(() => {
    if (voice === 'review') {
      const step = Math.max(1, levels.length / barCount);
      return Array.from({ length: barCount }, (_, i) => ({ h: Math.round(4 + (levels[Math.floor(i * step)] ?? 0.2) * 22), played: i / barCount < playPos, idle: false }));
    }
    // always barCount slots so the waveform spans the full width; empty leading slots show a quiet baseline
    const tail = levels.slice(-barCount), pad = barCount - tail.length;
    return Array.from({ length: barCount }, (_, i) => (i < pad ? { h: 3, played: false, idle: true } : { h: Math.round(4 + tail[i - pad] * 22), played: false, idle: false }));
  });

  const plusItems: MenuItem[] = $derived([
    { label: t('ui.messageComposer.photoOrVideo'), mask: 'var(--icon-image) center/contain no-repeat', onSelect: () => attach('media') },
    { label: t('ui.messageComposer.file'), mask: 'var(--icon-file) center/contain no-repeat', onSelect: () => attach('file') },
    { label: t('ui.messageComposer.poll'), mask: 'var(--icon-poll) center/contain no-repeat', onSelect: () => attach('poll') },
    { label: t('ui.messageComposer.prizeMessage'), mask: 'var(--icon-trophy) center/contain no-repeat', onSelect: () => attach('prize') },
    { label: t('ui.messageComposer.sendCrypto'), mask: 'var(--icon-wallet-send) center/contain no-repeat', onSelect: () => attach('crypto') },
    { label: t('ui.messageComposer.swapCrypto'), mask: 'var(--icon-swap) center/contain no-repeat', onSelect: () => attach('swap') },
    { label: t('ui.messageComposer.memeFighter'), mask: 'var(--icon-joystick) center/contain no-repeat', onSelect: () => attach('memeFighter') },
  ]);

  function attach(kind: AttachKind) {
    menu = null;
    onAttach?.(kind);
  }

  function grow() {
    const el = input;
    if (!el) return;
    el.style.height = '22px';
    const h = el.scrollHeight - 14;
    el.style.height = `${Math.min(h, 160)}px`;
    el.style.overflowY = h > 160 ? 'auto' : 'hidden';
  }

  async function insert(text: string) {
    const el = input;
    const a = el ? el.selectionStart : draft.length, b = el ? el.selectionEnd : draft.length;
    draft = draft.slice(0, a) + text + draft.slice(b);
    await tick();
    if (el) {
      el.focus();
      el.selectionStart = el.selectionEnd = a + text.length;
      grow();
    }
  }

  async function send() {
    if (editing) {
      // an emptied edit is not submitted; deleting the message is a separate action
      if (draft.trim()) onSubmitEdit?.(draft.trim());
      return;
    }
    if (!hasContent || sending) return;
    const text = draft.trim();
    failure = null;
    const result = onSend?.(text);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      sending = true;
      try {
        await result;
        // anything typed while it was sending stays
        if (draft.trim() === text) draft = '';
      } catch {
        failure = 'send';
      } finally {
        sending = false;
      }
    } else draft = '';
    await tick();
    grow();
    input?.focus();
  }

  function startTicking() {
    clearInterval(recTimer);
    let n = 0;
    recTimer = setInterval(() => {
      n++;
      levels = [...levels, amp()].slice(-200);
      if (n % 8 === 0) secs++;
    }, 125);
  }

  function resume() {
    const dur = Math.max(1, secs) * 1000;
    clearInterval(playTimer);
    playing = true;
    if (clip) {
      // the real take: play it and follow its position
      const a = (audio ??= new Audio(clip.url));
      const length = clip.duration;
      a.currentTime = Math.min(playPos, 0.999) * length;
      a.onended = () => {
        clearInterval(playTimer);
        playPos = 1;
        playing = false;
      };
      a.play().catch(() => (playing = false));
      playTimer = setInterval(() => (playPos = Math.min(1, a.currentTime / length)), 100);
      return;
    }
    playTimer = setInterval(() => {
      const next = playPos + 100 / dur;
      if (next >= 1) {
        clearInterval(playTimer);
        playPos = 1;
        playing = false;
      } else playPos = next;
    }, 100);
  }

  // a pending microphone request: a newer request, Delete / Esc, or unmounting makes it stale (its stream is stopped)
  let startRun = 0;
  let starting = false;
  let destroyed = false;

  async function startRecording() {
    if (voice || starting || !canRecord) return;
    menu = null;
    failure = null;
    if (demo !== 'interactive') {
      voice = 'recording';
      secs = 0;
      levels = [];
      startTicking();
      return;
    }
    const run = ++startRun;
    starting = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (run === startRun) {
        starting = false;
        if (!destroyed) failure = 'mic';
      }
      return;
    }
    if (destroyed || run !== startRun) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    starting = false;
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    // live levels from the microphone for the waveform
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const started = performance.now();
    take = { recorder, stream, ctx, chunks, started };
    recorder.start();
    voice = 'recording';
    secs = 0;
    levels = [];
    clearInterval(recTimer);
    recTimer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      levels = [...levels, Math.min(1, 0.12 + Math.sqrt(sum / buf.length) * 3)].slice(-200);
      secs = Math.floor((performance.now() - started) / 1000);
    }, 125);
  }

  // stops the live recording and hands back its audio (null when there was none, e.g. a demo state)
  async function finishTake(keep: boolean): Promise<{ blob: Blob; duration: number } | null> {
    clearInterval(recTimer);
    const tk = take;
    take = null;
    if (!tk) return null;
    const duration = (performance.now() - tk.started) / 1000;
    if (tk.recorder.state !== 'inactive') {
      const stopped = new Promise<void>((resolve) => (tk.recorder.onstop = () => resolve()));
      tk.recorder.stop();
      await stopped;
    }
    tk.stream.getTracks().forEach((track) => track.stop());
    tk.ctx.close().catch(() => {
      // already closed
    });
    return keep ? { blob: new Blob(tk.chunks, { type: tk.recorder.mimeType }), duration } : null;
  }

  function dropClip() {
    audio?.pause();
    audio = null;
    if (clip) URL.revokeObjectURL(clip.url);
    clip = null;
  }

  async function stopRecording() {
    const got = await finishTake(true);
    if (got) {
      dropClip();
      clip = { blob: got.blob, url: URL.createObjectURL(got.blob), duration: got.duration };
      secs = Math.max(1, Math.round(got.duration));
    }
    voice = 'review';
    playPos = 0;
    playing = false;
  }

  function resetVoice() {
    // also cancels a microphone request still waiting on the permission prompt
    startRun++;
    starting = false;
    clearInterval(recTimer);
    clearInterval(playTimer);
    void finishTake(false);
    dropClip();
    voice = null;
    secs = 0;
    levels = [];
    playing = false;
    playPos = 0;
  }

  // Delete / Esc: not while the voice note is being sent (a failure keeps the take for another try)
  function discardVoice() {
    if (sending) return;
    resetVoice();
  }

  async function sendVoice() {
    if (sending) return;
    if (voice === 'recording') await stopRecording();
    // demo states have no audio: nothing is sent
    if (!clip || !onVoice) {
      resetVoice();
      return;
    }
    clearInterval(playTimer);
    audio?.pause();
    playing = false;
    failure = null;
    sending = true;
    try {
      await onVoice({ blob: clip.blob, duration: Math.round(clip.duration * 10) / 10, mimeType: clip.blob.type });
      resetVoice();
    } catch {
      // the take stays in review so it can be sent again
      failure = 'voice';
    } finally {
      sending = false;
    }
  }

  function togglePlay() {
    if (playing) {
      clearInterval(playTimer);
      audio?.pause();
      playing = false;
      return;
    }
    if (playPos >= 1) playPos = 0;
    resume();
  }

  async function togglePicker() {
    const opening = menu !== 'picker';
    menu = opening ? 'picker' : null;
    query = '';
    if (opening && demo === 'interactive') {
      await tick();
      search?.focus({ preventScroll: true });
    }
  }

  function rootKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (context && !menu && !voice) {
      e.stopPropagation();
      onCancelContext?.();
    } else if (menu) {
      e.stopPropagation();
      menu = null;
      input?.focus();
    } else if (voice || starting) {
      e.stopPropagation();
      discardVoice();
    }
  }

  // review waveform doubles as a seek slider: click/drag anywhere, arrows step 1s, Home/End jump
  function seekStart(e: PointerEvent) {
    const el = wave;
    if (voice !== 'review' || !el) return;
    e.preventDefault();
    const at = (x: number) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / r.width));
    };
    const wasPlaying = playing;
    clearInterval(playTimer);
    audio?.pause();
    playPos = at(e.clientX);
    seeking = true;
    playing = false;
    el.focus({ preventScroll: true });
    const move = (ev: PointerEvent) => (playPos = at(ev.clientX));
    const up = () => {
      endSeek?.();
      seeking = false;
      if (wasPlaying) resume();
    };
    endSeek = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      endSeek = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // moves the playhead; the real take follows, so the play timer doesn't snap it back
  function seekTo(pos: number) {
    playPos = pos;
    if (audio && clip) audio.currentTime = Math.min(pos, 0.999) * clip.duration;
  }

  function seekKey(e: KeyboardEvent) {
    if (voice !== 'review') return;
    const step = 1 / Math.max(1, secs);
    const k = ({ ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step } as Record<string, number>)[e.key];
    if (k != null) {
      e.preventDefault();
      seekTo(Math.max(0, Math.min(1, playPos + k)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo(1);
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    }
  }

  function applyDemo(d: Props['demo']) {
    if (!d || d === 'interactive') return;
    clearInterval(recTimer);
    clearInterval(playTimer);
    menu = null;
    voice = null;
    draft = '';
    tab = 0;
    playing = false;
    playPos = 0;
    focused = false;
    if (d === 'typing') {
      draft = 'Shipping the composer today — anyone want a preview?';
      focused = true;
    } else if (d === 'plus') menu = 'plus';
    else if (d === 'emoji') menu = 'picker';
    else if (d === 'gif') {
      menu = 'picker';
      tab = 1;
    } else if (d === 'recording' || d === 'review') {
      levels = Array.from({ length: 160 }, amp);
      voice = d;
      secs = d === 'recording' ? 7 : 12;
      if (d === 'recording') startTicking();
      else playPos = 0.35;
    }
  }

  // demo changes re-apply the forced state
  $effect(() => {
    const d = demo;
    untrack(() => applyDemo(d));
  });

  // reply/edit context: edit pre-fills the original text; leaving edit puts back whatever the user had been writing
  // before it (never the edited message's text); both move focus into the input
  let prevContext = untrack(() => context);
  let savedDraft: string | null = null;
  $effect(() => {
    const next = context;
    untrack(async () => {
      const prev = prevContext;
      prevContext = next;
      if (prev?.key === next?.key) return;
      if (next?.mode === 'edit') {
        // edit → another edit keeps the draft saved from before the first one
        if (prev?.mode !== 'edit') savedDraft = draft;
        draft = next.text ?? '';
        menu = null;
        await tick();
        if (input) {
          input.focus({ preventScroll: true });
          input.selectionStart = input.selectionEnd = input.value.length;
          grow();
        }
      } else {
        // leaving edit (cancel, or straight into a reply) drops the edited message's text
        if (prev?.mode === 'edit') {
          draft = savedDraft ?? '';
          savedDraft = null;
          await tick();
          grow();
        }
        if (next) input?.focus({ preventScroll: true });
      }
    });
  });

  onMount(() => {
    const down = (e: MouseEvent) => {
      if (menu && !root.contains(e.target as Node)) menu = null;
    };
    document.addEventListener('mousedown', down);
    // a draft the composer starts from takes the height it needs
    if (draft) tick().then(grow);
    // bar count follows the available width: one 3px bar per ~5px, so spacing stays tight at any size
    const fit = () => (barCount = Math.max(16, Math.min(120, Math.floor((root.getBoundingClientRect().width - 170) / 5))));
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    fit();
    return () => {
      destroyed = true;
      startRun++;
      document.removeEventListener('mousedown', down);
      ro.disconnect();
      endSeek?.();
      clearInterval(recTimer);
      clearInterval(playTimer);
      void finishTake(false);
      dropClip();
    };
  });

  const contextLabel = $derived(
    editing ? t('ui.messageComposer.editingMessage') : context?.name ? t('ui.messageComposer.replyingTo', { name: context.name }) : t('ui.messageComposer.replyingToMessage'),
  );
  const removeLabel = $derived(
    t(att?.type === 'swap' ? 'ui.messageComposer.removeSwap' : att?.type === 'transfer' ? 'ui.messageComposer.removeTransfer' : att?.type === 'file' ? 'ui.messageComposer.removeFile' : 'ui.messageComposer.removePrize'),
  );
  const chip = $derived.by(() => {
    if (!att || att.type === 'media') return null;
    if (att.type === 'file') return { label: att.title, meta: att.summary, title: '' };
    if (att.type === 'swap') return { label: att.title, meta: att.summary, title: att.hint };
    const label = att.type === 'transfer' ? att.title : t('ui.messageComposer.prizeLabel', { amount: att.amountText });
    return {
      label,
      meta: att.feeText ? t('ui.messageComposer.withFee', { summary: att.summary, fee: att.feeText }) : att.summary,
      title: att.totalText ? t('ui.messageComposer.totalInclFees', { summary: att.summary, total: att.totalText }) : '',
    };
  });
</script>

<div class="composer" bind:this={root} onkeydown={rootKey} role="group">
  {#if menu === 'plus'}
    <div class="popup">
      <Menu heading={t('ui.messageComposer.addHeading')} minWidth="232px" items={plusItems} />
    </div>
  {/if}
  {#if menu === 'picker'}
    <div class="popup picker" role="dialog" aria-label={t(tab ? 'ui.messageComposer.gifs' : 'ui.messageComposer.emoji')}>
      <!-- GIFs only for a host that takes them -->
      {#if onGif || demo !== 'interactive'}
        <SegmentedTabs
          labels={[t('ui.messageComposer.emoji'), t('ui.messageComposer.gif')]}
          selectedIndex={tab}
          dotOnLast={false}
          onSelect={(i) => {
            tab = i;
            query = '';
          }}
        />
      {/if}
      {#if tab === 0}
        <div class="emoji-area">
          <div class="fill"><EmojiPicker onPick={insert} onClose={() => (menu = null)} autoFocus={demo === 'interactive'} /></div>
        </div>
      {:else}
        <div class="search">
          <span class="search-icon"></span>
          <input bind:this={search} bind:value={query} placeholder={t('ui.messageComposer.searchGifs')} aria-label={t('ui.messageComposer.searchGifs')} />
        </div>
        <div class="cats">
          {#each GIF_CATS as cat, i}
            {@const on = !needle && i === gifCat}
            <span
              class="cat"
              class:on
              onclick={() => {
                gifCat = i;
                query = '';
              }}
              role="button"
              tabindex="0"
              aria-pressed={on}>{t(GIF_CAT_KEYS[cat])}</span
            >
          {/each}
        </div>
        <div class="gif-scroll">
          <div class="gif-columns">
            {#each gifWords as word, i}
              <span
                class="gif"
                style:height={HEIGHTS[i % HEIGHTS.length]}
                style:background={GIF_TONES[(i + gifCat) % GIF_TONES.length]}
                onclick={() => {
                  menu = null;
                  onGif?.(word);
                }}
                role="button"
                tabindex="0"
                aria-label={word}><span class="gif-label">{word}</span></span
              >
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="bar" class:focused={focused || !!menu} class:recording={voice === 'recording'} class:editing>
    {#if att?.type === 'media'}
      <div class="tray">
        {#each att.items as item, i}
          <div class="thumb" style:background={item.src && item.kind === 'image' ? `center/cover no-repeat ${cssUrl(item.src)}` : item.bg || 'var(--surface-2)'}>
            {#if item.kind === 'video' && item.src}<video src={item.src} muted playsinline preload="metadata"></video>{/if}
            {#if item.kind === 'video'}<span class="duration"><span class="duration-icon"></span>{item.dur || t('ui.messageComposer.video')}</span>{/if}
            <span class="thumb-remove" onclick={() => onRemoveMediaItem?.(i)} role="button" tabindex="0" aria-label={t(item.kind === 'video' ? 'ui.messageComposer.removeVideo' : 'ui.messageComposer.removePhoto', { n: i + 1 })} title={t('ui.common.remove')}
              ><span class="thumb-remove-icon"></span></span
            >
          </div>
        {/each}
        {#if att.items.length < 10}
          <span class="tray-add" onclick={onAddMedia} role="button" tabindex="0" aria-label={t('ui.messageComposer.addMedia')} title={t('ui.messageComposer.addMore')}><span class="tray-add-icon"></span></span>
        {/if}
      </div>
    {/if}
    {#if context && !voice}
      <div class="context" role="status" aria-label={contextLabel}>
        <span class="context-main" onclick={onJumpContext} role="button" tabindex="0" title={t('ui.messageComposer.showOriginal')}>
          {#if context.thumb}
            <span class="context-thumb" style:background={context.thumb}></span>
          {:else}
            <span class="context-icon" class:editing><span class="context-glyph" style:mask="var(--icon-{editing ? 'edit' : 'reply'}) center/contain no-repeat"></span></span>
          {/if}
          <span class="context-text"
            ><span class="context-label" class:editing>{contextLabel}</span><span class="context-quote">{context.quote}</span></span
          >
        </span>
        <span class="round-close" onclick={onCancelContext} role="button" tabindex="0" aria-label={t(editing ? 'ui.messageComposer.cancelEdit' : 'ui.messageComposer.cancelReply')} data-tip={t(editing ? 'ui.messageComposer.cancelEdit' : 'ui.messageComposer.cancelReply')}
          ><span class="close-icon"></span></span
        >
      </div>
    {/if}
    {#if att && chip}
      <div class="chip">
        {#if att.type === 'file'}
          <span class="file-tile" style:background={att.tint || 'var(--overlay-2)'}><span class="file-icon"></span></span>
        {:else if att.type === 'swap'}
          <div class="pair">
            <TokenAvatar symbol={att.pair[0].symbol} mark={att.pair[0].mark} gradient={att.pair[0].gradient} size={28} />
            <div class="pair-second"><TokenAvatar symbol={att.pair[1].symbol} mark={att.pair[1].mark} gradient={att.pair[1].gradient} size={28} /></div>
          </div>
        {:else if att.type !== 'media'}
          <TokenAvatar symbol={att.token.symbol} mark={att.token.mark} gradient={att.token.gradient} size={28} />
        {/if}
        <span class="chip-label">{chip.label}</span>
        <span class="chip-meta" title={chip.title}>{chip.meta}</span>
        {#if att.type !== 'file'}<span class="chip-edit" onclick={onEditAttachment} role="button" tabindex="0">{t('ui.common.edit')}</span>{/if}
        <span class="round-close" onclick={onRemoveAttachment} role="button" tabindex="0" aria-label={removeLabel} title={removeLabel}><span class="close-icon"></span></span>
      </div>
    {/if}
    {#if !voice}
      <div class="tools">
        <!-- the + menu only offers attachments a host takes -->
        {#if !editing && (onAttach || demo !== 'interactive')}
          <span
            class="tool"
            class:open={menu === 'plus'}
            onclick={() => (menu = menu === 'plus' ? null : 'plus')}
            role="button"
            tabindex="0"
            aria-label={t('ui.messageComposer.addToMessage')}
            aria-expanded={menu === 'plus'}
            aria-haspopup="menu"
            title={t('ui.messageComposer.addToMessageHint')}><span class="tool-icon plus"></span></span
          >
        {/if}
        <span class="tool" class:open={menu === 'picker'} onclick={togglePicker} role="button" tabindex="0" aria-label={t('ui.messageComposer.emojiAndGifs')} aria-expanded={menu === 'picker'} aria-haspopup="dialog" title={t('ui.messageComposer.emojiAndGifs')}
          ><span class="tool-icon emoji"></span></span
        >
      </div>
      <div class="input-wrap">
        <textarea
          bind:this={input}
          rows="1"
          value={draft}
          oninput={(e) => {
            draft = e.currentTarget.value;
            grow();
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && (enterSends || e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          onfocus={() => (focused = true)}
          onblur={() => (focused = false)}
          placeholder={t(att ? 'ui.messageComposer.addCaption' : placeholder)}
          aria-label={t(att ? 'ui.messageComposer.addCaption' : placeholder)}
        ></textarea>
      </div>
      {#if hasContent || editing || !canRecord}
        <span class="action send" onclick={send} role="button" tabindex="0" aria-disabled={editing ? !draft.trim() : !hasContent || sending} aria-label={t(editing ? 'ui.messageComposer.saveEdit' : 'ui.messageComposer.sendMessage')} title={t(editing ? 'ui.messageComposer.saveHint' : 'ui.messageComposer.sendHint')}
          ><span class="send-icon" style:mask="var(--icon-{editing ? 'check' : 'send'}) center/contain no-repeat"></span></span
        >
      {:else}
        <span class="action mic" onclick={startRecording} role="button" tabindex="0" aria-label={t('ui.messageComposer.recordVoice')} title={t('ui.messageComposer.recordVoice')}><span class="mic-icon"></span></span>
      {/if}
    {:else}
      <span class="action delete" onclick={discardVoice} role="button" tabindex="0" aria-disabled={sending} aria-label={t('ui.messageComposer.deleteRecording')} title={t('ui.messageComposer.deleteHint')}><span class="delete-icon"></span></span>
      <div class="voice">
        {#if voice === 'recording'}
          <span class="rec-dot" aria-hidden="true"></span>
        {:else}
          <span class="play" onclick={togglePlay} role="button" tabindex="0" aria-label={t(playing ? 'ui.messageComposer.pause' : 'ui.messageComposer.playRecording')}
            ><span class="play-icon" style:mask="var(--icon-{playing ? 'stop' : 'play'}) center/contain no-repeat"></span></span
          >
        {/if}
        <span class="timer" class:recording={voice === 'recording'} aria-live="off">{voice === 'review' ? `${mmss(secs * Math.min(1, playPos))} / ${mmss(secs)}` : mmss(secs)}</span>
        <div
          class="wave"
          class:seekable={voice === 'review'}
          bind:this={wave}
          role={voice === 'review' ? 'slider' : undefined}
          tabindex={voice === 'review' ? 0 : undefined}
          aria-label={voice === 'review' ? t('ui.messageComposer.seek') : undefined}
          aria-valuemin={voice === 'review' ? 0 : undefined}
          aria-valuemax={voice === 'review' ? secs : undefined}
          aria-valuenow={voice === 'review' ? Math.round(secs * playPos) : undefined}
          aria-valuetext={voice === 'review' ? t('ui.messageComposer.seekValue', { position: mmss(secs * playPos), total: mmss(secs) }) : undefined}
          aria-hidden={voice === 'review' ? undefined : 'true'}
          onpointerdown={seekStart}
          onkeydown={seekKey}
        >
          {#each bars as b}
            <span class="wave-bar" class:played={b.played} class:idle={b.idle} class:review={voice === 'review'} style:height="{b.h}px"></span>
          {/each}
          {#if voice === 'review'}
            <span class="handle" style:left="{Math.min(1, playPos) * 100}%" aria-hidden="true">
              <span class="handle-line"></span>
              <span class="handle-knob" class:seeking></span>
            </span>
          {/if}
        </div>
      </div>
      {#if voice === 'recording'}
        <span class="action stop" onclick={stopRecording} role="button" tabindex="0" aria-label={t('ui.messageComposer.stopRecording')} title={t('ui.messageComposer.stopHint')}><span class="stop-icon"></span></span>
      {/if}
      <span class="action send" onclick={sendVoice} role="button" tabindex="0" aria-disabled={sending} aria-label={t('ui.messageComposer.sendVoice')} title={t('ui.messageComposer.sendVoice')}
        ><span class="send-icon" style:mask="var(--icon-send) center/contain no-repeat"></span></span
      >
    {/if}
  </div>
  {#if failure}
    <span class="rec-hint failure" role="alert"
      >{t(failure === 'send' ? 'ui.messageComposer.sendFailed' : failure === 'voice' ? 'ui.messageComposer.voiceFailed' : 'ui.messageComposer.micUnavailable')}</span
    >
  {:else if voice === 'recording'}
    <span class="rec-hint">{t('ui.messageComposer.recordingHint')}</span>
  {/if}
</div>

<style>
  .composer {
    position: relative;
    width: 100%;
  }

  .popup {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    z-index: 20;
  }

  .picker {
    width: min(360px, 100%);
    height: 400px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-10);
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-panel);
  }

  .emoji-area {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    margin: 0 calc(var(--space-10) * -1) calc(var(--space-10) * -1);
  }

  .fill {
    min-height: 0;
    height: 100%;
  }

  .search {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    height: 38px;
    padding: 0 var(--space-12);
    border-radius: var(--radius-md);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .search-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--ink-4);
    mask: var(--icon-search) center/contain no-repeat;
  }

  .search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: var(--weight-regular) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink);
  }

  .cats {
    flex: none;
    display: flex;
    gap: var(--space-6);
    overflow-x: auto;
  }

  .cat {
    flex: none;
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 var(--space-10);
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .cat.on {
    background: var(--ink);
    color: var(--surface-1);
  }

  .gif-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .gif-columns {
    column-count: 2;
    column-gap: var(--space-6);
  }

  .gif {
    position: relative;
    display: block;
    break-inside: avoid;
    margin-bottom: var(--space-6);
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
  }

  .gif:hover {
    filter: brightness(1.12);
  }

  .gif-label {
    position: absolute;
    left: 8px;
    bottom: 7px;
    padding: 3px 6px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.45);
    font: var(--weight-semibold) 10.5px/1 var(--font-sans);
    color: #fff;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-8);
    row-gap: var(--space-12);
    min-height: 52px;
    box-sizing: border-box;
    padding: var(--space-8);
    border-radius: var(--radius-xl);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
    transition: box-shadow var(--duration-fast);
  }

  .bar.recording {
    box-shadow: inset 0 0 0 1px var(--status-danger-line);
  }

  .bar.focused {
    box-shadow: inset 0 0 0 1px var(--line-3);
  }

  .bar.editing {
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 55%, transparent);
  }

  .tray {
    flex: 1 0 100%;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    padding: 2px;
  }

  .thumb {
    position: relative;
    flex: none;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .thumb video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .duration {
    position: absolute;
    left: 5px;
    bottom: 5px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.55);
    font: 600 10.5px/1 var(--font-mono);
    color: #fff;
  }

  .duration-icon {
    width: 8px;
    height: 8px;
    background: #fff;
    mask: var(--icon-play) center/contain no-repeat;
  }

  .thumb-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    cursor: pointer;
  }

  .thumb-remove-icon {
    width: 10px;
    height: 10px;
    background: #fff;
    mask: var(--icon-close) center/contain no-repeat;
  }

  .tray-add {
    flex: none;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1.5px var(--line-2);
    cursor: pointer;
  }

  .tray-add:hover {
    background: var(--overlay-1);
  }

  .tray-add-icon {
    width: 20px;
    height: 20px;
    background: var(--ink-3);
    mask: var(--icon-plus) center/contain no-repeat;
  }

  .context {
    flex: 1 0 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    box-sizing: border-box;
    padding: 4px 4px 4px 6px;
    border-radius: 16px;
    background: var(--surface-2);
  }

  .context-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    border-radius: 12px;
  }

  .context-thumb {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .context-icon {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in oklch, var(--accent) 18%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .context-icon.editing {
    background: var(--overlay-2);
  }

  .context-glyph {
    width: 15px;
    height: 15px;
    background: var(--accent-bright);
  }

  .editing .context-glyph {
    background: var(--ink-2);
  }

  .context-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .context-label {
    font: 600 12.5px/1.1 var(--font-sans);
    color: var(--accent-bright);
  }

  .context-label.editing {
    color: var(--ink-2);
  }

  /* the quoted message wraps up to three lines, then ends in an ellipsis (same as the bubble's reply quote) */
  .context-quote {
    font: 400 13px/1.3 var(--font-sans);
    color: var(--ink-3);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .round-close {
    width: 32px;
    height: 32px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
  }

  .round-close:hover {
    background: var(--overlay-2);
  }

  .close-icon {
    width: 13px;
    height: 13px;
    background: var(--ink-2);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .chip {
    flex: 1 0 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    box-sizing: border-box;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in oklch, var(--accent) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 32%, transparent);
  }

  .file-tile {
    width: 32px;
    height: 32px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .file-icon {
    width: 15px;
    height: 15px;
    background: #fff;
    mask: var(--icon-file) center/contain no-repeat;
  }

  .pair {
    flex: none;
    display: flex;
  }

  .pair-second {
    margin-left: -8px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--field);
  }

  .chip-label {
    flex: none;
    font: var(--weight-bold) 14px/1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
  }

  /* fee stays inside the chip so the composer keeps its height */
  .chip-meta {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) 13px/1 var(--font-sans);
    color: var(--ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-edit {
    flex: none;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 13px/1 var(--font-sans);
    color: var(--accent-bright);
    cursor: pointer;
  }

  .chip-edit:hover {
    background: var(--overlay-1);
  }

  .tools {
    flex: none;
    display: flex;
    gap: var(--space-2);
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }

  .tool:hover,
  .tool.open {
    background: var(--overlay-2);
  }

  .tool-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-3);
  }

  .open .tool-icon {
    background: var(--ink);
  }

  .tool-icon.plus {
    mask: var(--icon-plus) center/contain no-repeat;
    transition: transform var(--duration-base);
  }

  .open .tool-icon.plus {
    transform: rotate(45deg);
  }

  .tool-icon.emoji {
    mask: var(--icon-emoji) center/contain no-repeat;
  }

  .input-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 0 var(--space-4);
  }

  textarea {
    flex: 1;
    min-width: 0;
    height: 22px;
    max-height: 160px;
    padding: 7px 0;
    box-sizing: content-box;
    border: 0;
    outline: none;
    resize: none;
    overflow-y: hidden;
    scrollbar-width: thin;
    background: transparent;
    font: var(--weight-regular) var(--text-base) / 22px var(--font-sans);
    color: var(--ink);
  }

  .action {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .action.send {
    background: var(--accent);
  }

  .action.send:hover {
    filter: brightness(1.08);
  }

  .action.mic,
  .action.stop {
    background: var(--overlay-1);
  }

  .action.mic:hover,
  .action.stop:hover {
    background: var(--btn-hover);
  }

  .action.delete:hover {
    background: var(--status-danger-soft);
  }

  .send-icon {
    width: 17px;
    height: 17px;
    background: var(--on-accent);
  }

  .mic-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-2);
    mask: var(--icon-mic) center/contain no-repeat;
  }

  .delete-icon {
    width: 18px;
    height: 18px;
    background: var(--status-danger);
    mask: var(--icon-trash) center/contain no-repeat;
  }

  .stop-icon {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--ink-2);
  }

  .tool:focus-visible,
  .action:focus-visible,
  .play:focus-visible,
  .round-close:focus-visible,
  .chip-edit:focus-visible,
  .context-main:focus-visible,
  .thumb-remove:focus-visible,
  .tray-add:focus-visible,
  .gif:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .voice {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 36px;
    padding: 0 var(--space-4);
  }

  .rec-dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--status-danger);
    animation: ocRecPulse 1.2s ease-in-out infinite;
  }

  .play {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--overlay-2);
    cursor: pointer;
  }

  .play:hover {
    background: var(--btn-hover);
  }

  .play-icon {
    width: 12px;
    height: 12px;
    background: var(--ink);
  }

  .timer {
    flex: none;
    min-width: 36px;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--ink-2);
  }

  .timer.recording {
    color: var(--status-danger);
  }

  .wave {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0;
    overflow: hidden;
    border-radius: 6px;
    outline: none;
    cursor: default;
    touch-action: none;
  }

  .wave.seekable {
    cursor: pointer;
  }

  .wave:focus-visible {
    box-shadow: var(--focus-ring);
  }

  .wave-bar {
    flex: none;
    width: 3px;
    border-radius: 2px;
    background: var(--ink-2);
    transition: height 0.12s;
    pointer-events: none;
  }

  .wave-bar.idle {
    background: var(--overlay-3, rgba(255, 255, 255, 0.14));
  }

  .wave-bar.review {
    background: var(--ink-4);
  }

  .wave-bar.review.played {
    background: var(--accent-bright);
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    pointer-events: none;
  }

  .handle-line {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: -1px;
    width: 2px;
    border-radius: 1px;
    background: var(--ink);
  }

  .handle-knob {
    position: absolute;
    top: 50%;
    left: -6px;
    width: 12px;
    height: 12px;
    margin-top: -6px;
    border-radius: 50%;
    background: var(--ink);
    box-shadow:
      0 0 0 2px var(--field),
      0 1px 4px rgba(0, 0, 0, 0.4);
    transition: transform var(--duration-fast);
  }

  .handle-knob.seeking {
    transform: scale(1.25);
  }

  .rec-hint {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    text-align: center;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4);
  }

  .rec-hint.failure {
    color: var(--status-danger);
  }

  .action.delete[aria-disabled='true'] {
    opacity: 0.4;
    cursor: default;
  }

  .action.send[aria-disabled='true'] {
    opacity: 0.4;
    cursor: default;
  }
</style>
