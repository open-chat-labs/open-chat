//! Instantiates, in this crate, the msgpack serializers and deserializers of the types below,
//! which many crates (de)serialize, eg. the c2c clients of the Group, Community and User canisters.
//!
//! The canisters are built with `opt-level = "z"`, under which rustc shares generic instances
//! between crates: a crate links to an instance which a crate it depends on has already
//! instantiated rather than instantiating its own. But crates which don't depend on one another
//! each instantiate their own copy of an instance which none of their dependencies has, and every
//! copy then ends up in the wasm, as they're different symbols. So a canister using several of
//! those crates contains the same code several times over: the LocalUserIndex, which calls the
//! Group, Community and User canisters for their events, had three copies of `MessageContent`'s
//! deserializer, of up to ~200KB each, and ~1.3MB of duplicated code in all, which took it within
//! 250KB of the 12MB limit on a canister's code. And since which copy a crate links to depends on
//! the dependency graph, a new dependency between two crates can change how many copies there are.
//!
//! Every crate which (de)serializes these types depends on this one, so each now links to the
//! copy instantiated here. Nothing calls these functions, so they're removed from the wasm, but
//! they must stay `pub`: a library crate only instantiates the generics its public functions use.
//!
//! To find any other code duplicated this way, build with `-C symbol-mangling-version=v0` and keep
//! the name section (`ic-wasm ... shrink -k`, `optimize Oz -k`): each generic instance's symbol
//! ends with the crate which instantiated it, so a function repeated with different endings is a
//! candidate to add here.

use crate::{
    CommunityCanisterCommunitySummary, CommunityCanisterCommunitySummaryUpdates, EventsResponse, GateCheckFailedReason,
    GroupCanisterGroupChatSummary, GroupCanisterGroupChatSummaryUpdates, MessageContent, MessageContentInitial,
    MessagesResponse,
};
use oc_error_codes::OCError;

macro_rules! instantiate {
    ($($name:ident: $ty:ty),* $(,)?) => {
        $(
            #[doc(hidden)]
            pub fn $name(bytes: &[u8]) -> Vec<u8> {
                let value: $ty = msgpack::deserialize_then_unwrap(bytes);
                msgpack::serialize_then_unwrap(&value)
            }
        )*
    };
}

instantiate!(
    community_summary: CommunityCanisterCommunitySummary,
    community_summary_updates: CommunityCanisterCommunitySummaryUpdates,
    events_response: EventsResponse,
    gate_check_failed_reason: GateCheckFailedReason,
    group_chat_summary: GroupCanisterGroupChatSummary,
    group_chat_summary_updates: GroupCanisterGroupChatSummaryUpdates,
    message_content: MessageContent,
    message_content_initial: MessageContentInitial,
    messages_response: MessagesResponse,
    oc_error: OCError,
);
