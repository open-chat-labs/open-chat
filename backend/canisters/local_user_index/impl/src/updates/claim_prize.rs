use crate::{guards::caller_is_openchat_user, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::LIFETIME_DIAMOND_TIMESTAMP;
use local_user_index_canister::{GlobalUser, claim_prize::*};
use types::{
    DiamondMembershipStatus, MultiUserChat,
    PrizeClaimResponse::{self, *},
    UserSignedInClaims,
};

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
        user_reauthenticated,
        now,
    ) = read_state(|state| {
        let user = state.calling_user();
        let now = state.env.now();
        let user_reauthenticated = args.sign_in_proof_jwt.is_some_and(|jwt| {
            jwt::verify_and_decode::<UserSignedInClaims>(&jwt, state.data.oc_key_pair.public_key_pem())
                .is_ok_and(|claims| claims.exp_ms() > now && claims.custom().principal == user.principal)
        });

        (user, user_reauthenticated, now)
    });

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
                user_reauthenticated,
            };
            group_canister_c2c_client::c2c_claim_prize(chat_id.into(), &c2c_args).await
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
                user_reauthenticated,
            };
            community_canister_c2c_client::c2c_claim_prize(community_id.into(), &c2c_args).await
        }
    };

    match response {
        Ok(response) => response,
        Err(error) => Error(error.into()),
    }
}
