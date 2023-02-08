use crate::guards::caller_is_admin;
use crate::{mutate_state, read_state, PrizeData};
use canister_tracing_macros::trace;
use group_prize_bot::initalize_bot::{Response::*, *};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use types::Cycles;

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update(guard = "caller_is_admin")]
#[trace]
async fn initialize_bot(args: Args) -> Response {
    let (user_index_canister_id, now) = read_state(|state| (state.data.user_index_canister_id, state.env.now()));

    if args.end_date <= now {
        EndDateInPast
    } else {
        let response: CallResult<(Response,)> =
            ic_cdk::api::call::call_with_payment128(user_index_canister_id, "c2c_register_bot", (&args,), BOT_REGISTRATION_FEE)
                .await;

        match response.map(|r| r.0) {
            Ok(Success) | Ok(AlreadyRegistered) => {
                mutate_state(|state| {
                    state.data.username = args.username;
                    state.data.prize_data = Some(PrizeData {
                        token: args.token,
                        ledger_canister_id: args.ledger_canister_id,
                        prizes: args.prizes,
                        end_date: args.end_date,
                    });
                });
                Success
            }
            Ok(response) => response,
            Err(error) => InternalError(format!("{error:?}")),
        }
    }
}
