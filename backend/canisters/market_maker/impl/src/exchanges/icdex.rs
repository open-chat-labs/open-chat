use crate::exchanges::Exchange;
use crate::read_state;
use async_trait::async_trait;
use ic_cdk::call::RejectCode;
use icdex_canister::deposit::Token0OrToken1;
use icdex_client::ICDexClient;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use types::{AggregatedOrders, CancelOrderRequest, CanisterId, MakeOrderRequest, Order};

#[async_trait]
impl<M: Fn(MakeOrderRequest) + Send + Sync, C: Fn(CancelOrderRequest) + Send + Sync> Exchange for ICDexClient<M, C> {
    async fn latest_price(&self) -> Result<u64, (RejectCode, String)> {
        self.latest_price().await
    }

    async fn my_open_orders(&self) -> Result<Vec<Order>, (RejectCode, String)> {
        self.my_open_orders().await
    }

    async fn orderbook(&self) -> Result<AggregatedOrders, (RejectCode, String)> {
        self.orderbook().await
    }

    async fn make_orders(&self, orders: Vec<MakeOrderRequest>) -> Result<(), (RejectCode, String)> {
        for order in orders {
            self.make_order(order).await?;
        }
        Ok(())
    }

    async fn cancel_orders(&self, orders: Vec<CancelOrderRequest>) -> Result<(), (RejectCode, String)> {
        for order in orders {
            self.cancel_order(order).await?;
        }
        Ok(())
    }

    async fn account_balances(&self) -> Result<Vec<(CanisterId, u128)>, (RejectCode, String)> {
        self.account_balances().await
    }
}

pub async fn deposit_funds() {
    let (chat_ledger_canister_id, icp_ledger_canister_id, this_canister_id, dex_canister_id, test_mode) = read_state(|state| {
        (
            state.data.chat_ledger_canister_id,
            state.data.icp_ledger_canister_id,
            state.env.canister_id(),
            CanisterId::from_text("52ypw-riaaa-aaaar-qadjq-cai").unwrap(),
            state.data.test_mode,
        )
    });

    let subaccount: [u8; 32] = hex::decode(if test_mode {
        "d56cc65cb00be8eb9be533b3f67ef41f2d9403cffa38d7218a2ec741db58af3b"
    } else {
        "005f6dfd2c9c4f5bb7ec67a4a8ae7e93fc97e4518e865c52d8108e6f4f7fe748"
    })
    .unwrap()
    .try_into()
    .unwrap();

    let to = Account {
        owner: dex_canister_id,
        subaccount: Some(subaccount),
    };

    if let Ok(response) =
        icrc_ledger_canister_c2c_client::icrc1_balance_of(chat_ledger_canister_id, &Account::from(this_canister_id)).await
    {
        let amount = u128::try_from(response.0).unwrap().saturating_sub(100_000);

        if amount > 0 {
            let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
                chat_ledger_canister_id,
                &TransferArg {
                    from_subaccount: None,
                    to,
                    fee: None,
                    created_at_time: None,
                    memo: None,
                    amount: amount.into(),
                },
            )
            .await;

            let deposit_args = (Token0OrToken1::Token0, amount.saturating_sub(100_000).into(), None);
            let _ = icdex_canister_c2c_client::deposit(dex_canister_id, deposit_args).await;
        }
    }

    if let Ok(response) =
        icrc_ledger_canister_c2c_client::icrc1_balance_of(icp_ledger_canister_id, &Account::from(this_canister_id)).await
    {
        let amount = u128::try_from(response.0).unwrap().saturating_sub(10_000);

        if amount > 0 {
            let _ = icrc_ledger_canister_c2c_client::icrc1_transfer(
                icp_ledger_canister_id,
                &TransferArg {
                    from_subaccount: None,
                    to,
                    fee: None,
                    created_at_time: None,
                    memo: None,
                    amount: amount.into(),
                },
            )
            .await;

            let deposit_args = (Token0OrToken1::Token1, amount.saturating_sub(10_000).into(), None);
            let _ = icdex_canister_c2c_client::deposit(dex_canister_id, deposit_args).await;
        }
    }
}
