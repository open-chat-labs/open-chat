// Pins (#10550 phase 3): pinned messages in a group or channel (the backend has none in a DM), as
// the old trees offer them, and where the new trees show them. Pinning a chat in the list is in
// groups.mjs (group-pin). Legacy refs are under frontend/app/src.

const PIN = "a pinned message is in the other person's pinned messages, until it's unpinned";

const both = (entry) => ({ desktop: entry, mobile: entry });

export const rows = [
    {
        id: "pin-message",
        capability: "Pin a message, shown pinned to everyone in the chat",
        legacy: [
            "components/home/ChatMessageMenu.svelte:438",
            "components_mobile/home/ChatMessageOptions.svelte:677",
        ],
        ...both(PIN),
    },
    {
        id: "pin-unpin",
        capability: "Unpin a message from its menu",
        legacy: [
            "components/home/ChatMessageMenu.svelte:427",
            "components_mobile/home/ChatMessageOptions.svelte:675",
        ],
        ...both(PIN),
    },
    {
        id: "pin-list",
        capability: "Open the chat's pinned messages",
        legacy: [
            "components/home/CurrentChatMenu.svelte:338",
            "components/home/RightPanel.svelte:299",
            "components_mobile/home/CurrentChatMenu.svelte:178",
            "components_mobile/home/SlidingModals.svelte:867",
        ],
        desktop: PIN,
        mobile: PIN,
    },
    {
        id: "pin-jump",
        capability: "Go to a pinned message in the chat from the list",
        legacy: [
            "components/home/pinned/PinnedMessage.svelte:115",
            "components_mobile/home/pinned/PinnedMessage.svelte:92",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "pin-list-unpin",
        capability: "Unpin a message from the pinned list",
        legacy: [
            "components/home/pinned/PinnedMessage.svelte:172",
            "components_mobile/home/pinned/PinnedMessage.svelte:147",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "pin-unread",
        capability: "New pins marked on the header's pin icon until they're seen",
        legacy: ["components/home/CurrentChatMenu.svelte:341"],
        desktop: { missing: "the header's pin icon has no new-pins dot (GAPS.md, group panel)" },
        mobile: { missing: "no new-pins mark; v2 had none either (difference to decide)" },
    },
    {
        id: "pin-permission",
        capability: "Pin is offered only to roles with the pin-messages permission",
        legacy: [
            "components/home/CurrentChat.svelte:365",
            "components_mobile/home/CurrentChat.svelte:311",
        ],
        ...both({ untested: "the roles and permissions area" }),
    },
];
