use crate::{RuntimeState, group_events_by_user, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{IdempotentEnvelope, UserId};
use user_canister::GroupCanisterEvent;
use user_canister::c2c_group_canister_v2::*;

#[update(msgpack = true)]
#[trace]
fn c2c_group_canister_v2(args: Args) -> Response {
    mutate_state(|state| c2c_group_canister_v2_impl(args, state))
}

fn c2c_group_canister_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    for (user_id, events) in group_events_by_user(args.events) {
        handle_user_events(user_id, events, state);
    }
    Response::Success
}

// Handles the events a group sends one of this canister's users, as the User canister does. As
// there, only a group the user is in may send them. Events which can't be applied (the user is not
// here, or has left the group) are dropped rather than rejected with a trap, which the group would
// keep retrying, just as the User canister's guard rejection causes them to be dropped.
fn handle_user_events(
    user_id: UserId,
    events: Vec<IdempotentEnvelope<GroupCanisterEvent>>,
    state: &mut RuntimeState,
) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let Some(user_index) = state.index_of_local_user(user_id) else {
        return Response::Success;
    };

    let awarded_achievement = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            if !user.group_chats.exists(&caller.into()) {
                return false;
            }

            let mut awarded_achievement = false;
            for event in events {
                if user.idempotency_checker.check(caller, event.created_at, event.idempotency_id) {
                    match event.value {
                        GroupCanisterEvent::MessageActivity(event) => user.push_message_activity(event, now),
                        GroupCanisterEvent::Achievement(achievement) => {
                            awarded_achievement |= user.award_achievement(achievement, now);
                        }
                    }
                }
            }
            awarded_achievement
        })
        .unwrap_or_default();

    if awarded_achievement {
        state.notify_user_index_of_chit(user_index, now);
    }

    Response::Success
}
