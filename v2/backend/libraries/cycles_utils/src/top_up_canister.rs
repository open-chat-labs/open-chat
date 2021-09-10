use ic_cdk::api::call::CallResult;
use types::CanisterId;

pub async fn top_up_canister(canister_id: CanisterId, amount: u64) -> CallResult<()> {
    ic_cdk::api::call::call_with_payment(canister_id, "deposit_cycles", (), amount).await
}
