// Search (#10550 phase 3): the chat list's search (your chats, and people and bots on OpenChat), a
// community's channels, a chat's own messages and Explore's communities, as the old trees offer
// them, and where the new trees show them. Finding a public group is in groups.mjs (group-find);
// searching members is the members area's. Legacy refs are under frontend/app/src.

const CHATS =
    "the chat list's search finds a group by its name, and leaves out the chats it doesn't match";
const IN_CHAT = "searching a chat finds its messages and steps between them @mobile-only";

const both = (entry) => ({ desktop: entry, mobile: entry });

export const rows = [
    {
        id: "search-chats",
        capability: "Search your chats by name from the chat list",
        legacy: ["components/home/ChatList.svelte:183"],
        ...both(CHATS),
    },
    {
        id: "search-archived",
        capability: "A search finds archived chats too",
        legacy: ["components/home/ChatList.svelte:242"],
        ...both({ untested: "not yet" }),
    },
    {
        id: "search-people",
        capability: "Find people and bots on OpenChat, and start a direct chat with one",
        legacy: [
            "components/home/ChatList.svelte:258",
            "components_mobile/home/NewMessage.svelte:141",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "search-channels",
        capability: "In a community, find channels you haven't joined",
        legacy: ["components/home/communities/details/BrowseChannels.svelte:50"],
        desktop: { missing: "not carried over: browsing channels needs a design (GAPS.md)" },
        mobile: { untested: "not yet (the community details' Search)" },
    },
    {
        id: "search-in-chat",
        capability: "Search a chat's messages and step through the matches",
        legacy: [
            "components/home/CurrentChatMenu.svelte:333",
            "components_mobile/home/CurrentChatMenu.svelte:151",
        ],
        desktop: { missing: "not built (ConversationScreen's TODO(4b))" },
        mobile: IN_CHAT,
    },
    {
        id: "search-in-chat-mention",
        capability: "Search a group's messages by @someone, picked from a list",
        legacy: [
            "components/home/CurrentChatSearchHeader.svelte:111",
            "components_mobile/home/CurrentChatSearchHeader.svelte:109",
        ],
        desktop: { missing: "no search in the conversation" },
        mobile: { untested: "not yet (no @ picker; a typed @name still searches, GAPS.md)" },
    },
    {
        id: "search-explore",
        capability: "Search communities in Explore",
        legacy: [
            "components/home/communities/explore/Explore.svelte:136",
            "components_mobile/home/communities/explore/Explore.svelte:300",
        ],
        ...both({ untested: "not yet" }),
    },
];
