use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use serde::Serialize;
use types::{Achievement, ChitEvent, ChitEventType, UserId};
use user_canister::claim_daily_chit::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn claim_daily_chit(args: Args) -> Response {
    execute_update(|state| claim_daily_chit_impl(args, state))
}

fn claim_daily_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    match state.data.streak.claim(now) {
        Ok(Some(insurance_claim)) => state.mark_streak_insurance_claim(insurance_claim),
        Ok(None) => {}
        Err(next_claim) => return AlreadyClaimed(next_claim),
    };

    let mut utc_offset_updated = false;
    if let Some(utc_offset_mins) = args.utc_offset_mins {
        utc_offset_updated = state.data.streak.set_utc_offset_mins(utc_offset_mins, now);
        if utc_offset_updated {
            // Claim again in case the timezone change has made this possible
            _ = state.data.streak.claim(now);
        }
    }

    let user_id: UserId = state.env.canister_id().into();
    let streak = state.data.streak.days(now);
    let chit_earned = chit_for_streak(streak);

    state.data.chit_events.push(ChitEvent {
        amount: chit_earned as i32,
        timestamp: now,
        reason: ChitEventType::DailyClaim,
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

    state.set_up_streak_insurance_timer_job();
    state.notify_user_index_of_chit(now);
    state.push_local_user_index_canister_event(
        LocalUserIndexEvent::EventStoreEvent(
            EventBuilder::new("user_claimed_daily_chit", now)
                .with_user(user_id.to_string(), true)
                .with_source(user_id.to_string(), true)
                .with_json_payload(&UserClaimedDailyChitEventPayload { streak, chit_earned })
                .build(),
        ),
        now,
    );

    Success(SuccessResult {
        chit_earned,
        chit_balance: state.data.chit_events.balance_for_month_by_timestamp(now),
        streak,
        max_streak: state.data.streak.max_streak(),
        next_claim: state.data.streak.next_claim(),
        utc_offset_updated,
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
