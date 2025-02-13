use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::lookup_webauthn_pubkey::{Response::*, *};

#[query]
fn lookup_webauthn_pubkey(args: Args) -> Response {
    read_state(|state| lookup_webauthn_pubkey_impl(args, state))
}

fn lookup_webauthn_pubkey_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(key) = state.data.webauthn_keys.get(args.credential_id) {
        Success(SuccessResult {
            pubkey: key.public_key.clone(),
        })
    } else {
        NotFound
    }
}
