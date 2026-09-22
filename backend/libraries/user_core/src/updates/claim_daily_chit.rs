use crate::User;
use serde::Serialize;
use types::{Achievement, ChitEvent, ChitEventType, TimestampMillis, UserCanisterStreakInsuranceClaim};
use user_canister::claim_daily_chit::{Args, SuccessResult};

// What a claim leaves the caller to do: record any streak insurance claim, set up the insurance
// timer job, tell the LocalUserIndex of the user's CHIT and record the claim in the event store
pub struct Claimed {
    pub result: SuccessResult,
    pub insurance_claim: Option<UserCanisterStreakInsuranceClaim>,
}

// Claims the day's CHIT, extending the streak and awarding the streak achievements. Fails with
// the time of the next claim if today's has been made.
pub fn claim_daily_chit(user: &mut User, args: Args, now: TimestampMillis) -> Result<Claimed, TimestampMillis> {
    let insurance_claim = user.streak.claim(now)?;

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

    Ok(Claimed {
        result: SuccessResult {
            chit_earned,
            chit_balance: user.chit_events.chit_balance(),
            streak,
            max_streak: user.streak.max_streak(),
            next_claim: user.streak.next_claim(),
            utc_offset_updated,
        },
        insurance_claim,
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
pub struct UserClaimedDailyChitEventPayload {
    pub streak: u16,
    pub chit_earned: u32,
}
