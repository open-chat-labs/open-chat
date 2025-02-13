use crate::guards::caller_is_owner;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use serde::Serialize;
use types::{Achievement, ChitEarned, ChitEarnedReason, UserId};
use user_canister::claim_daily_chit::{Response::*, *};
use utils::time::tomorrow;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn claim_daily_chit(_args: Args) -> Response {
    mutate_state(claim_daily_chit_impl)
}

fn claim_daily_chit_impl(state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let tomorrow = tomorrow(now);

    match state.data.streak.claim(now) {
        //Ok(Some(insurance_claim)) => state.mark_streak_insurance_claim(insurance_claim),
        //Ok(None) => {}
        Ok(_) => (),
        Err(_) => return AlreadyClaimed(tomorrow),
    };

    let user_id: UserId = state.env.canister_id().into();
    let streak = state.data.streak.days(now);
    let chit_earned = chit_for_streak(streak);

    state.data.chit_events.push(ChitEarned {
        amount: chit_earned as i32,
        timestamp: now,
        reason: ChitEarnedReason::DailyClaim,
    });

    if streak >= 3 {
        state.data.award_achievement(Achievement::Streak3, now);
    }

    if streak >= 7 {
        state.data.award_achievement(Achievement::Streak7, now);
    }

    if streak >= 14 {
        state.data.award_achievement(Achievement::Streak14, now);
    }

    if streak >= 30 {
        state.data.award_achievement(Achievement::Streak30, now);
    }

    if streak >= 100 {
        state.data.award_achievement(Achievement::Streak100, now);
    }

    if streak >= 365 {
        state.data.award_achievement(Achievement::Streak365, now);
    }

    //state.set_up_streak_insurance_timer_job();
    state.data.notify_user_index_of_chit(now);
    state.data.event_store_client.push(
        EventBuilder::new("user_claimed_daily_chit", now)
            .with_user(user_id.to_string(), true)
            .with_source(user_id.to_string(), true)
            .with_json_payload(&UserClaimedDailyChitEventPayload { streak, chit_earned })
            .build(),
    );

    Success(SuccessResult {
        chit_earned,
        chit_balance: state.data.chit_events.balance_for_month_by_timestamp(now),
        streak,
        next_claim: tomorrow,
    })
}

fn chit_for_streak(days: u16) -> u32 {
    if days == 0 {
        return 0;
    }
    if days < 3 {
        return 200;
    }
    if days < 7 {
        return 300;
    }
    if days < 14 {
        return 400;
    }
    if days < 30 {
        return 500;
    }
    if days < 100 {
        return 600;
    }
    if days < 365 {
        return 800;
    }
    1000
}

#[derive(Serialize)]
struct UserClaimedDailyChitEventPayload {
    streak: u16,
    chit_earned: u32,
}
