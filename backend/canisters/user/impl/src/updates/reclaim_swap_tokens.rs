use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::ExchangeId;
use user_canister::reclaim_swap_tokens::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn reclaim_swap_tokens(args: Args) -> Response {
    run_regular_jobs();

    let result = match args.exchange_id {
        ExchangeId::ICPSwap => {
            crate::token_swaps::icpswap::withdraw(args.swap_canister_id, args.ledger_canister_id, args.amount, args.fee).await
        }
        // ExchangeId::Sonic => {
        //     crate::token_swaps::sonic::withdraw(args.swap_canister_id, args.ledger_canister_id, args.amount).await
        // }
        ExchangeId::KongSwap => unimplemented!(),
    };

    match result {
        Ok(_) => {
            mutate_state(|state| state.data.token_swaps.record_reclaim(args, state.env.now()));
            Success
        }
        Err(error) => Failed(format!("{error:?}")),
    }
}
