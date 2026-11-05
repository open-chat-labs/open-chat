use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::updates::c2c_verify_sign_in_proof::verify_sign_in_proof;
use crate::{guards::caller_is_openchat_user, read_state, turnstile};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::LIFETIME_DIAMOND_TIMESTAMP;
use local_user_index_canister::{GlobalUser, claim_prize::*};
use oc_error_codes::OCErrorCode;
use types::{
    CanisterId, DiamondMembershipStatus, MultiUserChat,
    PrizeClaimResponse::{self, *},
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
        signed_in_again,
        turnstile_config,
        now,
    ) = read_state(|state| {
        let user = state.calling_user();
        let now = state.env.now();
        let signed_in_again = args
            .sign_in_proof_jwt
            .is_some_and(|jwt| verify_sign_in_proof(&jwt, user.principal, state.data.oc_key_pair.public_key_pem(), now));

        (user, signed_in_again, state.data.turnstile_config.clone(), now)
    });

    // With a secret key, every claim must pass Turnstile, which counts as the user having signed in
    // again, as a prize requiring a captcha asks for. Without one, tokens are ignored.
    let passed_turnstile = match turnstile_config.secret_key {
        Some(secret_key) => {
            let Some(pass) = args.turnstile else {
                return Error(OCErrorCode::HumanVerificationFailed.with_message("Turnstile token required"));
            };
            let custom_data = turnstile::custom_data(user_id, args.message_id, &pass.salt);
            if let Err(error) = turnstile::verify(&secret_key, &pass.token, &custom_data).await {
                return Error(error);
            }
            true
        }
        None => false,
    };
    let user_reauthenticated = passed_turnstile || signed_in_again;

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
                user_reauthenticated,
            };
            let canister_id = CanisterId::from(community_id);
            top_up_and_retry_if_out_of_cycles(canister_id, || {
                community_canister_c2c_client::c2c_claim_prize(canister_id, &c2c_args)
            })
            .await
        }
    };

    match response {
        Ok(response) => response,
        Err(error) => Error(error.into()),
    }
}
