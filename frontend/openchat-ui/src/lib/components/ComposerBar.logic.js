// Logic for ComposerBar.svelte — carried over from lib/ComposerBar.dc.html. renderVals() feeds the markup.
import { DCLogic, React } from '../dc/logic.js';

class Component extends DCLogic {
  renderVals() {
    const names = this.props.typingNames ?? ["Danielle", "Priya"];
    const bannerText = this.props.bannerText ?? "";
    const att = this.props.attachment || null;
    return {
      attachment: att, hasAttachment: !!att, attachmentNote: att ? "Fee " + att.feeText + " added · " + att.totalText + " total" : "",
      onEditAttachment: this.props.onEditAttachment, onRemoveAttachment: this.props.onRemoveAttachment, onAddMedia: this.props.onAddMedia, onRemoveMediaItem: this.props.onRemoveMediaItem,
      placeholder: this.props.placeholder ?? "Message Danielle…",
      value: this.props.value ?? "",
      typingNames: names,
      isTyping: names.length > 0,
      ringColor: this.props.ringColor ?? "var(--surface-1,#0e0e12)",
      bannerText,
      hasBanner: !!bannerText,
      bannerTone: this.props.bannerTone ?? "offline",
      bannerAction: this.props.bannerAction ?? "",
      context: this.props.context || null, onCancelContext: this.props.onCancelContext, onSubmitEdit: this.props.onSubmitEdit, onJumpContext: this.props.onJumpContext,
      onSend: this.props.onSend, onAttach: this.props.onAttach, onGif: this.props.onGif, onVoice: this.props.onVoice,
    };
  }
}

export default Component;
