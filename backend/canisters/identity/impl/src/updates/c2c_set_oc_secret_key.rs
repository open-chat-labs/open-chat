use crate::guards::caller_is_user_index_canister;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use identity_canister::c2c_set_oc_secret_key::*;
use p256_key_pair::P256KeyPair;

// TODO remove this after upgrade
#[update(guard = "caller_is_user_index_canister", msgpack = true)]
#[trace]
fn c2c_set_oc_secret_key(args: Args) -> Response {
    assert!(!args.oc_secret_key_der.is_empty());

    mutate_state(|state| state.data.oc_key_pair = Some(P256KeyPair::from_secret_key_der(args.oc_secret_key_der).unwrap()));
    Response::Success
}
