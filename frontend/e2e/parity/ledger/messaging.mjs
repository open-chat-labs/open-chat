// Messaging basics (#10550 phase 3): what the old trees let a user do with ordinary messages in an
// open chat, and where the new trees show it. Threads, pins, search, polls, money, calls and bots
// have ledgers of their own. Legacy refs are under frontend/app/src.

const SEND = "a direct message reaches the person it was sent to";
const EDIT = "an edited message reaches the other person, marked as edited";
const DELETE = "a deleted message is gone for the other person";
const REPLY = "a reply reaches the other person quoting the message it replies to";
const REACT = "a reaction reaches the other person, and so does taking it back";
const MARKDOWN = "markdown in a message reaches the other person formatted";
const FORWARD = "a forwarded message reaches the chat it was forwarded to, marked as forwarded";
const MENTION = "someone mentioned in a group sees the mention by their name";
const PHOTO = "a photo reaches the other person with its caption";

const both = (entry) => ({ desktop: entry, mobile: entry });

export const rows = [
    {
        id: "msg-send",
        capability: "Send a text message",
        legacy: [
            "components/home/MessageEntry.svelte:279",
            "components_mobile/home/MessageEntry.svelte:509",
        ],
        ...both(SEND),
    },
    {
        id: "msg-edit",
        capability: "Edit your own message, marked as edited for everyone",
        legacy: [
            "components/home/ChatMessageMenu.svelte:522",
            "components_mobile/home/ChatMessageOptions.svelte:619",
        ],
        ...both(EDIT),
    },
    {
        id: "msg-delete",
        capability: "Delete your own message, gone for everyone",
        legacy: [
            "components/home/ChatMessageMenu.svelte:553",
            "components_mobile/home/ChatMessageOptions.svelte:708",
        ],
        ...both(DELETE),
    },
    {
        id: "msg-delete-others",
        capability: "Delete someone else's message with the delete-messages permission",
        legacy: [
            "components/home/ChatMessageMenu.svelte:553",
            "components_mobile/home/ChatMessageOptions.svelte:708",
        ],
        ...both({ untested: "the roles and permissions area" }),
    },
    {
        id: "msg-reveal",
        capability: "Reveal a deleted message (your own for 5 minutes) or blocked content",
        legacy: [
            "components/home/ChatMessageMenu.svelte:581",
            "components_mobile/home/ChatMessageOptions.svelte:720",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-undelete",
        capability: "Undelete a revealed deleted message",
        legacy: [
            "components/home/ChatMessageMenu.svelte:593",
            "components_mobile/home/ChatMessageOptions.svelte:725",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-reply",
        capability: "Quote-reply to a message",
        legacy: [
            "components/home/ChatMessageMenu.svelte:449",
            "components_mobile/home/ChatMessageOptions.svelte:624",
        ],
        ...both(REPLY),
    },
    {
        id: "msg-reply-private",
        capability: "Reply privately to a group message, in a DM with its sender",
        legacy: [
            "components/home/ChatMessageMenu.svelte:485",
            "components_mobile/home/ChatMessageOptions.svelte:681",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-dblclick",
        capability: "Double-click a message: edit your own, reply to someone else's",
        legacy: ["components/home/ChatMessage.svelte:295"],
        desktop: { untested: "not yet" },
        mobile: {
            missing: "no double-click on a phone; v2 had none either (difference to decide)",
        },
    },
    {
        id: "msg-react",
        capability: "React to a message, and take the reaction back",
        legacy: [
            "components/home/ChatMessageMenu.svelte:284",
            "components_mobile/home/ChatMessageMenu.svelte:48",
        ],
        ...both(REACT),
    },
    {
        id: "msg-react-picker",
        capability: "Pick any emoji to react with",
        legacy: [
            "components/home/ChatMessage.svelte:514",
            "components_mobile/home/ChatMessage.svelte:556",
        ],
        ...both({ untested: "not yet (desktop's picker is about 56 fixed emoji, GAPS.md)" }),
    },
    {
        id: "msg-forward",
        capability: "Forward a message to another chat, marked as forwarded",
        legacy: [
            "components/home/ChatMessageMenu.svelte:475",
            "components_mobile/home/ChatMessageOptions.svelte:632",
        ],
        ...both(FORWARD),
    },
    {
        id: "msg-copy",
        capability: "Copy a message's text",
        legacy: [
            "components/home/ChatMessageMenu.svelte:390",
            "components_mobile/home/ChatMessageOptions.svelte:637",
        ],
        ...both({ untested: "not yet (needs clipboard permission)" }),
    },
    {
        id: "msg-copy-link",
        capability: "Copy a message's link",
        legacy: [
            "components/home/ChatMessageMenu.svelte:378",
            "components_mobile/home/ChatMessageOptions.svelte:642",
        ],
        ...both({ untested: "not yet (needs clipboard permission)" }),
    },
    {
        id: "msg-share",
        capability: "Share a public group's message through the device",
        legacy: [
            "components/home/ChatMessageMenu.svelte:368",
            "components_mobile/home/ChatMessageOptions.svelte:647",
        ],
        ...both({ untested: "the browser has no share sheet to drive" }),
    },
    {
        id: "msg-translate",
        capability: "Translate someone else's message (Diamond)",
        legacy: [
            "components/home/ChatMessageMenu.svelte:497",
            "components_mobile/home/ChatMessageOptions.svelte:686",
        ],
        ...both({ untested: "the Diamond area" }),
    },
    {
        id: "msg-auto-translate",
        capability: "Auto-translate banner for a chat in another language",
        legacy: ["components/home/CurrentChat.svelte:463"],
        ...both({ missing: "no auto-translate banner (v2 had none either)" }),
    },
    {
        id: "msg-retry",
        capability: "Retry a message that failed to send",
        legacy: [
            "components/home/ChatMessageMenu.svelte:605",
            "components_mobile/home/ChatMessageOptions.svelte:703",
        ],
        ...both({ untested: "not yet (needs a send made to fail)" }),
    },
    {
        id: "msg-mention",
        capability: "Mention a member (@user), shown by name to everyone",
        legacy: [
            "components/home/MessageEntry.svelte:513",
            "components_mobile/home/MessageEntry.svelte:834",
        ],
        ...both(MENTION),
    },
    {
        id: "msg-mention-groups",
        capability: "Mention a user group or @everyone",
        legacy: [
            "components/home/MessageEntry.svelte:513",
            "components_mobile/home/MessageEntry.svelte:834",
        ],
        ...both({ untested: "the communities area (user groups) and roles (@everyone)" }),
    },
    {
        id: "msg-markdown",
        capability: "Markdown in a message shows formatted",
        legacy: ["components/home/MessageEntry.svelte:215"],
        ...both(MARKDOWN),
    },
    {
        id: "msg-rich-composer",
        capability: "Formatting shown live while writing (rich-text composer)",
        legacy: ["core/richText/RichTextEditor.svelte"],
        ...both({ untested: "built (#10576); no spec yet" }),
    },
    {
        id: "msg-emoji-insert",
        capability: "Insert an emoji from the composer's picker",
        legacy: [
            "components/home/MessageActions.svelte:190",
            "components_mobile/home/EmojiOrGif.svelte:81",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-emoji-autocomplete",
        capability: "Emoji autocomplete while typing (:smile)",
        legacy: [
            "components/home/MessageEntry.svelte:521",
            "components_mobile/home/MessageEntry.svelte:841",
        ],
        ...both({ missing: "not built (GAPS.md)" }),
    },
    {
        id: "msg-gif",
        capability: "Send a GIF",
        legacy: [
            "components/home/MessageActions.svelte:243",
            "components_mobile/home/EmojiOrGif.svelte:88",
        ],
        ...both({ untested: "needs a Klipy key locally" }),
    },
    {
        id: "msg-attach",
        capability: "Attach a photo, video or file through the picker",
        legacy: [
            "components/home/FileAttacher.svelte",
            "components_mobile/home/CustomMessageTrigger.svelte:178",
        ],
        ...both(PHOTO),
    },
    {
        id: "msg-attach-limits",
        capability: "Attachment size limits (larger with Diamond)",
        legacy: ["../../openchat-client/src/utils/media.ts:18"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-attach-paste",
        capability: "Paste a file into the composer",
        legacy: ["components/home/Footer.svelte:140", "components_mobile/home/Footer.svelte:123"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-attach-drop",
        capability: "Drop a file on the conversation",
        legacy: ["components/home/DropTarget.svelte"],
        desktop: { untested: "not yet" },
        mobile: { missing: "no drop on a phone; v2 had none either (difference to decide)" },
    },
    {
        id: "msg-voice",
        capability: "Record and send a voice message",
        legacy: [
            "components/home/AudioAttacher.svelte",
            "components_mobile/home/MessageEntry.svelte:905",
        ],
        ...both({ untested: "needs a fake microphone" }),
    },
    {
        id: "msg-link-preview",
        capability: "Link previews, which the sender can remove",
        legacy: [
            "components/home/TextContent.svelte:53",
            "components_mobile/home/TextContent.svelte:57",
        ],
        ...both({ untested: "needs a page to preview locally" }),
    },
    {
        id: "msg-draft",
        capability: "An unsent draft is kept per chat while moving between chats",
        legacy: ["components/home/MessageEntry.svelte:212"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-receipts",
        capability: "Sent and read ticks on your messages",
        legacy: [
            "components/home/TimeAndTicks.svelte:78",
            "components_mobile/home/message/MessageMetadata.svelte:50",
        ],
        desktop: { untested: "not yet (no tick on voice or file messages, GAPS.md)" },
        mobile: { untested: "not yet" },
    },
    {
        id: "msg-expand-deleted",
        capability: "Expand a run of deleted messages",
        legacy: ["components/home/AggregateCommonEvents.svelte"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "msg-download",
        capability: "Download a message's media from its menu",
        legacy: ["components_mobile/home/ChatMessageOptions.svelte:660"],
        desktop: { missing: "files download from their card; no menu item for media" },
        mobile: { missing: "files download; no menu item for media" },
    },
    {
        id: "msg-throttle",
        capability: "Sending is limited to 10 messages a minute (20 with Diamond)",
        legacy: ["web/GAPS.md:480"],
        ...both({ untested: "not yet" }),
    },
];
