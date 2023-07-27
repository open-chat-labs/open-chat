use crate::exchanges::Exchange;
use crate::{mutate_state, read_state, BidAndAsk, Config, Order, RuntimeState};
use ic_cdk::api::call::CallResult;
use itertools::Itertools;
use market_maker_canister::{CancelOrderRequest, ExchangeId, MakeOrderRequest, OrderType};
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

    let previous_bid_and_ask = mutate_state(|state| {
        state.data.market_makers_in_progress.insert(exchange_id, state.env.now());
        state.data.latest_bid_and_ask.get(&exchange_id).cloned().unwrap_or_default()
    });

    let state = exchange_client.market_state().await?;

    let orders_to_make = calculate_orders_to_make(&state.open_orders, state.latest_price, previous_bid_and_ask, &config);

    let orders_to_cancel = calculate_orders_to_cancel(
        &state.open_orders,
        state.latest_price,
        (config.max_orders_per_direction as u64 + 1) * config.price_increment,
        config.max_orders_to_cancel_per_iteration as usize,
    );

    let orders_made = orders_to_make.len();
    let orders_cancelled = orders_to_cancel.len();

    let bid = orders_to_make
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Bid))
        .map(|o| o.price)
        .max();

    let ask = orders_to_make
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Ask))
        .map(|o| o.price)
        .min();

    futures::future::try_join(
        exchange_client.make_orders(orders_to_make),
        exchange_client.cancel_orders(orders_to_cancel),
    )
    .await?;

    mutate_state(|state| state.data.latest_bid_and_ask.insert(exchange_id, BidAndAsk { bid, ask }));

    trace!(%exchange_id, orders_made, orders_cancelled, "Market maker ran successfully");
    Ok(())
}

fn mark_market_maker_complete(exchange_id: &ExchangeId) {
    mutate_state(|state| state.data.market_makers_in_progress.remove(exchange_id));
}

fn calculate_orders_to_make(
    open_orders: &[Order],
    latest_price: u64,
    previous_bid_and_ask: BidAndAsk,
    config: &Config,
) -> Vec<MakeOrderRequest> {
    let max_open_bid = open_orders
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Bid))
        .map(|o| o.price)
        .max();

    let min_open_ask = open_orders
        .iter()
        .filter(|o| matches!(o.order_type, OrderType::Ask))
        .map(|o| o.price)
        .min();

    let bid_accepted = previous_bid_and_ask
        .bid
        .map_or(false, |prev| max_open_bid.unwrap_or_default() < prev);

    let ask_accepted = previous_bid_and_ask
        .ask
        .map_or(false, |prev| min_open_ask.unwrap_or(u64::MAX) > prev);

    let mut orders_to_make = Vec::new();
    if bid_accepted {
        if let Some(ask_price) = min_open_ask.and_then(|a| a.checked_sub(config.price_increment)) {
            if ask_price >= max_open_bid.unwrap_or_default() + (2 * config.price_increment) {
                orders_to_make.push(MakeOrderRequest {
                    order_type: OrderType::Ask,
                    price: ask_price,
                    amount: config.order_size,
                });
            }
        }
    }

    if ask_accepted {
        if let Some(bid_price) = max_open_bid.and_then(|b| b.checked_add(config.price_increment)) {
            if bid_price <= min_open_ask.unwrap_or(u64::MAX) - (2 * config.price_increment) {
                orders_to_make.push(MakeOrderRequest {
                    order_type: OrderType::Bid,
                    price: bid_price,
                    amount: config.order_size,
                });
            }
        }
    }

    if !orders_to_make.is_empty() {
        orders_to_make
    } else {
        let target_orders = build_orders(latest_price, config);

        let mut bids_to_make = BTreeMap::new();
        let mut asks_to_make = BTreeMap::new();

        for order in target_orders {
            match order.order_type {
                OrderType::Bid => bids_to_make.insert(order.price, order),
                OrderType::Ask => asks_to_make.insert(order.price, order),
            };
        }

        let mut open_bids = BTreeMap::new();
        let mut open_asks = BTreeMap::new();
        for order in open_orders {
            match order.order_type {
                OrderType::Bid => {
                    *open_bids
                        .entry(round_to_nearest_increment(order.price, config.price_increment))
                        .or_default() += order.amount
                }
                OrderType::Ask => {
                    *open_asks
                        .entry(round_to_nearest_increment(order.price, config.price_increment))
                        .or_default() += order.amount
                }
            }
        }

        exclude_open_orders(&mut bids_to_make, open_bids, config.price_increment, config.min_order_size);
        exclude_open_orders(&mut asks_to_make, open_asks, config.price_increment, config.min_order_size);

        bids_to_make
            .into_values()
            .chain(asks_to_make.into_values())
            .sorted_unstable_by_key(|o| Reverse(latest_price.abs_diff(o.price)))
            .take(config.max_orders_to_make_per_iteration as usize)
            .collect()
    }
}

