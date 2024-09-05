use crate::guards::caller_is_owner;
use crate::read_state;
use ic_cdk::query;
use user_canister::get_cached_btc_address::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn cached_btc_address(_args: Args) -> Response {
    match read_state(|state| state.data.btc_address.clone()) {
        Some(btc_address) => Success(btc_address),
        None => NotFound,
    }
}
