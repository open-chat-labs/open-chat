use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use user_canister::btc_address::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn btc_address(_args: Args) -> Response {
    run_regular_jobs();

    if let Some(btc_address) = read_state(|state| state.data.btc_address.clone()) {
        return Success(btc_address);
    }

    match ckbtc_minter_canister_c2c_client::get_btc_address(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::get_btc_address::Args::default(),
    )
    .await
    {
        Ok(btc_address) => {
            mutate_state(|state| state.data.btc_address = Some(btc_address.clone()));
            Success(btc_address)
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}
