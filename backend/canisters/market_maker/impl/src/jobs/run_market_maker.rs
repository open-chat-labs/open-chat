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
const SPREAD_MULTIPLIER: u64 = 2;

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

    let open_orders_aggregated = market_state.open_orders.as_slice().into();

    let (latest_bid_taken, latest_ask_taken) =
        calculate_latest_orders_taken(&open_orders_aggregated, previous_market_details.as_ref());

    let orders_to_make = calculate_orders_to_make(
        &open_orders_aggregated,
        &market_state.orderbook,
        latest_bid_taken,
        latest_ask_taken,
        &config,
    );

    let orders_to_cancel = calculate_orders_to_cancel(
        &market_state.open_orders,
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
    open_orders: &AggregatedOrders,
    previous_market_details: Option<&MarketDetails>,
) -> (Option<u64>, Option<u64>) {
    if let Some(previous) = previous_market_details {
        let previous_orders: AggregatedOrders = previous.latest_snapshot.open_orders.as_slice().into();

        let bids_taken: Vec<_> = previous_orders
            .bids
            .keys()
            .rev()
            .take_while(|p| !open_orders.bids.contains_key(p))
            .copied()
            .collect();

        let asks_taken: Vec<_> = previous_orders
            .asks
            .keys()
            .take_while(|p| !open_orders.asks.contains_key(p))
            .copied()
            .collect();

        let latest_bid_taken = bids_taken.iter().min().copied().or(previous.latest_bid_taken);
        let latest_ask_taken = asks_taken.iter().max().copied().or(previous.latest_ask_taken);

        (latest_bid_taken, latest_ask_taken)
    } else {
        (None, None)
    }
}

fn calculate_orders_to_make(
    open_orders: &AggregatedOrders,
    orderbook: &AggregatedOrders,
    latest_bid_taken: Option<u64>,
    latest_ask_taken: Option<u64>,
    config: &Config,
) -> Vec<MakeOrderRequest> {
    let (current_bid, current_ask) = match (orderbook.bids.keys().max(), orderbook.asks.keys().min()) {
        (Some(b), Some(a)) => (*b, *a),
        _ => return Vec::new(),
    };

    let mut max_bid_price = min(
        current_ask.saturating_sub(SPREAD_MULTIPLIER * config.price_increment),
        config.max_buy_price,
    );
    let mut min_ask_price = max(
        current_bid.saturating_add(SPREAD_MULTIPLIER * config.price_increment),
        config.min_sell_price,
    );

    if let Some(bid) = latest_bid_taken {
        min_ask_price = max(bid.saturating_add(SPREAD_MULTIPLIER * config.price_increment), min_ask_price);
    }

    if let Some(ask) = latest_ask_taken {
        max_bid_price = min(ask.saturating_sub(SPREAD_MULTIPLIER * config.price_increment), max_bid_price);
    }

    if max_bid_price > min_ask_price {
        std::mem::swap(&mut max_bid_price, &mut min_ask_price);
    }

    let (bids_to_make, asks_to_make) = build_orders(max_bid_price, min_ask_price, config);

    let mut bids_to_make_map = bids_to_make.into_iter().map(|o| (o.price, o)).collect();
    let mut asks_to_make_map = asks_to_make.into_iter().map(|o| (o.price, o)).collect();

    exclude_open_orders(
        &mut bids_to_make_map,
        &open_orders.bids,
        config.price_increment,
        config.min_order_size,
    );
    exclude_open_orders(
        &mut asks_to_make_map,
        &open_orders.asks,
        config.price_increment,
        config.min_order_size,
    );

    bids_to_make_map
        .into_values()
        .interleave(asks_to_make_map.into_values())
        .take(config.max_orders_to_make_per_iteration as usize)
        .collect()
}

