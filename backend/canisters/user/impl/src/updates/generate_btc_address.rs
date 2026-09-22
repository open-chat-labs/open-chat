use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::generate_btc_address::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn generate_btc_address(_args: Args) -> Response {
    execute_update_async(generate_btc_address_impl).await
}

async fn generate_btc_address_impl() -> Response {
    let (cached, my_user_id) = read_state(|state| {
        (
            state.data.user.btc_address.as_ref().map(|a| a.value.clone()),
            state.env.canister_id().into(),
        )
    });
    if let Some(btc_address) = cached {
        return Success(btc_address);
    }

    match user_core::updates::generate_btc_address::fetch_btc_address(my_user_id).await {
        Ok(btc_address) => {
            mutate_state(|state| state.data.user.btc_address = Some(Timestamped::new(btc_address.clone(), state.env.now())));
            Success(btc_address)
        }
        Err(error) => Error(error.into()),
    }
}
