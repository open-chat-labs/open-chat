use crate::guards::caller_is_admin;
use crate::{mutate_state, read_state, PrizeData};
use canister_tracing_macros::trace;
use group_prize_bot::initialize_bot::{Response::*, *};
use ic_cdk::update;
use types::Cycles;
use user_index_canister::c2c_register_bot::OptionalBotConfig;

const BOT_REGISTRATION_FEE: Cycles = 10_000_000_000_000; // 10T

#[update(guard = "caller_is_admin")]
#[trace]
async fn initialize_bot(args: Args) -> Response {
    let (user_index_canister_id, now) = read_state(|state| (state.data.user_index_canister_id, state.env.now()));

    if args.end_date <= now {
        EndDateInPast
    } else {
        let response = if args.update_existing {
            Ok(AlreadyRegistered)
        } else {
            let register_bot_args = user_index_canister::c2c_register_bot::Args {
                username: args.username.clone(),
                display_name: None,
                config: OptionalBotConfig::default(),
            };
            user_index_canister_c2c_client::c2c_register_bot(user_index_canister_id, &register_bot_args, BOT_REGISTRATION_FEE)
                .await
                .map(|r| r.into())
        };

        match response {
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
