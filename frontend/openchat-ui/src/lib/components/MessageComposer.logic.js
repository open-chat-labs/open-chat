// Logic for MessageComposer.svelte — carried over from lib/MessageComposer.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

// Message composer: + menu (file, poll, prize, crypto, Meme Fighter), emoji/GIF picker, auto-growing text,
// mic ↔ send swap, and a voice flow: recording (live waveform + timer) → review (play back) → send or delete.
// `demo` forces a state for docs/screenshots; otherwise fully interactive.
const EMOJI = [
  { label: "FREQUENTLY USED", items: [["😂","joy"],["❤️","heart"],["👍","thumbs up"],["🔥","fire"],["🙏","pray"],["😍","heart eyes"],["🎉","party"],["😅","sweat smile"]] },
  { label: "SMILEYS", items: [["😀","grin"],["😃","smiley"],["😄","smile"],["😁","beaming"],["😆","laughing"],["🥹","holding back tears"],["😊","blush"],["😇","innocent"],["🙂","slight smile"],["😉","wink"],["😌","relieved"],["😋","yum"],["😎","cool"],["🤩","star struck"],["🥳","partying"],["😏","smirk"],["😮","open mouth"],["😢","cry"],["😭","sob"],["😤","triumph"],["😡","rage"],["🤯","mind blown"],["🫡","salute"],["🤔","thinking"]] },
  { label: "PEOPLE", items: [["👋","wave"],["👏","clap"],["🙌","raised hands"],["🤝","handshake"],["💪","muscle"],["👀","eyes"],["✌️","victory"],["🤞","fingers crossed"]] },
  { label: "OBJECTS", items: [["🚀","rocket"],["💎","gem"],["🪙","coin"],["📈","chart up"],["🏆","trophy"],["🎁","gift"],["💡","idea"],["✅","check"]] },
];
const GIF_CATS = ["Trending", "Reactions", "Celebrate", "Crypto", "Thanks"];
const GIF_TONES = ["linear-gradient(150deg,#5CB8FF,#2F6BFF)", "linear-gradient(150deg,#FF8FA8,#E0456A)", "linear-gradient(150deg,#FFC061,#F58A2E)", "linear-gradient(150deg,#2EE6A8,#1FA6B8)", "linear-gradient(150deg,#E27BFF,#9B3FD9)", "linear-gradient(150deg,#8B7BFF,#5B3FD9)"];
const GIF_WORDS = { Trending: ["mic drop", "let's go", "this is fine", "no way", "mood", "facepalm", "slow clap", "hype"], Reactions: ["lol", "shocked", "eye roll", "nod", "shrug", "yikes"], Celebrate: ["confetti", "dance", "cheers", "woohoo", "fireworks", "trophy"], Crypto: ["to the moon", "hodl", "wagmi", "gm", "number go up", "diamond hands"], Thanks: ["thank you", "bow", "high five", "appreciate it", "hug", "legend"] };
const HEIGHTS = ["112px", "150px", "132px", "96px", "140px", "118px", "104px", "146px"];
const BARS_DEFAULT = 40;
const mmss = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const amp = () => 0.18 + Math.random() * 0.82;
class Component extends DCLogic {
  state = { draft: "", menu: null, tab: 0, query: "", gifCat: 0, voice: null, secs: 0, levels: [], playing: false, playPos: 0, focused: false };
  rootRef = React.createRef(); waveRef = React.createRef(); inputRef = React.createRef(); searchRef = React.createRef();
  componentDidMount() {
    this._down = e => { const r = this.rootRef.current; if (this.state.menu && r && !r.contains(e.target)) this.setState({ menu: null }); };
    document.addEventListener("mousedown", this._down);
    // bar count follows the available width: one 3px bar per ~5px, so spacing stays tight at any size
    const fit = () => { const r = this.rootRef.current; if (!r) return; const n = Math.max(16, Math.min(120, Math.floor((r.getBoundingClientRect().width - 170) / 5))); if (n !== this.state.bars) this.setState({ bars: n }); };
    if (typeof ResizeObserver !== "undefined") { this._ro = new ResizeObserver(fit); if (this.rootRef.current) this._ro.observe(this.rootRef.current); }
    fit();
    this._applyDemo();
  }
  componentDidUpdate(pp) {
    if (pp.demo !== this.props.demo) this._applyDemo();
    // reply/edit context: edit pre-fills the original text; both move focus into the input
    const a = pp.context || null, b = this.props.context || null;
    if ((a && a.key) !== (b && b.key)) {
      if (b && b.mode === "edit") this.setState({ draft: b.text || "", menu: null }, () => { const t = this.inputRef.current; if (t) { t.focus({ preventScroll: true }); t.selectionStart = t.selectionEnd = t.value.length; this._grow(); } });
      else if (a && a.mode === "edit" && !b) this.setState({ draft: "" }, () => this._grow());
      else if (b) { const t = this.inputRef.current; if (t) t.focus({ preventScroll: true }); }
    }
  }
  componentWillUnmount() { document.removeEventListener("mousedown", this._down); if (this._ro) this._ro.disconnect(); this._endSeek && this._endSeek(); clearInterval(this._rec); clearInterval(this._play); }
  _applyDemo() {
    const d = this.props.demo; if (!d || d === "interactive") return;
    clearInterval(this._rec); clearInterval(this._play);
    const levels = Array.from({ length: 160 }, amp);
    const base = { menu: null, voice: null, draft: "", tab: 0, playing: false, playPos: 0, focused: false };
    if (d === "typing") this.setState(Object.assign(base, { draft: "Shipping the composer today — anyone want a preview?", focused: true }));
    else if (d === "plus") this.setState(Object.assign(base, { menu: "plus" }));
    else if (d === "emoji") this.setState(Object.assign(base, { menu: "picker", tab: 0 }));
    else if (d === "gif") this.setState(Object.assign(base, { menu: "picker", tab: 1 }));
    else if (d === "recording") { this.setState(Object.assign(base, { voice: "recording", secs: 7, levels })); this._tick(); }
    else if (d === "review") this.setState(Object.assign(base, { voice: "review", secs: 12, levels, playPos: 0.35 }));
    else this.setState(base);
  }
  _tick() {
    clearInterval(this._rec);
    let n = 0;
    this._rec = setInterval(() => this.setState(s => { n++; return { levels: s.levels.concat([amp()]).slice(-200), secs: n % 8 === 0 ? s.secs + 1 : s.secs }; }), 125);
  }
  _resume() {
    const dur = Math.max(1, this.state.secs) * 1000;
    clearInterval(this._play);
    this.setState({ playing: true });
    this._play = setInterval(() => this.setState(s => { const n = s.playPos + 100 / dur; if (n >= 1) { clearInterval(this._play); return { playPos: 1, playing: false }; } return { playPos: n }; }), 100);
  }
  _grow() { const t = this.inputRef.current; if (!t) return; t.style.height = "22px"; const h = t.scrollHeight - 14; t.style.height = Math.min(h, 160) + "px"; t.style.overflowY = h > 160 ? "auto" : "hidden"; }
  _insert(txt) {
    const t = this.inputRef.current, d = this.state.draft;
    const a = t ? t.selectionStart : d.length, b = t ? t.selectionEnd : d.length;
    this.setState({ draft: d.slice(0, a) + txt + d.slice(b) }, () => { if (t) { t.focus(); t.selectionStart = t.selectionEnd = a + txt.length; this._grow(); } });
  }
  renderVals() {
    const p = this.props, st = this.state;
    const ctx = p.context || null, editing = !!ctx && ctx.mode === "edit";
    const draft = st.draft, att = editing ? null : (p.attachment || null), has = !!draft.trim() || !!att;
    const voice = st.voice;
    const close = () => this.setState({ menu: null });
    const attach = kind => () => { close(); if (p.onAttach) p.onAttach(kind); };
    const q = st.query.trim().toLowerCase();
    const groups = EMOJI.map(g => ({ label: g.label, items: g.items.filter(([c, n]) => !q || n.indexOf(q) >= 0).map(([c, n]) => ({ char: c, name: n, pick: () => this._insert(c) })) })).filter(g => g.items.length);
    const cat = GIF_CATS[st.gifCat];
    const words = q ? GIF_WORDS.Trending.concat(GIF_WORDS.Reactions).filter(w => w.indexOf(q) >= 0) : GIF_WORDS[cat];
    const send = () => {
      if (!has) return;
      if (editing) { const v = draft.trim(); if (p.onSubmitEdit) p.onSubmitEdit(v); return; }
      this.setState({ draft: "" }, () => this._grow()); if (p.onSend) p.onSend(draft.trim()); if (this.inputRef.current) this.inputRef.current.focus();
    };
    const stop = () => { clearInterval(this._rec); this.setState({ voice: "review", playPos: 0, playing: false }); };
    const reset = () => { clearInterval(this._rec); clearInterval(this._play); this.setState({ voice: null, secs: 0, levels: [], playing: false, playPos: 0 }); };
    // waveform: recording shows the latest samples scrolling in from the right; review shows the whole take, played part highlighted
    const lv = st.levels;
    const BARS = st.bars || BARS_DEFAULT;
    let bars;
    if (voice === "review") {
      const step = Math.max(1, lv.length / BARS);
      bars = Array.from({ length: BARS }, (_, i) => { const v = lv[Math.floor(i * step)] ?? 0.2; return { h: Math.round(4 + v * 22) + "px", bg: i / BARS < st.playPos ? "var(--accent-bright,#FF8298)" : "var(--ink-4,#8A8A99)" }; });
    } else {
      // always BARS slots so the waveform spans the full width; empty leading slots show a quiet baseline
      const tail = lv.slice(-BARS), pad = BARS - tail.length;
      bars = Array.from({ length: BARS }, (_, i) => i < pad ? { h: "3px", bg: "var(--overlay-3,rgba(255,255,255,.14))" } : { h: Math.round(4 + tail[i - pad] * 22) + "px", bg: "var(--ink-2,#C9C9D4)" });
    }
    const togglePlay = () => {
      if (st.playing) { clearInterval(this._play); this.setState({ playing: false }); return; }
      if (st.playPos >= 1) this.setState({ playPos: 0 }, () => this._resume()); else this._resume();
    };
    const plusOpen = st.menu === "plus", pickerOpen = st.menu === "picker";
    return {
      rootRef: this.rootRef, inputRef: this.inputRef, searchRef: this.searchRef,
      onRootKey: e => { if (e.key !== "Escape") return; if (ctx && !st.menu && !voice) { e.stopPropagation(); if (p.onCancelContext) p.onCancelContext(); return; } if (st.menu) { e.stopPropagation(); close(); if (this.inputRef.current) this.inputRef.current.focus(); } else if (voice) { e.stopPropagation(); reset(); } },
      isCompose: !voice, isVoice: !!voice, isRecording: voice === "recording", isReview: voice === "review",
      placeholder: att ? "Add a caption" : (p.placeholder ?? "Message"),
      // fee stays inside the chip so the composer keeps its height
      attRemove: att && att.type === "swap" ? "Remove swap offer" : att && att.type === "transfer" ? "Remove transfer" : att && att.type === "file" ? "Remove file" : "Remove prize",
      // media → thumbnail tray (wraps, up to 10); everything else → one chip
      hasMediaTray: !!att && att.type === "media", hasChip: !!att && att.type !== "media",
      attIsFile: !!att && att.type === "file", attHasToken: !!att && att.type !== "file" && att.type !== "media" && att.type !== "swap", attHasPair: !!att && att.type === "swap",
      attA: att && att.pair ? att.pair[0] : {}, attB: att && att.pair ? att.pair[1] : {}, attEditable: !!att && att.type !== "file",
      attTint: att && att.tint ? att.tint : "var(--overlay-2,rgba(255,255,255,.1))",
      trayItems: att && att.type === "media" ? att.items.map((m, i) => ({ bg: m.src && m.kind === "image" ? "center/cover no-repeat url(" + m.src + ")" : m.bg || "var(--surface-2,#15151b)", src: m.src || "", isVideo: m.kind === "video", hasVideo: m.kind === "video" && !!m.src, dur: m.dur || "Video",
        removeLabel: "Remove " + (m.kind === "video" ? "video " : "photo ") + (i + 1), onRemove: () => { if (p.onRemoveMediaItem) p.onRemoveMediaItem(i); } })) : [],
      trayCanAdd: !!att && att.type === "media" && att.items.length < 10,
      addMedia: () => { if (p.onAddMedia) p.onAddMedia(); },
      attLabel: att ? (att.title || att.amountText + " prize") : "",
      attMeta: att ? att.summary + (att.feeText && att.type !== "swap" ? " · +" + att.feeText + " fee" : "") : "",
      attTitle: att && att.hint ? att.hint : att && att.totalText ? att.summary + " · " + att.totalText + " total incl. fees" : "",
      hasAttachment: !!att, att: att || { token: {}, amountText: "", summary: "" },
      editAttachment: () => { if (p.onEditAttachment) p.onEditAttachment(); },
      removeAttachment: () => { if (p.onRemoveAttachment) p.onRemoveAttachment(); },
      draft, onDraft: e => { this.setState({ draft: e.target.value }); this._grow(); },
      onKey: e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
      onFocus: () => this.setState({ focused: true }), onBlur: () => this.setState({ focused: false }),
      barRing: editing ? "inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 55%,transparent)" : st.focused || st.menu ? "inset 0 0 0 1px var(--line-3,rgba(255,255,255,.22))" : voice === "recording" ? "inset 0 0 0 1px var(--status-danger-line,rgba(255,77,77,.4))" : "inset 0 0 0 1px var(--line-2,rgba(255,255,255,.08))",
      showMic: !has && !editing, showSend: has || editing, send,
      showPlus: !voice && !editing,
      sendMask: (editing ? "var(--icon-check)" : "var(--icon-send)") + " center/contain no-repeat", sendLabel: editing ? "Save edit" : "Send message", sendTitle: editing ? "Save (Enter)" : "Send (Enter)",
      hasCtx: !!ctx && !voice,
      ctxLabel: ctx ? (editing ? "Editing message" : "Replying to " + (ctx.name || "message")) : "",
      ctxQuote: ctx ? ctx.quote || "" : "",
      ctxCancel: editing ? "Cancel edit" : "Cancel reply",
      ctxHasThumb: !!(ctx && ctx.thumb), ctxNoThumb: !(ctx && ctx.thumb), ctxThumb: ctx && ctx.thumb ? ctx.thumb : "none",
      ctxIconBg: editing ? "var(--overlay-2,rgba(255,255,255,.08))" : "color-mix(in oklch,var(--accent,#FF5672) 18%,transparent)",
      ctxInk: editing ? "var(--ink-2,#C9C9D4)" : "var(--accent-bright,#FF8298)",
      ctxMask: (editing ? "var(--icon-edit)" : "var(--icon-reply)") + " center/contain no-repeat",
      cancelCtx: () => p.onCancelContext && p.onCancelContext(),
      jumpCtx: () => p.onJumpContext && p.onJumpContext(),
      plusOpen, plusExpanded: String(plusOpen), plusBg: plusOpen ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent", plusInk: plusOpen ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)", plusRotate: plusOpen ? "rotate(45deg)" : "none",
      togglePlus: () => this.setState({ menu: plusOpen ? null : "plus" }),
      plusItems: [
        { label: "Photo or video", icon: "image", mask: "var(--icon-image) center/contain no-repeat", onSelect: attach("media") },
        { label: "File", icon: "file", mask: "var(--icon-file) center/contain no-repeat", onSelect: attach("file") },
        { label: "Poll", icon: "poll", mask: "var(--icon-poll) center/contain no-repeat", onSelect: attach("poll") },
        { label: "Prize message", icon: "trophy", mask: "var(--icon-trophy) center/contain no-repeat", onSelect: attach("prize") },
        { label: "Send crypto", icon: "wallet-send", mask: "var(--icon-wallet-send) center/contain no-repeat", onSelect: attach("crypto") },
        { label: "Swap crypto", icon: "swap", mask: "var(--icon-swap) center/contain no-repeat", onSelect: attach("swap") },
        { label: "Meme Fighter", icon: "joystick", mask: "var(--icon-joystick) center/contain no-repeat", onSelect: attach("memeFighter") },
      ],
      pickerOpen, pickerExpanded: String(pickerOpen), pickerLabel: st.tab ? "GIFs" : "Emoji",
      emojiBg: pickerOpen ? "var(--overlay-2,rgba(255,255,255,.08))" : "transparent", emojiInk: pickerOpen ? "var(--ink,#ECECF1)" : "var(--ink-3,#9A9AA8)",
      togglePicker: () => this.setState({ menu: pickerOpen ? null : "picker", query: "" }, () => { if (!pickerOpen && this.searchRef.current && !p.demo) this.searchRef.current.focus({ preventScroll: true }); }),
      pickerTabs: ["Emoji", "GIF"], pickerIndex: st.tab, onPickerTab: i => this.setState({ tab: i, query: "" }),
      isEmojiTab: st.tab === 0, isGifTab: st.tab === 1,
      query: st.query, onQuery: e => this.setState({ query: e.target.value }),
      searchPlaceholder: st.tab ? "Search GIFs" : "Search emoji",
      emojiGroups: groups, noEmoji: !groups.length,
      pickEmoji: c => this._insert(c), closePicker: () => this.setState({ menu: null }), pickerAutoFocus: !p.demo,
      gifCats: GIF_CATS.map((c, i) => ({ label: c, pressed: String(!q && i === st.gifCat), bg: !q && i === st.gifCat ? "var(--ink,#ECECF1)" : "var(--overlay-2,rgba(255,255,255,.08))", ink: !q && i === st.gifCat ? "var(--surface-1,#0e0e12)" : "var(--ink-2,#C9C9D4)", pick: () => this.setState({ gifCat: i, query: "" }) })),
      gifs: words.map((w, i) => ({ label: w, h: HEIGHTS[i % HEIGHTS.length], bg: GIF_TONES[(i + st.gifCat) % GIF_TONES.length], pick: () => { close(); if (p.onGif) p.onGif(w); } })),
      startRec: () => { this.setState({ voice: "recording", secs: 0, levels: [], menu: null }); this._tick(); },
      stopRec: stop, cancelRec: reset,
      sendVoice: () => { const secs = st.secs; reset(); if (p.onVoice) p.onVoice({ duration: secs }); },
      togglePlay,
      playLabel: st.playing ? "Pause" : "Play recording",
      playMask: st.playing ? "var(--icon-stop) center/contain no-repeat" : "var(--icon-play) center/contain no-repeat",
      timeLabel: voice === "review" ? mmss(st.secs * Math.min(1, st.playPos)) + " / " + mmss(st.secs) : mmss(st.secs),
      timeInk: voice === "recording" ? "var(--status-danger,#FF4D4D)" : "var(--ink-2,#C9C9D4)",
      bars,
      // review waveform doubles as a seek slider: click/drag anywhere, arrows step 1s, Home/End jump
      waveRef: this.waveRef, waveRole: voice === "review" ? "slider" : undefined, waveTab: voice === "review" ? "0" : undefined,
      waveLabel: voice === "review" ? "Seek" : undefined, waveMin: voice === "review" ? "0" : undefined, waveMax: voice === "review" ? String(st.secs) : undefined,
      waveNow: voice === "review" ? String(Math.round(st.secs * st.playPos)) : undefined, waveText: voice === "review" ? mmss(st.secs * st.playPos) + " of " + mmss(st.secs) : undefined,
      waveHidden: voice === "review" ? undefined : "true", waveCursor: voice === "review" ? "pointer" : "default",
      handleLeft: (Math.min(1, st.playPos) * 100) + "%", handleScale: st.seeking ? "1.25" : "1",
      onSeekStart: e => {
        if (voice !== "review") return;
        const el = this.waveRef.current; if (!el) return;
        e.preventDefault();
        const at = x => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); };
        const wasPlaying = st.playing; clearInterval(this._play);
        this.setState({ playPos: at(e.clientX), seeking: true, playing: false });
        el.focus({ preventScroll: true });
        const move = ev => this.setState({ playPos: at(ev.clientX) });
        const up = () => { this._endSeek(); this.setState({ seeking: false }); if (wasPlaying) this._resume(); };
        this._endSeek = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); this._endSeek = null; };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      },
      onSeekKey: e => {
        if (voice !== "review") return;
        const step = 1 / Math.max(1, st.secs);
        const k = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
        if (k != null) { e.preventDefault(); this.setState({ playPos: Math.max(0, Math.min(1, st.playPos + k)) }); }
        else if (e.key === "Home") { e.preventDefault(); this.setState({ playPos: 0 }); }
        else if (e.key === "End") { e.preventDefault(); this.setState({ playPos: 1 }); }
        else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      },
    };
  }
}

export default Component;
