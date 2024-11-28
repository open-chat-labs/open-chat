use crate::exchanges::Exchange;
use crate::{mutate_state, read_state, CanisterBalances, RuntimeState};
use constants::HOUR_IN_MS;
use ic_cdk::api::call::CallResult;
use std::collections::BTreeMap;
use std::time::Duration;
use types::{CanisterId, Milliseconds, TimestampMillis};
use utils::canister_timers::run_now_then_interval;

const CALCULATE_BALANCES_INTERVAL: Milliseconds = HOUR_IN_MS;

pub fn start_job() {
    run_now_then_interval(Duration::from_millis(CALCULATE_BALANCES_INTERVAL), run);
}

fn run() {
    let PrepareResult { exchange_clients, now } = read_state(prepare);
    if !exchange_clients.is_empty() {
        ic_cdk::spawn(run_async(exchange_clients, now));
    }
}

struct PrepareResult {
    exchange_clients: Vec<Box<dyn Exchange>>,
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
        now: state.env.now(),
    }
}

async fn run_async(exchange_clients: Vec<Box<dyn Exchange>>, now: TimestampMillis) {
    if let Ok(exchange_balances) = futures::future::try_join_all(exchange_clients.into_iter().map(get_exchange_balances)).await
    {
        let mut balances = BTreeMap::new();

        for (ledger_canister_id, balance) in exchange_balances.into_iter().flatten() {
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

async fn get_exchange_balances(exchange_client: Box<dyn Exchange>) -> CallResult<Vec<(CanisterId, u128)>> {
    exchange_client.account_balances().await
}
