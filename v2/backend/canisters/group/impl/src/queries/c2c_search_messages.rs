use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::c2c_search_messages::{Response::*, *};
use ic_cdk_macros::query;
use types::{GroupMessageMatch, MessageMatch};

#[query]
fn c2c_search_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_search_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn c2c_search_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let participant = match runtime_state.data.participants.get(args.user_id.into()) {
        None => return NotInGroup,
        Some(p) => p,
    };

    let chat_id = runtime_state.env.canister_id().into();

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

    Success(SuccessResult { chat_id, matches })
}
