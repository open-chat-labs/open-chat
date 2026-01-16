use crate::state;
use email_utils::ValidatedEmail;
use ic_cdk::query;
use sign_in_with_email_canister::Delegation;
use sign_in_with_email_canister::get_delegation::{Args, Response};

#[query]
fn get_delegation(args: Args) -> Response {
    let Ok(email) = ValidatedEmail::try_from(args.email) else {
        return Response::NotFound;
    };

    state::read(|s| {
        let seed = s.calculate_seed(&email);
        let delegation = Delegation {
            pubkey: args.session_key,
            expiration: args.expiration,
        };
        if let Some(signed_delegation) = s.get_delegation(seed, delegation) {
            Response::Success(signed_delegation)
        } else {
            Response::NotFound
        }
    })
}
