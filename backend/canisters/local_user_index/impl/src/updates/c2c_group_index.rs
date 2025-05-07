use crate::guards::caller_is_group_index_canister;
use crate::{CommunityEvent, GroupEvent};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use community_canister::NameChanged as CommunityNameChanged;
use community_canister::VerifiedChanged as CommunityVerifiedChanged;
use group_canister::NameChanged as GroupNameChanged;
use group_canister::VerifiedChanged as GroupVerifiedChanged;
use local_user_index_canister::GroupIndexEvent;
use local_user_index_canister::c2c_group_index::{Response::*, *};
use std::cell::LazyCell;
use types::TimestampMillis;

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
fn c2c_group_index(args: Args) -> Response {
    mutate_state(|state| c2c_group_index_impl(args, state))
}

fn c2c_group_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.group_index_canister_id, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, &now, state);
        }
    }
    Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: GroupIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        GroupIndexEvent::GroupNameChanged(ev) => {
            state.push_event_to_group(
                ev.canister_id,
                GroupEvent::NameChanged(GroupNameChanged { name: ev.name }),
                **now,
            );
        }
        GroupIndexEvent::CommunityNameChanged(ev) => {
            state.push_event_to_community(
                ev.canister_id,
                CommunityEvent::NameChanged(CommunityNameChanged { name: ev.name }),
                **now,
            );
        }
        GroupIndexEvent::GroupVerifiedChanged(ev) => {
            state.push_event_to_group(
                ev.canister_id,
                GroupEvent::VerifiedChanged(GroupVerifiedChanged { verified: ev.verified }),
                **now,
            );
        }
        GroupIndexEvent::CommunityVerifiedChanged(ev) => {
            state.push_event_to_community(
                ev.canister_id,
                CommunityEvent::VerifiedChanged(CommunityVerifiedChanged { verified: ev.verified }),
                **now,
            );
        }
        GroupIndexEvent::NotifyOfUserDeleted(canister_id, user_id) => {
            if state.data.local_groups.get(&canister_id.into()).is_some() {
                state.push_event_to_group(canister_id, GroupEvent::UserDeleted(user_id), **now);
            } else if state.data.local_communities.get(&canister_id.into()).is_some() {
                state.push_event_to_community(canister_id, CommunityEvent::UserDeleted(user_id), **now)
            }
        }
    }
}
