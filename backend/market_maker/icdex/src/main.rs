use candid::Principal;
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::Secp256k1Identity;
use ic_agent::Agent;
use icdex_market_maker::ICDex;
use market_maker_core::{log, Config};
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
        increment: 100000,
        order_size: 10000000,
        min_order_size: 1000000,
        max_buy_price: 8000000,
        min_sell_price: 4000000,
        min_orders_per_direction: 5,
        max_orders_per_direction: 10,
        max_orders_to_make_per_iteration: 2,
        max_orders_to_cancel_per_iteration: 2,
        iteration_interval: Duration::from_secs(5),
    };

    log("Initialization complete");

    market_maker_core::run(&icdex, &config).await;
    Ok(())
}
