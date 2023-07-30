use crate::exchanges::Exchange;
use crate::{mutate_state, read_state, AggregatedOrders, Config, MarketDetails, Order, RuntimeState};
use ic_cdk::api::call::CallResult;
use itertools::Itertools;
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest, OrderType};
use std::cmp::{max, min, Reverse};
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
    let now = state.env.now();

    state
        .data
        .exchange_config
        .iter()
        .filter(|(_, c)| c.enabled)
        // Exclude exchanges where there are orders in progress, unless those orders have been
        // pending for more than 10 minutes, since realistically that means they have failed.
        .filter(|(&id, _)| {
            state
                .data
                .market_makers_in_progress
                .get(&id)
                .map_or(true, |ts| now.saturating_sub(*ts) > 10 * MINUTE_IN_MS)
        })
        .filter_map(|(&id, c)| state.get_exchange_client(id).map(|e| (e, c.clone())))
        .collect()
}

async fn run_async(exchanges: Vec<(Box<dyn Exchange>, Config)>) {
    futures::future::join_all(exchanges.into_iter().map(|(e, c)| async {
        let exchange_id = e.exchange_id();
        let _ = run_single(e, c).await;
        mark_market_maker_complete(&exchange_id);
    }))
    .await;
}

async fn run_single(exchange_client: Box<dyn Exchange>, config: Config) -> CallResult<()> {
    let exchange_id = exchange_client.exchange_id();
    trace!(%exchange_id, "Running market maker");

    let previous_market_details = mutate_state(|state| {
        state.data.market_makers_in_progress.insert(exchange_id, state.env.now());
        state.data.market_details.get(&exchange_id).cloned()
    });

    let market_state = exchange_client.market_state().await?;

    let (current_bid, current_ask) = match (
        market_state.orderbook.bids.keys().max().copied(),
        market_state.orderbook.asks.keys().min().copied(),
    ) {
        (Some(bid), Some(ask)) => (bid, ask),
        _ => return Ok(()),
    };

    let my_open_orders_aggregated = market_state.my_open_orders.as_slice().into();

    let (latest_bid_taken, latest_ask_taken) =
        calculate_latest_orders_taken(&my_open_orders_aggregated, previous_market_details.as_ref());

    let (max_bid_price, min_ask_price) =
        calculate_price_limits(current_bid, current_ask, latest_bid_taken, latest_ask_taken, &config);

    let orders_to_make = calculate_orders_to_make(max_bid_price, min_ask_price, my_open_orders_aggregated, &config);

    let orders_to_cancel = calculate_orders_to_cancel(
        &market_state.my_open_orders,
        config.max_orders_per_direction as usize,
        config.max_orders_to_cancel_per_iteration as usize,
    );

    let orders_made = orders_to_make.len();
    let orders_cancelled = orders_to_cancel.len();

    futures::future::try_join(
        exchange_client.make_orders(orders_to_make),
        exchange_client.cancel_orders(orders_to_cancel),
    )
    .await?;

    mutate_state(|state| {
        state.data.market_details.insert(
            exchange_id,
            MarketDetails {
                latest_bid_taken,
                latest_ask_taken,
                latest_snapshot: market_state,
            },
        );
    });

    trace!(%exchange_id, orders_made, orders_cancelled, "Market maker ran successfully");
    Ok(())
}

fn mark_market_maker_complete(exchange_id: &ExchangeId) {
    mutate_state(|state| state.data.market_makers_in_progress.remove(exchange_id));
}

fn calculate_latest_orders_taken(
    my_open_orders: &AggregatedOrders,
    previous_market_details: Option<&MarketDetails>,
) -> (Option<u64>, Option<u64>) {
    if let Some(previous) = previous_market_details {
        let previous_orders: AggregatedOrders = previous.latest_snapshot.my_open_orders.as_slice().into();

        let bids_taken: Vec<_> = previous_orders
            .bids
            .keys()
            .rev()
            .take_while(|p| !my_open_orders.bids.contains_key(p))
            .copied()
            .collect();

        let asks_taken: Vec<_> = previous_orders
            .asks
            .keys()
            .take_while(|p| !my_open_orders.asks.contains_key(p))
            .copied()
            .collect();

        let latest_bid_taken = bids_taken.iter().min().copied().or(previous.latest_bid_taken);
        let latest_ask_taken = asks_taken.iter().max().copied().or(previous.latest_ask_taken);

        (latest_bid_taken, latest_ask_taken)
    } else {
        (None, None)
    }
}

