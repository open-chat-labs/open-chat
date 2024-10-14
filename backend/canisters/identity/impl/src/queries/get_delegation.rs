use crate::{read_state, RuntimeState};
use ic_canister_sig_creation::signature_map::CanisterSigInputs;
use ic_canister_sig_creation::{delegation_signature_msg, DELEGATION_SIG_DOMAIN};
use ic_cdk::query;
use identity_canister::get_delegation::{Response::*, *};
use types::{Delegation, SignedDelegation};

#[query]
fn get_delegation(args: Args) -> Response {
    read_state(|state| get_delegation_impl(args, state))
}

fn get_delegation_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) else {
        panic!("Caller not recognised");
    };

    let seed = state.data.calculate_seed(user.index);

    if let Ok(signature) = state.data.signature_map.get_signature_as_cbor(
        &CanisterSigInputs {
            domain: DELEGATION_SIG_DOMAIN,
            seed: &seed,
            message: &delegation_signature_msg(&args.session_key, args.expiration, None),
        },
        None,
    ) {
        let delegation = Delegation {
            pubkey: args.session_key,
            expiration: args.expiration,
        };

        Success(SignedDelegation { delegation, signature })
    } else {
        NotFound
    }
}
