use async_trait::async_trait;
use candid::Principal;
use exchange_client_canister::{CancelOrderRequest, MakeOrderRequest};

pub mod icdex;

#[async_trait]
pub trait Exchange {
    async fn make_orders(&self, caller: Principal, orders: Vec<MakeOrderRequest>);
    async fn cancel_orders(&self, caller: Principal, orders: Vec<CancelOrderRequest>);
}