fn exclude_open_orders(
    orders_to_make: &mut BTreeMap<u64, MakeOrderRequest>,
    open_orders: &BTreeMap<u64, u64>,
    increment: u64,
    min_order_size: u64,
) {
    for (&price, &amount) in open_orders {
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
    open_orders: &[Order],
    max_orders_per_direction: usize,
    max_orders_to_cancel: usize,
) -> Vec<CancelOrderRequest> {
    // In ascending price order
    let bids: Vec<_> = open_orders
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Bid))
        .sorted_unstable_by_key(|o| o.price)
        .collect();

    // In descending price order
    let asks: Vec<_> = open_orders
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
    let starting_bid = starting_bid(max_bid_price, config.price_increment);
    let starting_ask = starting_ask(min_ask_price, config.price_increment);

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

fn starting_bid(max_bid: u64, increment: u64) -> u64 {
    (max_bid / increment) * increment
}

fn starting_ask(min_ask: u64, increment: u64) -> u64 {
    (((min_ask - 1) / increment) + 1) * increment
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(100, 10, 100)]
    #[test_case(1001, 100, 1000)]
    #[test_case(2999, 10, 2990)]
    #[test_case(100011, 2, 100010)]
    fn starting_bid_tests(max_bid: u64, increment: u64, expected: u64) {
        assert_eq!(starting_bid(max_bid, increment), expected)
    }

    #[test_case(100, 10, 100)]
    #[test_case(1001, 100, 1100)]
    #[test_case(2999, 10, 3000)]
    #[test_case(100011, 2, 100012)]
    fn starting_ask_tests(min_ask: u64, increment: u64, expected: u64) {
        assert_eq!(starting_ask(min_ask, increment), expected)
    }

    // #[test]
    // fn calculate_orders_to_make() {
    //     let config = Config {
    //         enabled: true,
    //         price_increment: 10,
    //         order_size: 50,
    //         min_order_size: 25,
    //         max_buy_price: 100,
    //         min_sell_price: 0,
    //         min_orders_per_direction: 3,
    //         max_orders_per_direction: 5,
    //         max_orders_to_make_per_iteration: 2,
    //         max_orders_to_cancel_per_iteration: 2,
    //     };
    //
    //     let open_orders = vec![
    //         Order {
    //             order_type: OrderType::Bid,
    //             id: "1".to_string(),
    //             price: 10,
    //             amount: 10,
    //         },
    //         Order {
    //             order_type: OrderType::Bid,
    //             id: "2".to_string(),
    //             price: 10,
    //             amount: 20,
    //         },
    //         Order {
    //             order_type: OrderType::Bid,
    //             id: "3".to_string(),
    //             price: 20,
    //             amount: 20,
    //         },
    //         Order {
    //             order_type: OrderType::Bid,
    //             id: "4".to_string(),
    //             price: 30,
    //             amount: 30,
    //         },
    //         Order {
    //             order_type: OrderType::Ask,
    //             id: "5".to_string(),
    //             price: 40,
    //             amount: 25,
    //         },
    //         Order {
    //             order_type: OrderType::Ask,
    //             id: "6".to_string(),
    //             price: 50,
    //             amount: 30,
    //         },
    //         Order {
    //             order_type: OrderType::Ask,
    //             id: "7".to_string(),
    //             price: 60,
    //             amount: 20,
    //         },
    //         Order {
    //             order_type: OrderType::Ask,
    //             id: "8".to_string(),
    //             price: 60,
    //             amount: 10,
    //         },
    //     ];
    //
    //     let orders_to_make = super::calculate_orders_to_make(&open_orders, 30, BidAndAsk::default(), &config);
    //
    //     let expected = vec![
    //         MakeOrderRequest {
    //             order_type: OrderType::Bid,
    //             price: 20,
    //             amount: 30,
    //         },
    //         MakeOrderRequest {
    //             order_type: OrderType::Ask,
    //             price: 40,
    //             amount: 25,
    //         },
    //     ];
    //
    //     assert_eq!(orders_to_make, expected);
    // }
}
