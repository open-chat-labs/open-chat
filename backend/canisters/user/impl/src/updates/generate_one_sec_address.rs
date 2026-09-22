use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Timestamped;
use user_canister::generate_one_sec_address::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn generate_one_sec_address(_args: Args) -> Response {
    execute_update_async(generate_one_sec_address_impl).await
}

async fn generate_one_sec_address_impl() -> Response {
    let (cached, my_user_id) = read_state(|state| {
        (
            state.data.user.one_sec_address.as_ref().map(|a| a.value.clone()),
            state.env.canister_id().into(),
        )
    });
    if let Some(address) = cached {
        return Success(address);
    }

    match user_core::updates::generate_one_sec_address::fetch_one_sec_address(my_user_id).await {
        Ok(address) => {
            mutate_state(|state| state.data.user.one_sec_address = Some(Timestamped::new(address.clone(), state.env.now())));
            Success(address)
        }
        Err(error) => Error(error),
    }
}
