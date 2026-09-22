use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use std::collections::BTreeSet;
use user_canister::GroupCanisterEvent;
use user_canister::c2c_group_canister_v2::*;

#[update(msgpack = true)]
#[trace]
fn c2c_group_canister_v2(args: Args) -> Response {
    mutate_state(|state| c2c_group_canister_v2_impl(args, state))
}

// Handles the events a group sends this canister's users, in order, as the User canister does for
// its user. As there, only a group the user is in may send them. Events which can't be applied
// (the user is not here, or has left the group) are dropped rather than rejected with a trap,
// which the group would keep retrying, just as the User canister's guard rejection causes them to
// be dropped.
fn c2c_group_canister_v2_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let mut awarded_achievement = BTreeSet::new();

    for event in args.events {
        if !state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            continue;
        }
        let (user_id, event) = event.value;
        let Some(user_index) = state.index_of_local_user(user_id) else {
            continue;
        };

        state.data.users.with_user_mut(user_index, |user| {
            if !user.group_chats.exists(&caller.into()) {
                return;
            }
            match event {
                GroupCanisterEvent::MessageActivity(event) => user.push_message_activity(event, now),
                GroupCanisterEvent::Achievement(achievement) => {
                    if user.award_achievement(achievement, now) {
                        awarded_achievement.insert(user_index);
                    }
                }
            }
        });
    }

    for user_index in awarded_achievement {
        state.notify_user_index_of_chit(user_index, now);
    }

    Response::Success
}
