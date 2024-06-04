use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use ic_cdk::update;
use local_user_index_canister::{ChitEarned, Event};
use serde::Serialize;
use types::ChitEarnedReason;
use user_index_canister::claim_daily_chit::{Response::*, *};
use utils::time::tomorrow;

#[update(guard = "caller_is_openchat_user")]
#[trace]
fn claim_daily_chit(_args: Args) -> Response {
    mutate_state(claim_daily_chit_impl)
}

fn claim_daily_chit_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let tomorrow = tomorrow(now);

    if let Some(claim_result) = state.data.users.claim_daily_chit(&caller, now) {
        state
            .data
            .chit_leaderboard
            .update_position(claim_result.user_id, claim_result.chit_balance);

        state.push_event_to_local_user_index(
            claim_result.user_id,
            Event::ChitEarned(ChitEarned {
                user_id: claim_result.user_id,
                amount: claim_result.chit_earned as i32,
                timestamp: now,
                reason: ChitEarnedReason::DailyClaim,
            }),
        );

        state.data.event_store_client.push(
            EventBuilder::new("user_claimed_daily_chit", now)
                .with_user(claim_result.user_id.to_string(), true)
                .with_source(state.env.canister_id().to_string(), false)
                .with_json_payload(&UserClaimedDailyChitEventPayload {
                    streak: claim_result.streak,
                    chit_earned: claim_result.chit_earned,
                })
                .build(),
        );

        Success(SuccessResult {
            chit_earned: claim_result.chit_earned,
            chit_balance: claim_result.chit_balance,
            streak: claim_result.streak,
            next_claim: tomorrow,
        })
    } else {
        AlreadyClaimed(tomorrow)
    }
}

#[derive(Serialize)]
struct UserClaimedDailyChitEventPayload {
    streak: u16,
    chit_earned: u32,
}
