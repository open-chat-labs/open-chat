use crate::guards::caller_is_local_child_canister;
use canister_api_macros::update;
use local_user_index_canister::c2c_verify_signature::*;

#[update(guard = "caller_is_local_child_canister", msgpack = true)]
fn c2c_verify_signature(args: Args) -> Response {
    // TODO implement this properly
    // Maybe the Identity canister verifies that the user signed in recently and then calls into
    // other canisters as needed
    Response::Success
}
