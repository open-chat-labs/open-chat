use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::UserId;
use user_canister::claim_daily_chit::{Response::*, *};
use user_core::updates::claim_daily_chit::{Claimed, UserClaimedDailyChitEventPayload};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn claim_daily_chit(args: Args) -> Response {
    execute_update(|state| claim_daily_chit_impl(args, state))
}

fn claim_daily_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let Claimed { result, insurance_claim } =
        match user_core::updates::claim_daily_chit::claim_daily_chit(&mut state.data.user, args, now) {
            Ok(claimed) => claimed,
            Err(next_claim) => return AlreadyClaimed(next_claim),
        };

    if let Some(claim) = insurance_claim {
        state.mark_streak_insurance_claim(claim);
    }
    state.set_up_streak_insurance_timer_job();
    state.notify_user_index_of_chit(now);
    let user_id: UserId = state.env.canister_id().into();
    state.push_local_user_index_canister_event(
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
