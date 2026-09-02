use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ckbtc_minter_canister::CKBTC_MINTER_CANISTER_ID;
use icrc_ledger_types::icrc1::account::Account;
use types::{Timestamped, UserId};
use user_canister::generate_btc_address::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn generate_btc_address(_args: Args) -> Response {
    execute_update_async(generate_btc_address_impl).await
}

async fn generate_btc_address_impl() -> Response {
    if let Some(btc_address) = read_state(|state| state.data.btc_address.as_ref().map(|a| a.value.clone())) {
        return Success(btc_address);
    }

    // The minter derives the BTC address from the (owner, subaccount) pair so that deposits are
    // minted into the user's account rather than the canister's default account
    let my_user_id = read_state(|state| UserId::from(state.env.canister_id()));

    match ckbtc_minter_canister_c2c_client::get_btc_address(
        CKBTC_MINTER_CANISTER_ID,
        &ckbtc_minter_canister::get_btc_address::Args {
            owner: None,
            subaccount: Account::from(my_user_id).subaccount,
        },
    )
    .await
    {
        Ok(btc_address) => {
            mutate_state(|state| state.data.btc_address = Some(Timestamped::new(btc_address.clone(), state.env.now())));
            Success(btc_address)
        }
        Err(error) => Error(error.into()),
    }
}
