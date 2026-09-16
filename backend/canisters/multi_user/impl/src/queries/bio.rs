use crate::read_state;
use canister_api_macros::query;
use user_canister::bio::{Response::*, *};

#[query(msgpack = true)]
fn bio(args: Args) -> Response {
    // The User canister's response has no error variant, so an id which is not for a user in this
    // canister is rejected rather than answered with an empty bio
    match read_state(|state| state.with_user(args.user_id, |user| user.bio.value.clone())) {
        Ok(bio) => Success(bio),
        Err(error) => ic_cdk::trap(format!("{error:?}")),
    }
}
