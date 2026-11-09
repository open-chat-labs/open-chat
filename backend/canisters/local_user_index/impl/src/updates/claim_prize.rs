use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{guards::caller_is_openchat_user, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::LIFETIME_DIAMOND_TIMESTAMP;
use local_user_index_canister::{GlobalUser, claim_prize::*};
use oc_error_codes::OCErrorCode;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{
    CanisterId, DiamondMembershipStatus, MultiUserChat,
    PrizeClaimResponse::{self, *},
    UserId,
};
use user_index_canister::LocalUserIndexEvent as UserIndexEvent;

thread_local! {
    static CLAIMS_IN_PROGRESS: RefCell<HashSet<UserId>> = RefCell::default();
}

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn claim_prize(args: Args) -> PrizeClaimResponse {
    let (
        GlobalUser {
            chit,
            user_id,
            diamond_membership_expires_at,
            unique_person_proof,
            ..
        },
        now,
        blocked_until,
    ) = read_state(|state| {
        let user = state.calling_user();
        let blocked_until = state.data.prize_claims_blocked_until.get(&user.user_id).copied();
        (user, state.env.now(), blocked_until)
    });

    // The user has claimed as many prizes as they can in a day. The message is when they can claim again.
    if let Some(blocked_until) = blocked_until.filter(|ts| *ts > now) {
        return Error(OCErrorCode::LimitReached.with_message(blocked_until));
    }

    // One claim at a time for each user, so that a burst of claims can't all be paid out before any
    // of them counts towards the limit
    let Some(_guard) = ClaimInProgressGuard::new(user_id) else {
        return Error(OCErrorCode::AlreadyInProgress.into());
    };

    let is_unique_person = unique_person_proof.is_some();
    let diamond_status = match diamond_membership_expires_at {
        Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => DiamondMembershipStatus::Lifetime,
        Some(ts) if ts > now => DiamondMembershipStatus::Active,
        _ => DiamondMembershipStatus::Inactive,
    };

    let total_chit_earned: u32 = chit.total_earned.max(0) as u32;

    let response = match args.chat_id {
        MultiUserChat::Group(chat_id) => {
            let c2c_args = group_canister::c2c_claim_prize::Args {
                user_id,
                message_id: args.message_id,
                is_unique_person,
                diamond_status,
                total_chit_earned,
                streak: chit.streak,
                streak_ends: chit.streak_ends,
            };
            let canister_id = CanisterId::from(chat_id);
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                group_canister_c2c_client::c2c_claim_prize(canister_id, &c2c_args)
            })
            .await
        }
        MultiUserChat::Channel(community_id, channel_id) => {
            let c2c_args = community_canister::c2c_claim_prize::Args {
                user_id,
                channel_id,
                message_id: args.message_id,
                is_unique_person,
                diamond_status,
                total_chit_earned,
                streak: chit.streak,
                streak_ends: chit.streak_ends,
            };
            let canister_id = CanisterId::from(community_id);
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_claim_prize(canister_id, &c2c_args)
            })
            .await
        }
    };

    let response = match response {
        Ok(response) => response,
        Err(error) => Error(error.into()),
    };

    // Each prize paid out counts towards the user's limit, which the UserIndex keeps
    if matches!(response, Success | FailedAfterTransfer(..)) {
        mutate_state(|state| {
            let now = state.env.now();
            state.push_event_to_user_index(UserIndexEvent::PrizeClaimed(user_id), now);
        });
    }

    response
}

// Removes the user from `CLAIMS_IN_PROGRESS` when dropped, which also happens if the callback
// following the claim traps
struct ClaimInProgressGuard(UserId);

impl ClaimInProgressGuard {
    fn new(user_id: UserId) -> Option<ClaimInProgressGuard> {
        CLAIMS_IN_PROGRESS
            .with_borrow_mut(|c| c.insert(user_id))
            .then_some(ClaimInProgressGuard(user_id))
    }
}

impl Drop for ClaimInProgressGuard {
    fn drop(&mut self) {
        CLAIMS_IN_PROGRESS.with_borrow_mut(|c| c.remove(&self.0));
    }
}