fn exclude_open_orders(
    orders_to_make: &mut BTreeMap<u64, MakeOrderRequest>,
    open_orders: BTreeMap<u64, u64>,
    increment: u64,
    min_order_size: u64,
) {
    for (price, amount) in open_orders {
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

    #[test]
    fn calculate_orders_to_make() {
        let config = Config {
            enabled: true,
            price_increment: 10,
            order_size: 50,
            min_order_size: 25,
            max_buy_price: 100,
            min_sell_price: 0,
            min_orders_per_direction: 3,
            max_orders_per_direction: 5,
            max_orders_to_make_per_iteration: 2,
            max_orders_to_cancel_per_iteration: 2,
        };

        let open_orders = vec![
            Order {
                order_type: OrderType::Bid,
                id: "1".to_string(),
                price: 10,
                amount: 10,
            },
            Order {
                order_type: OrderType::Bid,
                id: "2".to_string(),
                price: 10,
                amount: 20,
            },
            Order {
                order_type: OrderType::Bid,
                id: "3".to_string(),
                price: 20,
                amount: 20,
            },
            Order {
                order_type: OrderType::Bid,
                id: "4".to_string(),
                price: 30,
                amount: 30,
            },
            Order {
                order_type: OrderType::Ask,
                id: "5".to_string(),
                price: 40,
                amount: 25,
            },
            Order {
                order_type: OrderType::Ask,
                id: "6".to_string(),
                price: 50,
                amount: 30,
            },
            Order {
                order_type: OrderType::Ask,
                id: "7".to_string(),
                price: 60,
                amount: 20,
            },
            Order {
                order_type: OrderType::Ask,
                id: "8".to_string(),
                price: 60,
                amount: 10,
            },
        ];

        let orders_to_make = super::calculate_orders_to_make(&open_orders, 30, BidAndAsk::default(), &config);

        let expected = vec![
            MakeOrderRequest {
                order_type: OrderType::Bid,
                price: 20,
                amount: 30,
            },
            MakeOrderRequest {
                order_type: OrderType::Ask,
                price: 40,
                amount: 25,
            },
        ];

        assert_eq!(orders_to_make, expected);
    }

    #[test]
    fn with_previous_bid() {
        let config = Config {
            enabled: true,
            price_increment: 10,
            order_size: 50,
            min_order_size: 25,
            max_buy_price: 100,
            min_sell_price: 0,
            min_orders_per_direction: 3,
            max_orders_per_direction: 5,
            max_orders_to_make_per_iteration: 2,
            max_orders_to_cancel_per_iteration: 2,
        };

        let open_orders = vec![
            Order {
                order_type: OrderType::Bid,
                id: "1".to_string(),
                price: 10,
                amount: 10,
            },
            Order {
                order_type: OrderType::Bid,
                id: "2".to_string(),
                price: 10,
                amount: 20,
            },
            Order {
                order_type: OrderType::Ask,
                id: "5".to_string(),
                price: 40,
                amount: 25,
            },
            Order {
                order_type: OrderType::Ask,
                id: "6".to_string(),
                price: 50,
                amount: 30,
            },
            Order {
                order_type: OrderType::Ask,
                id: "7".to_string(),
                price: 60,
                amount: 20,
            },
            Order {
                order_type: OrderType::Ask,
                id: "8".to_string(),
                price: 60,
                amount: 10,
            },
        ];

        let orders_to_make = super::calculate_orders_to_make(
            &open_orders,
            40,
            BidAndAsk {
                bid: Some(30),
                ask: None,
            },
            &config,
        );

        let expected = vec![MakeOrderRequest {
            order_type: OrderType::Ask,
            price: 30,
            amount: 50,
        }];

        assert_eq!(orders_to_make, expected);
    }

    #[test]
    fn with_previous_ask() {
        let config = Config {
            enabled: true,
            price_increment: 10,
            order_size: 50,
            min_order_size: 25,
            max_buy_price: 100,
            min_sell_price: 0,
            min_orders_per_direction: 3,
            max_orders_per_direction: 5,
            max_orders_to_make_per_iteration: 2,
            max_orders_to_cancel_per_iteration: 2,
        };

        let open_orders = vec![
            Order {
                order_type: OrderType::Bid,
                id: "1".to_string(),
                price: 10,
                amount: 10,
            },
            Order {
                order_type: OrderType::Bid,
                id: "2".to_string(),
                price: 10,
                amount: 20,
            },
            Order {
                order_type: OrderType::Bid,
                id: "3".to_string(),
                price: 20,
                amount: 20,
            },
            Order {
                order_type: OrderType::Bid,
                id: "4".to_string(),
                price: 30,
                amount: 30,
            },
            Order {
                order_type: OrderType::Ask,
                id: "7".to_string(),
                price: 60,
                amount: 20,
            },
            Order {
                order_type: OrderType::Ask,
                id: "8".to_string(),
                price: 60,
                amount: 10,
            },
        ];

        let orders_to_make = super::calculate_orders_to_make(
            &open_orders,
            30,
            BidAndAsk {
                bid: None,
                ask: Some(40),
            },
            &config,
        );

        let expected = vec![MakeOrderRequest {
            order_type: OrderType::Bid,
            price: 40,
            amount: 50,
        }];

        assert_eq!(orders_to_make, expected);
    }
}
