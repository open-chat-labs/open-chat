use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use exchange_bot_canister::register_bot::{Response::*, *};
use ic_cdk_macros::update;
use types::Cycles;

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update(guard = "caller_is_governance_principal")]
#[trace]
async fn register_bot(args: Args) -> Response {
    let (already_registered, user_index_canister_id) =
        read_state(|state| (state.data.is_registered, state.data.user_index_canister_id));

    if already_registered {
        AlreadyRegistered
    } else {
        let response =
            user_index_canister_c2c_client::c2c_register_bot(user_index_canister_id, &args, BOT_REGISTRATION_FEE).await;

        match response {
            Ok(Success) => {
                mutate_state(|state| {
                    state.data.username = args.username;
                    state.data.display_name = args.display_name;
                    state.data.is_registered = true;
                });
                Success
            }
            Ok(response) => response,
            Err(error) => InternalError(format!("{error:?}")),
        }
    }
}
