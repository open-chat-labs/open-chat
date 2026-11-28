// Threads (#10550 phase 3): what the old trees let a user do with a message's thread, and with the
// threads they follow, and where the new trees show it. Legacy refs are under frontend/app/src.

const THREAD = "a reply in a thread reaches the message's author, counted on its replies link";

const both = (entry) => ({ desktop: entry, mobile: entry });

export const rows = [
    {
        id: "thread-start",
        capability: "Start a thread on a message (Reply in thread)",
        legacy: [
            "components/home/ChatMessageMenu.svelte:300",
            "components_mobile/home/ChatMessageOptions.svelte:628",
        ],
        ...both(THREAD),
    },
    {
        id: "thread-reply",
        capability: "Reply in a thread, reaching the chat's other members",
        legacy: [
            "components/home/thread/Thread.svelte:440",
            "components_mobile/home/thread/Thread.svelte:396",
        ],
        ...both(THREAD),
    },
    {
        id: "thread-open",
        capability: "Open a message's thread from its replies link (count, faces, last reply)",
        legacy: [
            "components/home/ChatMessage.svelte:849",
            "components_mobile/home/ChatMessage.svelte:794",
        ],
        ...both(THREAD),
    },
    {
        id: "thread-new-replies",
        capability: "New replies counted on a followed thread's replies link",
        legacy: ["components_mobile/home/message/ThreadSummary.svelte:39"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "thread-follow",
        capability: "Follow and unfollow a thread from a message's menu",
        legacy: [
            "components/home/ChatMessageMenu.svelte:344",
            "components_mobile/home/ChatMessageOptions.svelte:653",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "thread-link",
        capability: "A link to a thread, or to a reply in one, opens the thread",
        legacy: ["components/Router.svelte:282", "components_mobile/Router.svelte:319"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "thread-list",
        capability: "List the threads followed in a community's channels, and open one",
        legacy: [
            "components/home/ChatList.svelte:215",
            "components_mobile/home/ChatList.svelte:139",
        ],
        desktop: { untested: "not yet" },
        mobile: { untested: "not yet (the community page's Threads row)" },
    },
    {
        id: "thread-list-chats",
        capability: "List the threads followed in groups and direct chats, and open one",
        legacy: [
            "components/home/ChatList.svelte:215",
            "components_mobile/home/ChatList.svelte:139",
        ],
        desktop: { untested: "not yet" },
        mobile: {
            missing:
                "the Chats tab has no Threads row; only /chats?threads opens the list (difference to decide)",
        },
    },
    {
        id: "thread-unread",
        capability: "Unread thread replies counted on the threads entry, cleared once read",
        legacy: [
            "components/home/ChatList.svelte:214",
            "components_mobile/home/ThreadIndicator.svelte:33",
        ],
        desktop: { untested: "not yet" },
        mobile: { untested: "not yet (a community's Threads row only, its unmuted count)" },
    },
    {
        id: "thread-list-replies",
        capability: "The list shows each thread's latest replies, read on sight",
        legacy: [
            "components/home/thread/ThreadPreview.svelte:67",
            "components_mobile/home/thread/ThreadPreview.svelte:77",
        ],
        ...both({
            missing: "rows show the root only; opening the thread reads it (GAPS.md, Threads)",
        }),
    },
    {
        id: "thread-list-unfollow",
        capability: "Unfollow a thread from its row in the list",
        legacy: [
            "components/home/thread/ThreadPreview.svelte:130",
            "components_mobile/home/thread/ThreadPreview.svelte:149",
        ],
        ...both({
            missing:
                "ThreadList rows have no actions; unfollow is in the thread (GAPS.md, Threads)",
        }),
    },
    {
        id: "thread-list-mark-read",
        capability: "Mark a thread read from its row in the list",
        legacy: ["components_mobile/home/thread/ThreadPreview.svelte:152"],
        ...both({ missing: "ThreadList rows have no actions (GAPS.md, Threads)" }),
    },
    {
        id: "thread-typing",
        capability: "See who's typing in a thread",
        legacy: [
            "components/home/thread/ThreadHeader.svelte:58",
            "components_mobile/home/thread/ThreadHeader.svelte:48",
        ],
        ...both({ untested: "not yet (over the composer, not the header, GAPS.md)" }),
    },
    {
        id: "thread-permission",
        capability: "Replying in threads follows the chat's thread permissions",
        legacy: [
            "components/home/CurrentChat.svelte:368",
            "components_mobile/home/CurrentChat.svelte:314",
        ],
        ...both({ untested: "the roles and permissions area" }),
    },
];
