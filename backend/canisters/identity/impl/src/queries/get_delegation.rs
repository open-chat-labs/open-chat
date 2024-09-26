use crate::{delegation_signature_msg_hash, read_state, RuntimeState};
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

    let delegation = Delegation {
        pubkey: args.session_key,
        expiration: args.expiration,
    };
    let message_hash = delegation_signature_msg_hash(&delegation);
    let seed = state.data.calculate_seed(user.index);

    if let Ok(signature) = state.data.signature_map.get_signature_as_cbor(&seed, message_hash, None) {
        Success(SignedDelegation { delegation, signature })
    } else {
        NotFound
    }
}
