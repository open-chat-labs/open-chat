use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::ONE_SEC_MINTER_CANISTER_ID;
use oc_error_codes::OCErrorCode;
use types::Timestamped;
use user_canister::generate_one_sec_address::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn generate_one_sec_address(_args: Args) -> Response {
    execute_update_async(generate_one_sec_address_impl).await
}

async fn generate_one_sec_address_impl() -> Response {
    let canister_id = match read_state(try_get_cached) {
        Ok(address) => return Success(address),
        Err(id) => id,
    };

    match one_sec_minter_canister_c2c_client::get_forwarding_address(
        ONE_SEC_MINTER_CANISTER_ID,
        &icrc_ledger_types::icrc1::account::Account {
            owner: canister_id,
            subaccount: None,
        },
    )
    .await
    {
        Ok(Ok(one_sec_address)) => {
            mutate_state(|state| state.data.one_sec_address = Some(Timestamped::new(one_sec_address.clone(), state.env.now())));
            Success(one_sec_address)
        }
        Ok(Err(error)) => Error(OCErrorCode::Unknown.with_message(error)),
        Err(error) => Error(error.into()),
    }
}

fn try_get_cached(state: &RuntimeState) -> Result<String, Principal> {
    if let Some(address) = state.data.one_sec_address.as_ref() {
        Ok(address.to_string())
    } else {
        Err(state.env.canister_id())
    }
}