fn calculate_price_limits(
    current_bid: u64,
    current_ask: u64,
    latest_bid_taken: Option<u64>,
    latest_ask_taken: Option<u64>,
    config: &Config,
) -> (u64, u64) {
    let mut max_bid_price = min(
        current_ask.saturating_sub(config.spread * config.price_increment),
        config.max_buy_price,
    );
    let mut min_ask_price = max(
        current_bid.saturating_add(config.spread * config.price_increment),
        config.min_sell_price,
    );

    if let Some(bid) = latest_bid_taken {
        min_ask_price = max(bid.saturating_add(config.spread * config.price_increment), min_ask_price);
    }

    if let Some(ask) = latest_ask_taken {
        max_bid_price = min(ask.saturating_sub(config.spread * config.price_increment), max_bid_price);
    }

    if max_bid_price > min_ask_price {
        let mid = (max_bid_price + min_ask_price) / 2;
        max_bid_price = mid;
        min_ask_price = mid;
    }

    max_bid_price = round_down_to_next_increment(max_bid_price, config.price_increment);
    min_ask_price = round_up_to_next_increment(min_ask_price, config.price_increment);

    let diff_in_increments = min_ask_price.saturating_sub(max_bid_price) / config.price_increment;
    if diff_in_increments < config.spread {
        let increase_required = config.spread - diff_in_increments;

        if increase_required % 2 == 0 {
            max_bid_price = max_bid_price.saturating_sub((increase_required / 2) * config.price_increment);
        } else {
            max_bid_price = max_bid_price.saturating_sub(((increase_required + 1) / 2) * config.price_increment);
        }

        min_ask_price = min_ask_price.saturating_add((increase_required / 2) * config.price_increment);
    }

    (max_bid_price, min_ask_price)
}

fn calculate_orders_to_make(
    max_bid_price: u64,
    min_ask_price: u64,
    my_open_orders: AggregatedOrders,
    config: &Config,
) -> Vec<MakeOrderRequest> {
    let (bids_to_make, asks_to_make) = build_orders(max_bid_price, min_ask_price, config);

    let mut bids_to_make_map = bids_to_make.into_iter().map(|o| (o.price, o)).collect();
    let mut asks_to_make_map = asks_to_make.into_iter().map(|o| (o.price, o)).collect();

    exclude_open_orders(
        &mut bids_to_make_map,
        &my_open_orders.bids,
        config.price_increment,
        config.min_order_size,
    );
    exclude_open_orders(
        &mut asks_to_make_map,
        &my_open_orders.asks,
        config.price_increment,
        config.min_order_size,
    );

    // Don't top up the best bid and ask, otherwise someone can keep trading against that price and
    // the bot will keep topping it up
    if let Occupied(e) = bids_to_make_map.entry(max_bid_price) {
        if e.get().amount < config.order_size {
            e.remove();
        }
    }
    if let Occupied(e) = asks_to_make_map.entry(min_ask_price) {
        if e.get().amount < config.order_size {
            e.remove();
        }
    }

    bids_to_make_map
        .into_values()
        .interleave(asks_to_make_map.into_values().rev())
        .take(config.max_orders_to_make_per_iteration as usize)
        .collect()
}

fn exclude_open_orders(
    orders_to_make: &mut BTreeMap<u64, MakeOrderRequest>,
    my_open_orders: &BTreeMap<u64, u64>,
    increment: u64,
    min_order_size: u64,
) {
    for (&price, &amount) in my_open_orders {
        if let Occupied(mut e) = orders_to_make.entry(round_to_nearest_increment(price, increment)) {
            let entry = e.get_mut();
            entry.amount = entry.amount.saturating_sub(amount);
            if entry.amount < min_order_size {
                e.remove();
            }
        }
    }
}

