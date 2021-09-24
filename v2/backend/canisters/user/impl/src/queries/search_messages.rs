use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::EventIndex;
use user_canister::search_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query]
fn search_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| search_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let direct_chat = match runtime_state.data.direct_chats.get(&args.user_id.into()) {
        None => return ChatNotFound,
        Some(dc) => dc,
    };

    let matches = direct_chat.events.search_messages(
        runtime_state.env.now(),
        EventIndex::default(),
        &args.search_term,
        args.max_results,
    );

    Success(SuccessResult { matches })
}
