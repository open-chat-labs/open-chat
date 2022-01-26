use crate::read_state;
use ic_cdk_macros::query;
use user_canister::bio::{Response::*, *};

#[query]
fn bio(_args: Args) -> Response {
    read_state(|state| Success(state.data.bio.clone()))
}
