use crate::guards::caller_is_owner;
use crate::read_state;
use canister_api_macros::query;
use user_canister::cached_btc_address::{Response::*, *};

#[query(guard = "caller_is_owner", candid = true, msgpack = true)]
fn cached_btc_address(_args: Args) -> Response {
    match read_state(|state| state.data.btc_address.clone()) {
        Some(btc_address) => Success(btc_address),
        None => NotFound,
    }
}
