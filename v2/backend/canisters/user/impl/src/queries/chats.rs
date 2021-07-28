use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use itertools::Itertools;
use user_canister::common::chat_summary::{ChatSummary, DirectChatSummary};
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
            .values()
            .filter(
                |&c| {
                    if let Some(updated_since) = args.updated_since {
                        c.last_updated() > updated_since
                    } else {
                        true
                    }
                },
            )
            .map(|c| {
                ChatSummary::Direct(DirectChatSummary {
                    chat_id: c.chat_id,
                    them: c.them,
                    latest_message: c.messages.hydrate_message(c.messages.last().unwrap()),
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
