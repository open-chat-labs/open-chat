use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use serde::Serialize;
use types::{Achievement, ChitEvent, ChitEventType};
use user_canister::claim_daily_chit::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn claim_daily_chit(args: Args) -> Response {
    mutate_state(|state| claim_daily_chit_impl(args, state))
}

fn claim_daily_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let result = state.with_caller_user_mut(|my_index, user| {
        let insurance_claim = match user.streak.claim(now) {
            Ok(insurance_claim) => insurance_claim,
            Err(next_claim) => return Err(AlreadyClaimed(next_claim)),
        };
        let mut utc_offset_updated = false;
        if let Some(utc_offset_mins) = args.utc_offset_mins {
            utc_offset_updated = user.streak.set_utc_offset_mins(utc_offset_mins, now);
            if utc_offset_updated {
                // Claim again in case the timezone change has made this possible
                _ = user.streak.claim(now);
            }
        }

        let streak = user.streak.days(now);
        let chit_earned = chit_for_streak(streak);

        user.chit_events.push(ChitEvent {
            amount: chit_earned as i32,
            timestamp: now,
            reason: ChitEventType::DailyClaim,
        });

        for (days, achievement) in [
            (3, Achievement::Streak3),
            (7, Achievement::Streak7),
            (14, Achievement::Streak14),
            (30, Achievement::Streak30),
            (100, Achievement::Streak100),
            (365, Achievement::Streak365),
        ] {
            if streak >= days {
                user.award_achievement(achievement, now);
            }
        }

        Ok((
            my_index,
            insurance_claim,
            SuccessResult {
                chit_earned,
                chit_balance: user.chit_events.chit_balance(),
                streak,
                max_streak: user.streak.max_streak(),
                next_claim: user.streak.next_claim(),
                utc_offset_updated,
            },
        ))
    });

    let (my_index, insurance_claim, result) = match result {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if let Some(claim) = insurance_claim {
        state.mark_streak_insurance_claim(my_index, claim);
    }
    state.set_up_streak_insurance_timer_job(my_index);

    let user_id = state.user_id(my_index);
    state.notify_user_index_of_chit(my_index, now);
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

// The same amounts as the User canister
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
