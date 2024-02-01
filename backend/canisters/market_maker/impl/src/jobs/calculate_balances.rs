use crate::exchanges::Exchange;
use crate::{mutate_state, read_state, CanisterBalances, RuntimeState};
use ic_cdk::api::call::CallResult;
use itertools::Itertools;
use std::collections::BTreeMap;
use std::time::Duration;
use types::{CanisterId, Milliseconds, OrderType, TimestampMillis};
use utils::canister_timers::run_now_then_interval;
use utils::time::HOUR_IN_MS;

const CALCULATE_BALANCES_INTERVAL: Milliseconds = HOUR_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CALCULATE_BALANCES_INTERVAL), run);
}

fn run() {
    let PrepareResult {
        exchange_clients,
        this_canister_id,
        now,
    } = read_state(prepare);
    if !exchange_clients.is_empty() {
        ic_cdk::spawn(run_async(exchange_clients, this_canister_id, now));
    }
}

struct PrepareResult {
    exchange_clients: Vec<Box<dyn Exchange>>,
    this_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(state: &RuntimeState) -> PrepareResult {
    let exchange_clients = state
        .data
        .exchange_config
        .iter()
        .filter(|(_, c)| c.enabled)
        .filter_map(|(&id, _)| state.get_exchange_client(id))
        .collect();

    PrepareResult {
        exchange_clients,
        this_canister_id: state.env.canister_id(),
        now: state.env.now(),
    }
}

async fn run_async(exchange_clients: Vec<Box<dyn Exchange>>, this_canister_id: CanisterId, now: TimestampMillis) {
    let ledger_canister_ids: Vec<_> = exchange_clients
        .iter()
        .flat_map(|e| [e.quote_token().ledger, e.base_token().ledger])
        .unique()
        .collect();

    let ledger_balance_futures = futures::future::try_join_all(
        ledger_canister_ids
            .into_iter()
            .map(|l| get_ledger_balance(l, this_canister_id)),
    );

    let exchange_balance_futures = futures::future::try_join_all(exchange_clients.into_iter().map(get_exchange_balances));

    if let Ok((ledger_balances, exchange_balances)) =
        futures::future::try_join(ledger_balance_futures, exchange_balance_futures).await
    {
        let mut balances = BTreeMap::new();

        for (ledger_canister_id, balance) in ledger_balances.into_iter().chain(exchange_balances.into_iter().flatten()) {
            *balances.entry(ledger_canister_id).or_default() += balance;
        }

        mutate_state(|state| {
            while state.data.balance_history.len() > 5000 {
                state.data.balance_history.pop_back();
            }

            state.data.balance_history.push_front(CanisterBalances {
                timestamp: now,
                balances,
            });
        })
    }
}

async fn get_ledger_balance(ledger_canister_id: CanisterId, this_canister_id: CanisterId) -> CallResult<(CanisterId, u128)> {
    let balance = icrc_ledger_canister_c2c_client::icrc1_balance_of(ledger_canister_id, &this_canister_id.into()).await?;

    Ok((ledger_canister_id, balance.0.try_into().unwrap()))
}

async fn get_exchange_balances(exchange_client: Box<dyn Exchange>) -> CallResult<Vec<(CanisterId, u128)>> {
    let my_open_orders = exchange_client.my_open_orders().await?;

    let mut quote_token_balance = 0;
    let mut base_token_balance = 0;

    let quote_token = exchange_client.quote_token();

    for order in my_open_orders {
        match order.order_type {
            OrderType::Bid => {
                quote_token_balance += (order.amount * order.price / 10u64.pow(quote_token.decimals as u32)) as u128
            }
            OrderType::Ask => base_token_balance += order.amount as u128,
        }
    }

    Ok(vec![
        (exchange_client.quote_token().ledger, quote_token_balance),
        (exchange_client.base_token().ledger, base_token_balance),
    ])
}
