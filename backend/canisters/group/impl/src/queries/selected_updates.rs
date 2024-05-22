use crate::{read_state, RuntimeState};
use group_canister::selected_updates_v2::{Response::*, *};
use ic_cdk::query;

#[query]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let last_updated = state.data.chat.details_last_updated();
    if last_updated <= args.updates_since {
        return SuccessNoUpdates(last_updated);
    }

    let caller = state.env.caller();
    let user_id = match state.data.lookup_user_id(caller) {
        Some(id) => id,
        None => return CallerNotInGroup,
    };

    let updates = state
        .data
        .chat
        .selected_group_updates(args.updates_since, Some(user_id))
        .unwrap();

    if updates.has_updates() {
        Success(updates)
    } else {
        SuccessNoUpdates(last_updated)
    }
}
