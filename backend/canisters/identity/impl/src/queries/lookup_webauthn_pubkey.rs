use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use identity_canister::lookup_webauthn_pubkey::{Response::*, *};

#[query(msgpack = true, candid = true)]
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
