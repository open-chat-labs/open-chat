use crate::read_state;
use canister_api_macros::query;
use user_canister::public_profile::{Response::*, *};

#[query(msgpack = true)]
fn public_profile(_args: Args) -> Response {
    read_state(|state| Success(user_core::queries::public_profile(&state.data.user)))
}
