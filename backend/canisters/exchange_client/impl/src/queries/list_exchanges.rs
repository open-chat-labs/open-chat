use exchange_client_canister::list_exchanges::*;
use exchange_client_canister::{ExchangeInfo, ICDEX_EXCHANGE_ID};
use ic_cdk_macros::query;

#[query]
fn list_exchanges(_args: Args) -> Response {
    Response {
        exchanges: vec![ExchangeInfo {
            id: ICDEX_EXCHANGE_ID,
            name: "ICDex".to_string(),
        }],
    }
}
