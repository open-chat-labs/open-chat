use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::CommunityCanisterEvent;
use multi_user_canister::c2c_community::*;
use std::collections::BTreeSet;

#[update(msgpack = true)]
#[trace]
fn c2c_community(args: Args) -> Response {
    execute_update(|state| c2c_community_impl(args, state))
}

// Handles the events a community sends this canister's users, in order. Only a community the user
// is in may send them. Events which can't be applied (the user is not here, or has left the
// community) are dropped rather than rejected with a trap, which the community would keep retrying.
fn c2c_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let mut awarded_achievement = BTreeSet::new();

    for event in args.into_events() {
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
        // Removing the community needs the whole canister's state rather than just the user's. It does
        // nothing if the user isn't in the community.
        let event = match event {
            CommunityCanisterEvent::RemovedFromCommunity(ev) => {
                super::c2c_remove_from_community::remove_from_community(
                    user_index,
                    ev.removed_by,
                    ev.blocked,
                    ev.community_name,
                    ev.public,
                    state,
                );
                continue;
            }
            event => event,
        };

        state.data.users.with_user_mut(user_index, |user| {
            if !user.communities.exists(&caller.into()) {
                return;
            }
            match event {
                CommunityCanisterEvent::MessageActivity(event) => user.push_message_activity(event, now),
                CommunityCanisterEvent::Achievement(achievement) => {
                    if user.award_achievement(achievement, now) {
                        awarded_achievement.insert(user_index);
                    }
                }
                // No longer sent, but some may still be queued
                CommunityCanisterEvent::P2PSwapCreated(_) => {}
                CommunityCanisterEvent::RemovedFromCommunity(_) => {}
            }
        });
    }

    for user_index in awarded_achievement {
        state.notify_user_index_of_chit(user_index, now);
    }

    Response::Success
}
