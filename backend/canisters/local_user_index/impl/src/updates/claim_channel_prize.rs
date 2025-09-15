use crate::guards::caller_is_openchat_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::LIFETIME_DIAMOND_TIMESTAMP;
use local_user_index_canister::{
    GlobalUser,
    claim_channel_prize::{Response::*, *},
};
use types::DiamondMembershipStatus;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn claim_channel_prize(args: Args) -> Response {
    let (
        GlobalUser {
            chit,
            user_id,
            diamond_membership_expires_at,
            unique_person_proof,
            ..
        },
        now,
    ) = mutate_state(|state| (state.calling_user(), state.env.now()));

    let is_unique_person = unique_person_proof.is_some();
    let diamond_status = match diamond_membership_expires_at {
        Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => DiamondMembershipStatus::Lifetime,
        Some(ts) if ts > now => DiamondMembershipStatus::Active,
        _ => DiamondMembershipStatus::Inactive,
    };

    // TODO not sure why this is an i32 - doesn't seem to make much sense
    let total_chit_earned: u32 = chit.total_earned as u32;

    let c2c_args = community_canister::c2c_claim_prize::Args {
        user_id,
        channel_id: args.channel_id,
        message_id: args.message_id,
        is_unique_person,
        diamond_status,
        total_chit_earned,
        streak: chit.streak,
        streak_ends: chit.streak_ends,
    };

    match community_canister_c2c_client::c2c_claim_prize(args.community_id.into(), &c2c_args).await {
        Ok(response) => match response {
            community_canister::c2c_claim_prize::Response::Success => Success,
            community_canister::c2c_claim_prize::Response::TransferFailed(x, trans) => TransferFailed(x, trans),
            community_canister::c2c_claim_prize::Response::FailedAfterTransfer(x, trans) => FailedAfterTransfer(x, trans),
            community_canister::c2c_claim_prize::Response::Error(err) => Error(err),
        },
        Err(error) => Error(error.into()),
    }
}
