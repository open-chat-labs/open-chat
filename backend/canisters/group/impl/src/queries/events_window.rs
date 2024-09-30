use crate::guards::caller_is_local_user_index;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::query;
use group_canister::c2c_events_window::Args as C2CArgs;
use group_canister::events_window::{Response::*, *};
use group_chat_core::EventsResult;

#[query(candid = true)]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, None, state))
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_events_window(args: C2CArgs) -> Response {
    read_state(|state| events_window_impl(args.args, Some(args.caller), state))
}

fn events_window_impl(args: Args, on_behalf_of: Option<Principal>, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    let user_id = state.data.lookup_user_id(caller);

    match state.data.chat.events_window(
        user_id,
        args.thread_root_message_index,
        args.mid_point,
        args.max_messages,
        args.max_events,
    ) {
        EventsResult::Success(response) => Success(response),
        EventsResult::UserNotInGroup => CallerNotInGroup,
        EventsResult::ThreadNotFound => ThreadMessageNotFound,
        EventsResult::UserSuspended => UserSuspended,
        EventsResult::UserLapsed => UserLapsed,
    }
}
