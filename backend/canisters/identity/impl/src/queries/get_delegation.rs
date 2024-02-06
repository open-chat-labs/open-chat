use crate::{delegation_signature_msg_hash, read_state, RuntimeState};
use ic_cdk_macros::query;
use identity_canister::get_delegation::{Response::*, *};
use identity_canister::{Delegation, SignedDelegation};
use serde_bytes::ByteBuf;
use utils::time::NANOS_PER_MILLISECOND;

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
        expiration: args.expiration * NANOS_PER_MILLISECOND,
    };
    let message_hash = delegation_signature_msg_hash(&delegation);
    let seed = state.data.calculate_seed(user.index);

    if let Ok(signature) = state.data.signature_map.get_signature_as_cbor(&seed, message_hash, None) {
        Success(SignedDelegation {
            delegation,
            signature: ByteBuf::from(signature),
        })
    } else {
        NotFound
    }
}
