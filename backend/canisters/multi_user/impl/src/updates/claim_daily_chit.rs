use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use user_canister::claim_daily_chit::{Response::*, *};
use user_core::updates::claim_daily_chit::{Claimed, UserClaimedDailyChitEventPayload};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn claim_daily_chit(args: Args) -> Response {
    mutate_state(|state| claim_daily_chit_impl(args, state))
}

fn claim_daily_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let (my_index, Claimed { result, insurance_claim }) = match state.with_caller_user_mut(|my_index, user| {
        user_core::updates::claim_daily_chit::claim_daily_chit(user, args, now).map(|claimed| (my_index, claimed))
    }) {
        Ok(ok) => ok,
        Err(next_claim) => return AlreadyClaimed(next_claim),
    };

    if let Some(claim) = insurance_claim {
        state.mark_streak_insurance_claim(my_index, claim);
    }
    state.set_up_streak_insurance_timer_job(my_index);
    state.notify_user_index_of_chit(my_index, now);
    let user_id = state.user_id(my_index);
    state.push_local_user_index_canister_event(
        my_index,
        LocalUserIndexEvent::EventStoreEvent(
            EventBuilder::new("user_claimed_daily_chit", now)
                .with_user(user_id.to_string(), true)
                .with_source(user_id.to_string(), true)
                .with_json_payload(&UserClaimedDailyChitEventPayload {
                    streak: result.streak,
                    chit_earned: result.chit_earned,
                })
                .build(),
        ),
        now,
    );

    Success(result)
}
