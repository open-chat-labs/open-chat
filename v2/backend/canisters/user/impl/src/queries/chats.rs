use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use itertools::Itertools;
use shared::types::chat_summary::{ChatSummary, DirectChatSummary};
use user_canister::queries::chats::{Response::*, *};

#[query]
fn chats(args: Args) -> Response {
    RUNTIME_STATE.with(|state| chats_impl(args, state.borrow().as_ref().unwrap()))
}

fn chats_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let direct_chats = runtime_state
            .data
            .direct_chats
            .get_all(args.updated_since)
            .map(|c| {
                ChatSummary::Direct(DirectChatSummary {
                    them: c.them,
                    chat_id: c.chat_id,
                    latest_message: c.events.latest_message().unwrap(),
                    latest_event_index: c.events.latest_event_index(),
                    date_created: c.date_created,
                })
            })
            .sorted_unstable_by_key(|s| s.display_date())
            .collect();

        Success(SuccessResult {
            chats: direct_chats,
            timestamp: runtime_state.env.now(),
        })
    } else {
        NotAuthorised
    }
}
