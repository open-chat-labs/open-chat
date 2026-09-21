use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{IdempotentEnvelope, UserId};
use user_canister::CommunityCanisterEvent;
use user_canister::c2c_community_canister::*;

#[update(msgpack = true)]
#[trace]
fn c2c_community_canister(args: Args) -> Response {
    mutate_state(|state| handle_user_events(args.user_id, args.events, state))
}

// Handles the events a community sends one of this canister's users, as the User canister does. As
// there, only a community the user is in may send them. Events which can't be applied (the user is not
// here, or has left the community) are dropped rather than rejected with a trap, which the community would
// keep retrying, just as the User canister's guard rejection causes them to be dropped.
pub(crate) fn handle_user_events(
    user_id: UserId,
    events: Vec<IdempotentEnvelope<CommunityCanisterEvent>>,
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
            if !user.communities.exists(&caller.into()) {
                return false;
            }

            let mut awarded_achievement = false;
            for event in events {
                if user.idempotency_checker.check(caller, event.created_at, event.idempotency_id) {
                    match event.value {
                        CommunityCanisterEvent::MessageActivity(event) => user.push_message_activity(event, now),
                        CommunityCanisterEvent::Achievement(achievement) => {
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
