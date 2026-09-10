use crate::guards::verify_caller_is_local_user_index;
use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::c2c_report_results::*;
use types::UnitResult;

#[update(msgpack = true)]
#[trace]
async fn c2c_report_results(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    if let Err(error) = verify_caller_is_local_user_index(caller).await {
        return UnitResult::Error(error);
    }
    mutate_state(|state| {
        let now = state.env.now();
        state.data.upsert_results(args.results, now);
    });
    UnitResult::Success
}
