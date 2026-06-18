use crate::HopDetail;
use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

// Candid signature (positional args):
//   getExpectedReceiveAmountBatchMulti :
//     (vec record { tokenSell : text; tokenBuy : text; amountSell : nat },
//      nat)
//     -> (vec record { routes : vec QuoteRoute })
//   where each QuoteRoute now carries tradingFeeBps (the live ICPfee snapshot
//   used by the simulation that produced this route).
pub type Args = (Vec<Request>, Nat);

pub type Response = Vec<RequestResponse>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Request {
    #[serde(rename = "tokenSell")]
    pub token_sell: String,
    #[serde(rename = "tokenBuy")]
    pub token_buy: String,
    #[serde(rename = "amountSell")]
    pub amount_sell: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct RequestResponse {
    pub routes: Vec<QuoteRoute>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct QuoteRoute {
    #[serde(rename = "expectedBuyAmount")]
    pub expected_buy_amount: Nat,
    pub fee: Nat,
    #[serde(rename = "priceImpact")]
    pub price_impact: f64,
    #[serde(rename = "routeDescription")]
    pub route_description: String,
    #[serde(rename = "canFulfillFully")]
    pub can_fulfill_fully: bool,
    #[serde(rename = "potentialOrderDetails")]
    pub potential_order_details: Option<PotentialOrderDetails>,
    #[serde(rename = "hopDetails")]
    pub hop_details: Vec<HopDetail>,
    #[serde(rename = "routeTokens")]
    pub route_tokens: Vec<String>,
    #[serde(rename = "tradingFeeBps")]
    pub trading_fee_bps: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PotentialOrderDetails {
    pub amount_init: Nat,
    pub amount_sell: Nat,
}
