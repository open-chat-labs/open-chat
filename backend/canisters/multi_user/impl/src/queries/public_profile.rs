use crate::read_state;
use canister_api_macros::query;
use user_canister::public_profile::{Response::*, *};

#[query(msgpack = true)]
fn public_profile(args: Args) -> Response {
    // The User canister's response has no error variant, so an id which is not for a user in this
    // canister is rejected rather than answered with an empty profile
    let result = read_state(|state| state.with_user(args.user_id, user_core::queries::public_profile));
    match result {
        Ok(profile) => Success(profile),
        Err(error) => ic_cdk::trap(format!("{error:?}")),
    }
}
