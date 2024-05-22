use crate::guards::caller_is_admin;
use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use satoshi_dice_canister::initialize_bot::*;
use types::Cycles;

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update(guard = "caller_is_admin")]
#[trace]
async fn initialize_bot(args: Args) -> Response {
    let (already_registered, user_index_canister_id) =
        read_state(|state| (state.data.initialized, state.data.user_index_canister_id));

    if already_registered {
        return AlreadyRegistered;
    }

    let response = user_index_canister_c2c_client::c2c_register_bot(user_index_canister_id, &args, BOT_REGISTRATION_FEE).await;

    match response {
        Ok(Success) => {
            mutate_state(|state| {
                state.data.username = args.username;
                state.data.initialized = true;
            });
            Success
        }
        Ok(response) => response,
        Err(error) => InternalError(format!("{error:?}")),
    }
}
