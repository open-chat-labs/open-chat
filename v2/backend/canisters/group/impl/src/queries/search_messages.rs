use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::search_messages::{Response::*, *};
use ic_cdk_macros::query;
use types::{GroupMessageMatch, MessageMatch};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query]
fn search_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| search_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let caller = runtime_state.env.caller();
    let participant = match runtime_state.data.participants.get(caller) {
        None => return NotInGroup,
        Some(p) => p,
    };

    let internal_matches = runtime_state.data.events.search_messages(
        runtime_state.env.now(),
        participant.min_visible_event_index,
        &args.search_term,
        args.max_results,
    );

    let avatar_id = runtime_state.data.avatar.as_ref().map(|a| a.id);
    let group_name = &runtime_state.data.name;

    let matches = internal_matches
        .into_iter()
        .map(|m| MessageMatch::Group(
            GroupMessageMatch {
                chat_id: m.chat_id,
                event_index: m.event_index,
                content: m.content,
                score: m.score,
                group_name: group_name.to_owned(),
                avatar_id,
                sender: m.sender,            
            }
        ))
        .collect();

    Success(SuccessResult { matches })
}
