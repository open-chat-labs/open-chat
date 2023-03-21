use crate::exchanges::Exchange;
use crate::guards::caller_is_whitelisted_trader;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use exchange_client_canister::cancel_orders::{Response::*, *};
use exchange_client_canister::ExchangeId;
use ic_cdk_macros::update;

#[update(guard = "caller_is_whitelisted_trader")]
#[trace]
async fn cancel_orders(args: Args) -> Response {
    let (caller, exchange_client) = match read_state(|state| prepare(args.exchange_id, state)) {
        Ok(ok) => (ok.caller, ok.exchange_client),
        Err(response) => return response,
    };

    exchange_client.cancel_orders(caller, args.orders.clone()).await;

    mutate_state(|state| {
        let now = state.env.now();
        for order in args.orders {
            state.data.orders_log.log_order_cancelled(args.exchange_id, order, now);
        }
    });

    Success
}

struct PrepareResult {
    caller: Principal,
    exchange_client: Box<dyn Exchange>,
}

fn prepare(exchange_id: ExchangeId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = state.env.caller();

    if state.data.is_whitelisted_trader(caller, exchange_id) {
        Ok(PrepareResult {
            caller,
            exchange_client: state.get_exchange_client(exchange_id).unwrap(),
        })
    } else {
        Err(NotAuthorized)
    }
}
