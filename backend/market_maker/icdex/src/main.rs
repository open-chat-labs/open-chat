use candid::Principal;
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::Secp256k1Identity;
use ic_agent::Agent;
use icdex_market_maker::ICDex;
use market_maker_core::{log, Config};
use std::str::FromStr;
use std::time::Duration;

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;

#[tokio::main]
async fn main() -> Result<(), Error> {
    dotenv::dotenv()?;

    let ic_identity_pem = dotenv::var("IC_IDENTITY_PEM")?;
    let ic_url = "https://icp-api.io";
    let dex_canister_id = Principal::from_text(dotenv::var("DEX_CANISTER_ID")?).unwrap();
    let exchange_client_canister_id = Principal::from_text(dotenv::var("EXCHANGE_CLIENT_CANISTER")?).unwrap();

    let transport = ReqwestHttpReplicaV2Transport::create(ic_url)?;
    let timeout = Duration::from_secs(60 * 5);

    let agent = Agent::builder()
        .with_transport(transport)
        .with_identity(Secp256k1Identity::from_pem(ic_identity_pem.as_bytes()).unwrap())
        .with_ingress_expiry(Some(timeout))
        .build()?;

    let icdex = ICDex::new(agent, dex_canister_id, exchange_client_canister_id);

    let config = Config {
        increment: dotenv::var("PRICE_INCREMENT").map_or(50000, |s| u64::from_str(&s).unwrap()),
        order_size: dotenv::var("ORDER_SIZE").map_or(10000000, |s| u64::from_str(&s).unwrap()),
        min_order_size: dotenv::var("MIN_ORDER_SIZE").map_or(1000000, |s| u64::from_str(&s).unwrap()),
        max_buy_price: dotenv::var("MAX_BUY_PRICE").map_or(8000000, |s| u64::from_str(&s).unwrap()),
        min_sell_price: dotenv::var("MIN_SELL_PRICE").map_or(4000000, |s| u64::from_str(&s).unwrap()),
        min_orders_per_direction: dotenv::var("MIN_ORDERS_PER_DIRECTION").map_or(5, |s| u32::from_str(&s).unwrap()),
        max_orders_per_direction: dotenv::var("MAX_ORDERS_PER_DIRECTION").map_or(5, |s| u32::from_str(&s).unwrap()),
        max_orders_to_make_per_iteration: dotenv::var("MAX_ORDERS_TO_MAKE_PER_ITERATION")
            .map_or(5, |s| u32::from_str(&s).unwrap()),
        max_orders_to_cancel_per_iteration: dotenv::var("MAX_ORDERS_TO_CANCEL_PER_ITERATION")
            .map_or(5, |s| u32::from_str(&s).unwrap()),
        iteration_interval: Duration::from_secs(5),
    };

    log("Initialization complete");

    market_maker_core::run(&icdex, &config).await;
    Ok(())
}
