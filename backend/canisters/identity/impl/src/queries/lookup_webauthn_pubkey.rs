use crate::{read_state, RuntimeState};
use ic_cdk::query;
use identity_canister::lookup_webauthn_pubkey::{Response::*, *};

#[query]
fn lookup_webauthn_pubkey(args: Args) -> Response {
    read_state(|state| lookup_webauthn_pubkey_impl(args, state))
}

fn lookup_webauthn_pubkey_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(pubkey) = state.data.webauthn_keys.get_pubkey(&args.credential_id) {
        Success(SuccessResult { pubkey: pubkey.to_vec() })
    } else {
        NotFound
    }
}