fn calculate_orders_to_cancel(
    my_open_orders: &[Order],
    max_orders_per_direction: usize,
    max_orders_to_cancel: usize,
) -> Vec<CancelOrderRequest> {
    // In ascending price order
    let bids: Vec<_> = my_open_orders
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Bid))
        .sorted_unstable_by_key(|o| o.price)
        .collect();

    // In descending price order
    let asks: Vec<_> = my_open_orders
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Ask))
        .sorted_unstable_by_key(|o| Reverse(o.price))
        .collect();

    bids.iter()
        .take(bids.len().saturating_sub(max_orders_per_direction))
        .interleave(asks.iter().take(asks.len().saturating_sub(max_orders_per_direction)))
        .take(max_orders_to_cancel)
        .map(|o| CancelOrderRequest { id: o.id.clone() })
        .collect()
}

fn build_orders(max_bid_price: u64, min_ask_price: u64, config: &Config) -> (Vec<MakeOrderRequest>, Vec<MakeOrderRequest>) {
    let starting_bid = round_down_to_next_increment(max_bid_price, config.price_increment);
    let starting_ask = round_up_to_next_increment(min_ask_price, config.price_increment);

    let bids = (0..config.min_orders_per_direction as u64)
        .map(|i| starting_bid.saturating_sub(i * config.price_increment))
        .take_while(|p| *p > 0)
        .skip_while(|p| *p >= config.max_buy_price)
        .map(|p| MakeOrderRequest {
            order_type: OrderType::Bid,
            price: p,
            amount: config.order_size,
        })
        .collect();

    let asks = (0..config.min_orders_per_direction as u64)
        .map(|i| starting_ask.saturating_add(i * config.price_increment))
        .skip_while(|p| *p <= config.min_sell_price)
        .map(|p| MakeOrderRequest {
            order_type: OrderType::Ask,
            price: p,
            amount: config.order_size,
        })
        .collect();

    (bids, asks)
}

fn round_to_nearest_increment(original: u64, increment: u64) -> u64 {
    ((original + (increment / 2)) / increment) * increment
}

fn round_down_to_next_increment(price: u64, increment: u64) -> u64 {
    (price / increment) * increment
}

fn round_up_to_next_increment(price: u64, increment: u64) -> u64 {
    (((price - 1) / increment) + 1) * increment
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(100, 10, 100)]
    #[test_case(1001, 100, 1000)]
    #[test_case(2999, 10, 2990)]
    #[test_case(100011, 2, 100010)]
    fn round_down_to_next_increment_tests(max_bid: u64, increment: u64, expected: u64) {
        assert_eq!(round_down_to_next_increment(max_bid, increment), expected)
    }

    #[test_case(100, 10, 100)]
    #[test_case(1001, 100, 1100)]
    #[test_case(2999, 10, 3000)]
    #[test_case(100011, 2, 100012)]
    fn round_up_to_next_increment_tests(min_ask: u64, increment: u64, expected: u64) {
        assert_eq!(round_up_to_next_increment(min_ask, increment), expected)
    }

    #[test_case(40, 100, None, None, 60, 80)]
    #[test_case(40, 80, None, None, 50, 70)]
    #[test_case(50, 60, None, None, 40, 70)]
    #[test_case(50, 70, None, None, 50, 70)]
    #[test_case(50, 80, None, None, 50, 70)]
    #[test_case(50, 90, None, None, 60, 80)]
    #[test_case(40, 100, Some(50), None, 60, 80)]
    #[test_case(40, 100, None, Some(90), 50, 70)]
    #[test_case(40, 100, Some(30), Some(50), 30, 60)]
    #[test_case(40, 100, Some(90), Some(90), 70, 110)]
    #[test_case(40, 100, Some(90), Some(110), 80, 110)]
    fn calculate_price_limits_tests(
        latest_bid: u64,
        latest_ask: u64,
        latest_bid_taken: Option<u64>,
        latest_ask_taken: Option<u64>,
        expected_max_bid_price: u64,
        expected_min_ask_price: u64,
    ) {
        let config = Config {
            enabled: true,
            price_increment: 10,
            order_size: 10,
            min_order_size: 10,
            max_buy_price: 100,
            min_sell_price: 0,
            spread: 2,
            min_orders_per_direction: 3,
            max_orders_per_direction: 5,
            max_orders_to_make_per_iteration: 2,
            max_orders_to_cancel_per_iteration: 2,
        };

        let (max_bid_price, min_ask_price) =
            calculate_price_limits(latest_bid, latest_ask, latest_bid_taken, latest_ask_taken, &config);

        assert_eq!(max_bid_price, expected_max_bid_price);
        assert_eq!(min_ask_price, expected_min_ask_price);
    }
}
