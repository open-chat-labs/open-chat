// Polls (#10550 phase 3): making a poll in a group or channel, voting on it and reading its results,
// in the old trees and the new. Who may post a poll is a permission, so it's tested with the roles
// and permissions area. Legacy refs are under frontend/app/src.

// the native builders (poll, prize, …) are placeholders until N9 (#10376): the attach panel's Poll
// tile opens an empty screen
const NO_NATIVE_BUILDER = { missing: "no poll builder yet: N9 (#10376)" };

const BUILDER =
    "a poll made in the builder reaches the group with its question, answers and rules @desktop-only";
const VOTE = "a vote reaches the poll's author, and so does changing it";
const RULES =
    "the builder holds a poll back until it has a question and two different answers @desktop-only";

const both = (entry) => ({ desktop: entry, mobile: entry });

export const rows = [
    {
        id: "poll-create",
        capability: "Create a poll from the composer and post it to a group or channel",
        legacy: [
            "components/home/MessageActions.svelte:256",
            "components/home/PollBuilder.svelte:140",
            "components_mobile/home/CustomMessageTrigger.svelte:205",
            "components_mobile/home/PollBuilder.svelte:178",
        ],
        desktop: BUILDER,
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-question",
        capability: "Give the poll a question of up to 250 characters",
        legacy: [
            "components/home/PollBuilder.svelte:180",
            "components_mobile/home/PollBuilder.svelte:72",
            "components_mobile/home/PollBuilder.svelte:233",
        ],
        desktop: BUILDER,
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-answers",
        capability:
            "Give it 2 to 10 answers, none too long and no two the same ignoring case, blank ones dropped",
        legacy: [
            "components/home/PollBuilder.svelte:76",
            "components/home/PollBuilder.svelte:147",
            "components/home/PollBuilder.svelte:203",
            "components_mobile/home/PollBuilder.svelte:73",
            "components_mobile/home/PollBuilder.svelte:131",
        ],
        desktop: RULES,
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-reorder",
        capability: "Reorder the answers by dragging them",
        legacy: ["components_mobile/home/PollBuilder.svelte:255"],
        desktop: { untested: "not yet" },
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-settings",
        capability:
            "Set anonymous or public votes, multiple answers, whether a vote can change (always with multiple), and whether results show before the end",
        legacy: [
            "components/home/PollBuilder.svelte:235",
            "components_mobile/home/PollBuilder.svelte:342",
        ],
        desktop: { untested: "the builder spec checks only multiple answers" },
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-duration",
        capability: "Pick how long the poll runs",
        legacy: [
            "components/home/PollBuilder.svelte:275",
            "components_mobile/home/PollBuilder.svelte:219",
        ],
        desktop: { untested: "not yet" },
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-no-end",
        capability: "Post a poll that never ends",
        legacy: ["components/home/PollBuilder.svelte:258"],
        desktop: {
            missing: "every duration ends, 1 hour to 1 month (the old mobile had none either)",
        },
        mobile: NO_NATIVE_BUILDER,
    },
    {
        id: "poll-vote",
        capability: "Vote on someone's poll; the vote shows at once and reaches the others",
        legacy: [
            "components/home/PollContent.svelte:31",
            "components/home/ChatMessage.svelte:355",
            "components_mobile/home/PollContent.svelte:57",
            "components_mobile/home/ChatMessage.svelte:323",
        ],
        ...both(VOTE),
    },
    {
        id: "poll-change-vote",
        capability:
            "Change or take back a vote where the poll allows it (multiple choice always does); otherwise it's locked",
        legacy: [
            "components/home/PollContent.svelte:35",
            "components_mobile/home/PollContent.svelte:61",
        ],
        ...both(VOTE),
    },
    {
        id: "poll-results",
        capability:
            "See the results once you've voted (or sent it), or only once it ends when it hides them",
        legacy: [
            "components/home/PollContent.svelte:54",
            "components_mobile/home/PollContent.svelte:84",
        ],
        ...both(VOTE),
    },
    {
        id: "poll-voters",
        capability: "See who voted for each answer in a public poll",
        legacy: [
            "components/home/PollAnswer.svelte:83",
            "components_mobile/home/PollContent.svelte:192",
        ],
        ...both({ missing: "no voters' avatars or View votes list yet (GAPS.md, Polls)" }),
    },
    {
        id: "poll-ending",
        capability:
            "See when the poll ends; once it has, it's closed to votes and shows its results",
        legacy: [
            "components/home/PollContent.svelte:97",
            "components_mobile/home/PollContent.svelte:199",
        ],
        ...both({ untested: "not yet" }),
    },
    {
        id: "poll-thread",
        capability: "Post a poll in a thread and vote on it there",
        legacy: [
            "components/home/thread/Thread.svelte:256",
            "components_mobile/home/thread/Thread.svelte:396",
        ],
        desktop: { untested: "not yet" },
        mobile: { missing: "votes in a thread work, but there's no poll builder yet: N9 (#10376)" },
    },
    {
        id: "poll-permission",
        capability:
            "Polls are offered only where the reader may post them (a role permission, its own in threads), never in a DM",
        legacy: [
            "components/home/MessageActions.svelte:148",
            "components/home/CurrentChat.svelte:188",
            "components_mobile/home/CustomMessageTrigger.svelte:205",
        ],
        ...both({ untested: "the roles and permissions area" }),
    },
];
