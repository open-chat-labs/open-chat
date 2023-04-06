use crate::exchanges::Exchange;
use crate::{read_state, Config, Order, RuntimeState};
use ic_cdk::api::call::CallResult;
use itertools::Itertools;
use market_maker_canister::{CancelOrderRequest, MakeOrderRequest, OrderType};
use std::cmp::Reverse;
use std::collections::btree_map::Entry::Occupied;
use std::collections::BTreeMap;
use std::time::Duration;
use tracing::trace;
use types::Milliseconds;
use utils::time::MINUTE_IN_MS;

const RUN_MARKET_MAKER_INTERVAL: Milliseconds = MINUTE_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(RUN_MARKET_MAKER_INTERVAL), run);
}

fn run() {
    let exchanges = read_state(get_active_exchanges);
    if !exchanges.is_empty() {
        ic_cdk::spawn(run_async(exchanges));
    }
}

fn get_active_exchanges(state: &RuntimeState) -> Vec<(Box<dyn Exchange>, Config)> {
    state
        .data
        .exchange_config
        .iter()
        .filter(|(_, c)| c.enabled)
        .filter_map(|(&id, c)| state.get_exchange_client(id).map(|e| (e, c.clone())))
        .collect()
}

async fn run_async(exchanges: Vec<(Box<dyn Exchange>, Config)>) {
    futures::future::join_all(exchanges.into_iter().map(|(e, c)| run_single(e, c))).await;
}

async fn run_single(exchange_client: Box<dyn Exchange>, config: Config) -> CallResult<()> {
    let exchange_id = exchange_client.exchange_id();
    trace!(%exchange_id, "Running market maker");

    let state = exchange_client.market_state().await?;

    let required_orders = build_orders(state.latest_price, &config);

    let orders_to_make = calculate_orders_to_make(
        &state.open_orders,
        required_orders,
        config.min_order_size,
        state.latest_price,
        config.max_orders_to_make_per_iteration as usize,
        config.price_increment,
    );

    let orders_to_cancel = calculate_orders_to_cancel(
        &state.open_orders,
        state.latest_price,
        (config.max_orders_per_direction as u64 + 1) * config.price_increment,
        config.max_orders_to_cancel_per_iteration as usize,
    );

    let orders_made = orders_to_make.len();
    let orders_cancelled = orders_to_cancel.len();

    futures::future::try_join(
        exchange_client.make_orders(orders_to_make),
        exchange_client.cancel_orders(orders_to_cancel),
    )
    .await?;

    trace!(%exchange_id, orders_made, orders_cancelled, "Market maker ran successfully");
    Ok(())
}

fn calculate_orders_to_make(
    open_orders: &[Order],
    target_orders: Vec<MakeOrderRequest>,
    min_order_size: u64,
    latest_price: u64,
    max_orders_to_make: usize,
    increment: u64,
) -> Vec<MakeOrderRequest> {
    let mut bids_to_make = BTreeMap::new();
    let mut asks_to_make = BTreeMap::new();
    for order in target_orders {
        match order.order_type {
            OrderType::Bid => bids_to_make.insert(order.price, order),
            OrderType::Ask => asks_to_make.insert(order.price, order),
        };
    }

    for order in open_orders {
        if let Occupied(mut e) = match order.order_type {
            OrderType::Bid => bids_to_make.entry(round_to_nearest_increment(order.price, increment)),
            OrderType::Ask => asks_to_make.entry(round_to_nearest_increment(order.price, increment)),
        } {
            let entry = e.get_mut();
            entry.amount = entry.amount.saturating_sub(order.amount);
            if entry.amount < min_order_size {
                e.remove();
            }
        }
    }

    bids_to_make
        .into_values()
        .chain(asks_to_make.into_values())
        .sorted_unstable_by_key(|o| Reverse(latest_price.abs_diff(o.price)))
        .take(max_orders_to_make)
        .collect()
}

fn calculate_orders_to_cancel(
    open_orders: &[Order],
    latest_price: u64,
    max_diff_from_latest_price: u64,
    max_orders_to_cancel: usize,
) -> Vec<CancelOrderRequest> {
    open_orders
        .iter()
        .filter(|o| o.price.abs_diff(latest_price) > max_diff_from_latest_price)
        .sorted_unstable_by_key(|o| Reverse(o.price.abs_diff(latest_price)))
        .take(max_orders_to_cancel)
        .map(|o| CancelOrderRequest { id: o.id.clone() })
        .collect()
}

fn build_orders(latest_price: u64, config: &Config) -> Vec<MakeOrderRequest> {
    let starting_bid = starting_bid(latest_price, config.price_increment);
    let starting_ask = starting_ask(latest_price, config.price_increment);

    let bids = (0..config.min_orders_per_direction as u64)
        .map(|i| starting_bid.saturating_sub(i * config.price_increment))
        .take_while(|p| *p > 0)
        .skip_while(|p| *p >= config.max_buy_price)
        .map(|p| MakeOrderRequest {
            order_type: OrderType::Bid,
            price: p,
            amount: config.order_size,
        });

    let asks = (0..config.min_orders_per_direction as u64)
        .map(|i| starting_ask.saturating_add(i * config.price_increment))
        .skip_while(|p| *p <= config.min_sell_price)
        .map(|p| MakeOrderRequest {
            order_type: OrderType::Ask,
            price: p,
            amount: config.order_size,
        });

    bids.chain(asks).collect()
}

fn round_to_nearest_increment(original: u64, increment: u64) -> u64 {
    ((original + (increment / 2)) / increment) * increment
}

fn starting_bid(latest_price: u64, increment: u64) -> u64 {
    ((latest_price / increment) - 1) * increment
}

fn starting_ask(latest_price: u64, increment: u64) -> u64 {
    (((latest_price - 1) / increment) + 2) * increment
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(100, 10, 90)]
    #[test_case(1001, 100, 900)]
    #[test_case(2999, 10, 2980)]
    #[test_case(100011, 2, 100008)]
    fn starting_bid_tests(latest_price: u64, increment: u64, expected: u64) {
        assert_eq!(starting_bid(latest_price, increment), expected)
    }

    #[test_case(100, 10, 110)]
    #[test_case(1001, 100, 1200)]
    #[test_case(2999, 10, 3010)]
    #[test_case(100011, 2, 100014)]
    fn starting_ask_tests(latest_price: u64, increment: u64, expected: u64) {
        assert_eq!(starting_ask(latest_price, increment), expected)
    }
}
