use crate::guards::caller_is_openchat_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::LIFETIME_DIAMOND_TIMESTAMP;
use local_user_index_canister::claim_channel_prize::{Response::*, *};
use types::DiamondMembershipStatus;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn claim_channel_prize(args: Args) -> Response {
    let (user_details, now) = mutate_state(|state| (state.calling_user(), state.env.now()));

    let is_unique_person = user_details.unique_person_proof.is_some();
    let diamond_status = match user_details.diamond_membership_expires_at {
        Some(ts) if ts > LIFETIME_DIAMOND_TIMESTAMP => DiamondMembershipStatus::Lifetime,
        Some(ts) if ts > now => DiamondMembershipStatus::Active,
        _ => DiamondMembershipStatus::Inactive,
    };

    // TODO not sure why this is an i32 - doesn't seem to make much sense
    let total_chit_earned: u32 = user_details.chit.total_earned as u32;

    let c2c_args = community_canister::c2c_claim_prize::Args {
        channel_id: args.channel_id,
        message_id: args.message_id,
        is_unique_person,
        diamond_status,
        total_chit_earned,
    };

    // do community_canister::c2c_claim_prize
    // map error
    match community_canister_c2c_client::c2c_claim_prize(args.community_id.into(), &c2c_args).await {
        Ok(_response) => Success,
        Err(error) => Error(error.into()),
    }
}
