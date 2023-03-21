use crate::exchanges::Exchange;
use async_trait::async_trait;
use candid::{CandidType, Nat, Principal};
use canister_client::make_c2c_call;
use exchange_client_canister::{CancelOrderRequest, MakeOrderRequest, OrderType};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_icrc1::endpoints::TransferArg;
use ic_ledger_types::{AccountIdentifier, Subaccount};
use serde::Serialize;
use types::CanisterId;

pub struct ICDexClient {
    this_canister_id: CanisterId,
    dex_canister_id: CanisterId,
    icp_ledger_canister_id: CanisterId,
    chat_ledger_canister_id: CanisterId,
    unit_size: u64,
}

impl ICDexClient {
    pub fn new(
        this_canister_id: CanisterId,
        dex_canister_id: CanisterId,
        icp_ledger_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        unit_size: u64,
    ) -> ICDexClient {
        ICDexClient {
            this_canister_id,
            dex_canister_id,
            icp_ledger_canister_id,
            chat_ledger_canister_id,
            unit_size,
        }
    }

    // TODO remove the `unwrap`s
    pub async fn make_order(&self, caller: Principal, order: MakeOrderRequest) -> CallResult<()> {
        let subaccount = subaccount(caller);
        let from_account = AccountIdentifier::new(&self.this_canister_id, &Subaccount(subaccount));

        let get_account_response: CallResult<(ic_icrc1::Account, String, Nat, Subaccount)> = make_c2c_call(
            self.dex_canister_id,
            "getTxAccount",
            from_account.to_string().as_str(),
            candid::encode_one,
            #[allow(clippy::redundant_closure)]
            |r| candid::decode_args(r),
        )
        .await;

        let (account, nonce) = get_account_response.map(|(a, _, n, _)| (a, n))?;

        let ledger_canister_id = match order.order_type {
            OrderType::Bid => self.icp_ledger_canister_id,
            OrderType::Ask => self.chat_ledger_canister_id,
        };
        let ledger_client = ic_icrc1_client::ICRC1Client {
            ledger_canister_id,
            runtime: ic_icrc1_client_cdk::CdkRuntime {},
        };
        ledger_client
            .transfer(TransferArg {
                from_subaccount: Some(subaccount),
                to: account,
                fee: None,
                created_at_time: None,
                memo: None,
                amount: order.amount.into(),
            })
            .await
            .map_err(|(code, msg)| (RejectionCode::from(code), msg))?
            .unwrap();

        let quantity = match order.order_type {
            OrderType::Bid => OrderPriceQuantity::Buy(order.amount.into(), 0.into()),
            OrderType::Ask => OrderPriceQuantity::Sell(order.amount.into()),
        };
        // Convert the price per whole CHAT into the price per `unit_size` of CHAT
        let price = (order.price * self.unit_size / 100000000).into();

        let args: (OrderPrice, ICDexOrderType, Option<u128>, Option<Nat>, Option<Vec<u8>>) =
            (OrderPrice { price, quantity }, ICDexOrderType::Limit, None, Some(nonce), None);

        make_c2c_call(self.dex_canister_id, "trade", args, candid::encode_args, |r| {
            candid::decode_args(r)
        })
        .await
    }

    pub async fn cancel_order(&self, caller: Principal, order: CancelOrderRequest) -> CallResult<()> {
        let subaccount = subaccount(caller);
        let id = hex::decode(order.id).unwrap();

        make_c2c_call(
            self.dex_canister_id,
            "cancelByTxid",
            (id, Some(subaccount)),
            candid::encode_args,
            |r| candid::decode_args(r),
        )
        .await
    }
}

#[async_trait]
impl Exchange for ICDexClient {
    async fn make_orders(&self, caller: Principal, mut orders: Vec<MakeOrderRequest>) {
        if let Some(order) = orders.pop() {
            assert!(orders.is_empty());

            let _ = self.make_order(caller, order).await;
        }
    }

    async fn cancel_orders(&self, caller: Principal, mut orders: Vec<CancelOrderRequest>) {
        if let Some(order) = orders.pop() {
            assert!(orders.is_empty());

            let _ = self.cancel_order(caller, order).await;
        }
    }
}

fn subaccount(principal: Principal) -> [u8; 32] {
    let mut subaccount = [0; 32];
    let principal = principal.as_slice();
    subaccount[0] = principal.len().try_into().unwrap();
    subaccount[1..1 + principal.len()].copy_from_slice(principal);
    subaccount
}

#[derive(CandidType)]
struct OrderPrice {
    price: Nat,
    quantity: OrderPriceQuantity,
}

#[derive(CandidType)]
enum OrderPriceQuantity {
    Buy(Nat, Nat),
    Sell(Nat),
}

#[derive(CandidType, Serialize)]
enum ICDexOrderType {
    #[serde(rename = "LMT")]
    Limit,
}
