use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::selected_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::EventIndex;

#[query]
fn selected_updates(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let member = match state.data.get_member(caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    // Short circuit prior to calling `ic0.time()` so that query caching works effectively.
    let latest_event_index = state.data.chat.events.latest_event_index().unwrap_or_default();
    if latest_event_index <= args.updates_since {
        return SuccessNoUpdates(latest_event_index);
    }

    let now = state.env.now();
    let updates_since = match state
        .data
        .chat
        .events
        .events_reader(EventIndex::default(), None, now)
        .and_then(|r| r.get(args.updates_since.into()).map(|e| e.timestamp))
    {
        Some(ts) => ts,
        None => return SuccessNoUpdates(latest_event_index),
    };

    let updates = state.data.chat.selected_group_updates_from_events(updates_since, member, now);

    if updates.has_updates() {
        Success(SuccessResult {
            timestamp: updates.timestamp,
            latest_event_index: updates.latest_event_index,
            participants_added_or_updated: updates.members_added_or_updated,
            participants_removed: updates.members_removed,
            blocked_users_added: updates.blocked_users_added,
            blocked_users_removed: updates.blocked_users_removed,
            invited_users: updates.invited_users,
            pinned_messages_added: updates.pinned_messages_added,
            pinned_messages_removed: updates.pinned_messages_removed,
            rules: updates.rules,
        })
    } else {
        SuccessNoUpdates(latest_event_index)
    }
}
