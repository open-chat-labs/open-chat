use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use registry_canister::c2c_tokens::{Response::*, *};

#[query(msgpack = true)]
#[trace]
fn c2c_tokens(_args: Args) -> Response {
    read_state(c2c_tokens_impl)
}

fn c2c_tokens_impl(state: &RuntimeState) -> Response {
    Success(
        state
            .data
            .tokens
            .iter()
            .filter(|t| !t.uninstalled)
            .map(|t| Token {
                ledger_canister_id: t.ledger_canister_id,
                fee: t.fee,
            })
            .collect(),
    )
}
