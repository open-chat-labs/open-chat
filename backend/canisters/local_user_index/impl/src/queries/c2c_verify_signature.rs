use crate::guards::caller_is_local_child_canister;
use crate::read_state;
use canister_api_macros::query;
use constants::MINUTE_IN_MS;
use identity_utils::verify_signature;
use local_user_index_canister::c2c_verify_signature::*;

#[query(guard = "caller_is_local_child_canister", msgpack = true)]
fn c2c_verify_signature(args: Args) -> Response {
    read_state(|state| {
        verify_signature(
            &args.signature,
            state.data.identity_canister_id,
            5 * MINUTE_IN_MS,
            &state.data.ic_root_key,
            state.env.now(),
        )
    })
    .into()
}
