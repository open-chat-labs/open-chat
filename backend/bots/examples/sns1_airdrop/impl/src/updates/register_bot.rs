use crate::guards::caller_is_admin;
use crate::{mutate_state, read_state};
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use sns1_airdrop::register_bot::{Response::*, *};
use types::Cycles;

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update(guard = "caller_is_admin")]
#[trace]
async fn register_bot(args: Args) -> Response {
    let (already_registered, user_index_canister_id) =
        read_state(|state| (state.data.is_registered, state.data.user_index_canister_id));

    if already_registered {
        AlreadyRegistered
    } else {
        let response: CallResult<(Response,)> =
            ic_cdk::api::call::call_with_payment128(user_index_canister_id, "c2c_register_bot", (&args,), BOT_REGISTRATION_FEE)
                .await;

        match response.map(|r| r.0) {
            Ok(Success) => {
                mutate_state(|state| {
                    state.data.bot_name = args.username;
                    state.data.is_registered = true;
                });
                Success
            }
            Ok(response) => response,
            Err(error) => InternalError(format!("{error:?}")),
        }
    }
}
