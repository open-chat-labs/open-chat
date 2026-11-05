<!-- Message composer: + menu (photo/video, file, poll, prize, send / swap crypto, Meme Fighter), emoji/GIF picker, auto-growing text,
     mic ↔ send swap, and a voice flow: recording (live waveform + timer) → review (play back, seek) → send or delete.
     Optional reply / edit strip (context) and a staged attachment (chip or media tray). Esc closes menus, cancels the
     reply/edit, or deletes a recording. `demo` forces a state for docs/screenshots; otherwise fully interactive.
     Sending: when onSend returns a promise the draft stays until it resolves (and stays, with an error, if it rejects).
     Voice is real: the mic records with MediaRecorder (live levels from the microphone) and onVoice gets the audio Blob;
     the mic only shows with onVoice and a browser that can record. Forced demo states are visual only and never send.
     Native hosts: the + and emoji buttons can sit after the text (plusPlacement / emojiPlacement), the host can own the
     + and emoji surfaces (onPlus / plusActive, onEmoji / emojiActive: keyboard-area panels instead of the popovers), type
     into the draft without focusing it (insert), and size the bar with --composer-radius, --composer-min-h,
     --composer-pad, --composer-btn and --composer-btn-radius. -->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { ComposerAttachKind, ComposerAttachment, ComposerContext, MenuItem } from '../types';
  import EmojiPicker from './EmojiPicker.svelte';
  import Menu from './Menu.svelte';
  import SegmentedTabs from './SegmentedTabs.svelte';
  import TokenAvatar from './TokenAvatar.svelte';
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';
  import { deleteBackward, insertAt, type TextEdit } from '../textEdit';

  type AttachKind = ComposerAttachKind;

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
    /** The draft to start from, read when the composer mounts (key the composer to start another). Mounted in edit
     *  mode, it's what the box goes back to when the edit ends. */
    text?: string;
    /** The draft as it changes while it's being written (typed, an emoji picked, cleared on send); not while editing. */
    onInput?: (text: string) => void;
    /** Whether Enter sends (Shift+Enter a new line); off, Enter is a new line and Ctrl/⌘+Enter sends. */
    enterSends?: boolean;
    /** Whether the text box takes focus when the composer mounts, unless a dialog is open (key the composer to focus it again). */
    autofocus?: boolean;
    /** Send the text. Return a promise to keep the draft until it resolves (kept with an error if it rejects). */
    onSend?: (text: string) => Promise<unknown> | void;
    onAttach?: (kind: AttachKind) => void;
    /** What the + menu offers (all by default); with none, there's no + button. */
    attachKinds?: AttachKind[];
    onGif?: (query: string) => void;
    /** A recorded voice message (duration in seconds). The mic is hidden without it. Reject to keep the take. */
    onVoice?: (r: { blob: Blob; duration: number; mimeType: string }) => Promise<unknown> | void;
    /** The mime type to record voice in, where the browser can (else its own). */
    voiceMimeType?: string;
    /** The most a voice message may hold, in bytes: the recording stops there and says so. */
    voiceMaxBytes?: number;
    attachment?: ComposerAttachment | null;
    onEditAttachment?: () => void;
    onRemoveAttachment?: () => void;
    onAddMedia?: () => void;
    onRemoveMediaItem?: (index: number) => void;
    context?: ComposerContext | null;
    onCancelContext?: () => void;
    onSubmitEdit?: (text: string) => void;
    onJumpContext?: () => void;
    /** Where the + button sits: before the text (web, iOS) or after it, before mic / send (Android). */
    plusPlacement?: 'start' | 'end';
    /** Where the emoji button sits: before the text (web, Android) or after it (iOS). */
    emojiPlacement?: 'start' | 'end';
    /** The host owns the + surface (e.g. a keyboard-area panel): + calls this instead of opening the menu. */
    onPlus?: () => void;
    /** With onPlus: the host's + surface is showing (the button turns, as when the menu is open). */
    plusActive?: boolean;
    /** The host owns the emoji / GIF surface: the emoji button calls this instead of opening the picker. */
    onEmoji?: () => void;
    /** With onEmoji: the host's emoji surface is showing (the button offers the keyboard back). */
    emojiActive?: boolean;
    /** A text box inside the composer took focus (a native host closes its panels as the keyboard opens). */
    onInputFocus?: () => void;
    /** Typing from the host (its emoji panel): each new `key` puts `text` in at the caret without focusing the field,
     *  so no keyboard opens. "\b" deletes the selection, or the character before the caret. */
    insert?: { key: string | number; text: string };
  }

  let {
    demo = 'interactive',
    placeholder = 'ui.messageComposer.placeholder',
    text = '',
    onInput,
    enterSends = true,
    autofocus = false,
    onSend,
    onAttach,
    attachKinds,
    onGif,
    onVoice,
    voiceMimeType,
    voiceMaxBytes,
    attachment = null,
    onEditAttachment,
    onRemoveAttachment,
    onAddMedia,
    onRemoveMediaItem,
    context = null,
    onCancelContext,
    onSubmitEdit,
    onJumpContext,
    plusPlacement = 'start',
    emojiPlacement = 'start',
    onPlus,
    plusActive = false,
    onEmoji,
    emojiActive = false,
    onInputFocus,
    insert: hostInsert,
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
  // the take reached voiceMaxBytes and was stopped there
  let capped = $state(false);
  const canRecord = $derived(
    demo !== 'interactive' || (!!onVoice && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'),
  );
  let playTimer: ReturnType<typeof setInterval> | undefined;
  let endSeek: (() => void) | null = null;

  const editing = $derived(context?.mode === 'edit');
  // + and emoji: the composer's own menu / picker, or the host's surface
  const plusOn = $derived(onPlus ? plusActive : menu === 'plus');
  const hostEmojiOn = $derived(!!onEmoji && emojiActive);
  const emojiOn = $derived(onEmoji ? emojiActive : menu === 'picker');
  const showPlus = $derived(!editing && ((!!onAttach && attachKinds?.length !== 0) || !!onPlus || demo !== 'interactive'));

  function togglePlus() {
    if (onPlus) {
      menu = null;
      onPlus();
    } else menu = menu === 'plus' ? null : 'plus';
  }

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

  const plusItems: MenuItem[] = $derived(
    (
      [
        ['media', 'ui.messageComposer.photoOrVideo', 'image'],
        ['file', 'ui.messageComposer.file', 'file'],
        ['poll', 'ui.messageComposer.poll', 'poll'],
        ['prize', 'ui.messageComposer.prizeMessage', 'trophy'],
        ['crypto', 'ui.messageComposer.sendCrypto', 'wallet-send'],
        ['swap', 'ui.messageComposer.swapCrypto', 'swap'],
        ['memeFighter', 'ui.messageComposer.memeFighter', 'joystick'],
      ] as const
    )
      .filter(([kind]) => !attachKinds || attachKinds.includes(kind))
      .map(([kind, label, icon]) => ({ label: t(label), mask: `var(--icon-${icon}) center/contain no-repeat`, onSelect: () => attach(kind) })),
  );

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

  // an edit at the selection (the end of the draft without a field): the caret moves with it; `focus` takes focus too
  async function editDraft(edit: (text: string, start: number, end: number) => TextEdit, focus: boolean) {
    const el = input;
    const next = edit(draft, el ? el.selectionStart : draft.length, el ? el.selectionEnd : draft.length);
    draft = next.text;
    await tick();
    if (el) {
      if (focus) el.focus();
      el.selectionStart = el.selectionEnd = next.caret;
    }
    grow();
  }

  // the composer's own emoji picker: at the caret, focusing the field
  function insert(text: string) {
    void editDraft((d, a, b) => insertAt(d, a, b, text), true);
  }

  // the host's typing (its emoji panel): at the caret, without focusing the field (focus would raise the keyboard)
  let lastInsert = untrack(() => hostInsert?.key);
  $effect(() => {
    const next = hostInsert;
    if (!next || next.key === lastInsert) return;
    lastInsert = next.key;
    // "\b" deletes the selection, or the whole character (an emoji with its skin tone, a flag) before the caret
    untrack(() => void editDraft(next.text === '\b' ? deleteBackward : (d, a, b) => insertAt(d, a, b, next.text), false));
  });

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
    capped = false;
    const recorder = new MediaRecorder(stream, voiceMimeType && MediaRecorder.isTypeSupported(voiceMimeType) ? { mimeType: voiceMimeType } : undefined);
    const chunks: Blob[] = [];
    let bytes = 0;
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      bytes += e.data.size;
      // at the host's limit the take stops for review, and says why
      if (voiceMaxBytes && bytes >= voiceMaxBytes && take?.recorder === recorder && voice === 'recording') {
        capped = true;
        void stopRecording();
      }
    };
    // live levels from the microphone for the waveform
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const started = performance.now();
    take = { recorder, stream, ctx, chunks, started };
    // with a limit, the audio comes in slices (as the app's old recorder took it) so it's counted as it grows
    if (voiceMaxBytes) recorder.start(200);
    else recorder.start();
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
    capped = false;
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
    if (onEmoji) {
      menu = null;
      onEmoji();
      return;
    }
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
  // mounted mid-edit, the host's draft (`text`) is what was being written before the edit
  let savedDraft: string | null = untrack(() => (context?.mode === 'edit' ? text : null));
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
    // a dialog that opened first (say from a link) keeps the focus
    if (autofocus && !document.querySelector('[aria-modal="true"]')) input?.focus({ preventScroll: true });
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

<div
  class="composer"
  bind:this={root}
  onkeydown={rootKey}
  onfocusin={(e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') onInputFocus?.();
  }}
  role="group"
>
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

  {#snippet plusTool()}
    <span
      class="tool"
      class:open={plusOn}
      onclick={togglePlus}
      role="button"
      tabindex="0"
      aria-label={t('ui.messageComposer.addToMessage')}
      aria-expanded={plusOn}
      aria-haspopup="menu"
      title={t('ui.messageComposer.addToMessageHint')}><span class="tool-icon plus"></span></span
    >
  {/snippet}
  {#snippet emojiTool()}
    <span
      class="tool"
      class:open={emojiOn && !onEmoji}
      class:active={emojiOn}
      onclick={togglePicker}
      role="button"
      tabindex="0"
      aria-label={t(hostEmojiOn ? 'ui.messageComposer.showKeyboard' : 'ui.messageComposer.emojiAndGifs')}
      aria-expanded={emojiOn}
      aria-haspopup="dialog"
      title={t(hostEmojiOn ? 'ui.messageComposer.showKeyboard' : 'ui.messageComposer.emojiAndGifs')}
      ><span class="tool-icon" style:mask="var(--icon-{hostEmojiOn ? 'keyboard' : 'emoji'}) center/contain no-repeat"></span></span
    >
  {/snippet}

  <div class="bar" class:focused={(focused || !!menu) && !editing} class:recording={voice === 'recording'}>
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
        {#if onAddMedia && att.items.length < 10}
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
      {#if (showPlus && plusPlacement === 'start') || emojiPlacement === 'start'}
        <div class="tools">
          <!-- the + menu only offers attachments a host takes -->
          {#if showPlus && plusPlacement === 'start'}{@render plusTool()}{/if}
          {#if emojiPlacement === 'start'}{@render emojiTool()}{/if}
        </div>
      {/if}
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
      {#if emojiPlacement === 'end'}{@render emojiTool()}{/if}
      {#if showPlus && plusPlacement === 'end'}{@render plusTool()}{/if}
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
  {:else if voice === 'review' && capped}
    <span class="rec-hint" role="status">{t('ui.messageComposer.voiceCapped')}</span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

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
    @include icon(search, 15px, var(--ink-4));
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

    &.on {
      background: var(--ink);
      color: var(--surface-1);
    }
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

    &:hover {
      filter: brightness(1.12);
    }
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
    row-gap: var(--space-6);
    min-height: var(--composer-min-h, 52px);
    box-sizing: border-box;
    padding: var(--composer-pad, var(--space-8));
    border-radius: var(--composer-radius, var(--radius-xl));
    background: var(--field);
    /* the ring is drawn outside, so the reply / edit card and the send button never sit on it */
    box-shadow: 0 0 0 1px var(--line-2);
    transition: box-shadow var(--duration-fast);

    &.recording {
      box-shadow: 0 0 0 1px var(--status-danger-line);
    }

    &.focused {
      box-shadow: 0 0 0 1px var(--line-3);
    }
  }

  .tray {
    flex: 1 0 100%;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    padding: 6px 6px 0;
  }

  .thumb {
    position: relative;
    flex: none;
    width: 72px;
    height: 72px;
    border-radius: max(8px, calc(var(--composer-radius, var(--radius-xl)) - var(--composer-pad, var(--space-8)) - 10px));
    overflow: hidden;

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
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
    @include icon(play, 8px, #fff, $flex: null);
  }

  .thumb-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    @include flex-center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    cursor: pointer;
  }

  .thumb-remove-icon {
    @include icon(close, 10px, #fff, $flex: null);
  }

  .tray-add {
    flex: none;
    width: 72px;
    height: 72px;
    @include flex-center;
    border-radius: max(8px, calc(var(--composer-radius, var(--radius-xl)) - var(--composer-pad, var(--space-8)) - 10px));
    box-shadow: inset 0 0 0 1.5px var(--line-2);
    cursor: pointer;

    &:hover {
      background: var(--overlay-1);
    }
  }

  .tray-add-icon {
    @include icon(plus, 20px, var(--ink-3), $flex: null);
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
    /* concentric with the bar */
    border-radius: max(10px, calc(var(--composer-radius, var(--radius-xl)) - var(--composer-pad, var(--space-8))));
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
    @include flex-center;

    &.editing {
      background: var(--overlay-2);
    }
  }

  .context-glyph {
    width: 15px;
    height: 15px;
    background: var(--accent-bright);

    .editing & {
      background: var(--ink-2);
    }
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

    &.editing {
      color: var(--ink-2);
    }
  }

  /* the quoted message wraps up to three lines, then ends in an ellipsis (same as the bubble's reply quote) */
  .context-quote {
    font: 400 13px/1.3 var(--font-sans);
    color: var(--ink-3);
    @include line-clamp(2);
    overflow-wrap: anywhere;
  }

  .round-close {
    width: 32px;
    height: 32px;
    flex: none;
    @include flex-center;
    border-radius: 50%;
    cursor: pointer;

    &:hover {
      background: var(--overlay-2);
    }
  }

  .close-icon {
    @include icon(close, 13px, var(--ink-2), $flex: null);
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
    @include flex-center;
    border-radius: 50%;
  }

  .file-icon {
    @include icon(file, 15px, #fff, $flex: null);
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
    @include truncate;
  }

  .chip-edit {
    flex: none;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font: var(--weight-semibold) 13px/1 var(--font-sans);
    color: var(--accent-bright);
    cursor: pointer;

    &:hover {
      background: var(--overlay-1);
    }
  }

  .tools {
    flex: none;
    display: flex;
    gap: var(--space-2);
  }

  .tool {
    @include flex-center;
    width: var(--composer-btn, 36px);
    height: var(--composer-btn, 36px);
    border-radius: var(--composer-btn-radius, var(--radius-md));
    background: transparent;
    cursor: pointer;

    &:hover,
    &.open {
      background: var(--overlay-2);
    }
  }

  .tool-icon {
    width: 18px;
    height: 18px;
    background: var(--ink-3);

    .open &,
    .active & {
      background: var(--ink);
    }

    &.plus {
      mask: var(--icon-plus) center/contain no-repeat;
      transition: transform var(--duration-base);

      .open & {
        transform: rotate(45deg);
      }
    }
  }

  .input-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    min-height: var(--composer-btn, 36px);
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
    @include flex-center;
    width: var(--composer-btn, 36px);
    height: var(--composer-btn, 36px);
    border-radius: var(--composer-btn-radius, var(--radius-md));
    cursor: pointer;

    &.send {
      background: var(--accent);

      &:hover {
        filter: brightness(1.08);
      }
    }

    &.mic,
    &.stop {
      background: var(--overlay-1);

      &:hover {
        background: var(--btn-hover);
      }
    }

    &.delete:hover {
      background: var(--status-danger-soft);
    }
  }

  .send-icon {
    width: 17px;
    height: 17px;
    background: var(--on-accent);
  }

  .mic-icon {
    @include icon(mic, 18px, var(--ink-2), $flex: null);
  }

  .delete-icon {
    @include icon(trash, 18px, var(--status-danger), $flex: null);
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
    @include focus-ring;
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
    @include flex-center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--overlay-2);
    cursor: pointer;

    &:hover {
      background: var(--btn-hover);
    }
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

    &.recording {
      color: var(--status-danger);
    }
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

    &.seekable {
      cursor: pointer;
    }

    &:focus-visible {
      box-shadow: var(--focus-ring);
    }
  }

  .wave-bar {
    flex: none;
    width: 3px;
    border-radius: 2px;
    background: var(--ink-2);
    transition: height 0.12s;
    pointer-events: none;

    &.idle {
      background: var(--overlay-3);
    }

    &.review {
      background: var(--ink-4);

      &.played {
        background: var(--accent-bright);
      }
    }
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

    &.seeking {
      transform: scale(1.25);
    }
  }

  .rec-hint {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    text-align: center;
    font: var(--weight-regular) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-4);

    &.failure {
      color: var(--status-danger);
    }
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
