use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::selected_updates_v2::{Response::*, *};
use ic_cdk_macros::query;
use types::EventIndex;

#[query]
fn selected_updates(args: group_canister::selected_updates::Args) -> group_canister::selected_updates::Response {
    read_state(|state| {
        let now = state.env.now();
        let latest_event_index = state.data.chat.events.latest_event_index().unwrap_or_default();
        let updates_since = match state
            .data
            .chat
            .events
            .events_reader(EventIndex::default(), None, now)
            .and_then(|r| r.get(args.updates_since.into()).map(|e| e.timestamp))
        {
            Some(ts) => ts,
            None => return group_canister::selected_updates::Response::SuccessNoUpdates(latest_event_index),
        };

        match selected_updates_impl(Args { updates_since }, state) {
            Success(s) => group_canister::selected_updates::Response::Success(s.into()),
            SuccessNoUpdates(_) => group_canister::selected_updates::Response::SuccessNoUpdates(latest_event_index),
            CallerNotInGroup => group_canister::selected_updates::Response::CallerNotInGroup,
        }
    })
}

#[query]
fn selected_updates_v2(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let user_id = match state.data.lookup_user_id(caller) {
        Some(id) => id,
        None => return CallerNotInGroup,
    };

    // Short circuit prior to calling `ic0.time()` so that query caching works effectively.
    let latest_event_timestamp = state.data.chat.events.latest_event_timestamp().unwrap_or_default();
    if latest_event_timestamp <= args.updates_since {
        return SuccessNoUpdates(latest_event_timestamp);
    }

    let updates = state
        .data
        .chat
        .selected_group_updates_from_events(args.updates_since, Some(user_id), state.env.now())
        .unwrap();

    if updates.has_updates() {
        Success(updates)
    } else {
        SuccessNoUpdates(latest_event_timestamp)
    }
}
