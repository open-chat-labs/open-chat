use crate::state;
use email_utils::ValidatedEmail;
use ic_cdk::query;
use sign_in_with_email_canister::{Delegation, GetDelegationArgs, GetDelegationResponse};

#[query]
fn get_delegation(args: GetDelegationArgs) -> GetDelegationResponse {
    let Ok(email) = ValidatedEmail::try_from(args.email) else {
        return GetDelegationResponse::NotFound;
    };

    state::read(|s| {
        let seed = s.calculate_seed(&email);
        let delegation = Delegation {
            pubkey: args.session_key,
            expiration: args.expiration,
        };
        if let Some(signed_delegation) = s.get_delegation(seed, delegation) {
            GetDelegationResponse::Success(signed_delegation)
        } else {
            GetDelegationResponse::NotFound
        }
    })
}
