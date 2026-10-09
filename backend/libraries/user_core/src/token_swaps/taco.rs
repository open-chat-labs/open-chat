use super::swap_client::{SwapClient, SwapSuccess};
use crate::token_swaps::nat_to_u128;
use async_trait::async_trait;
use candid::Nat;
use serde::{Deserialize, Serialize};
use taco_exchange_canister::get_expected_receive_amount_batch_multi_optimal as optimal;
use taco_exchange_canister::{SplitLeg, SwapHop, SwapResult};
use types::icrc1::Account;
use types::{C2CError, CanisterId, TokenInfo};

#[derive(Serialize, Deserialize)]
pub struct TacoExchangeClient {
    swap_canister_id: CanisterId,
    treasury_canister_id: CanisterId,
    input_token: TokenInfo,
    output_token: TokenInfo,
}

impl TacoExchangeClient {
    pub fn new(
        swap_canister_id: CanisterId,
        treasury_canister_id: CanisterId,
        input_token: TokenInfo,
        output_token: TokenInfo,
    ) -> Self {
        TacoExchangeClient {
            swap_canister_id,
            treasury_canister_id,
            input_token,
            output_token,
        }
    }
}

#[async_trait]
impl SwapClient for TacoExchangeClient {
    fn canister_id(&self) -> CanisterId {
        self.swap_canister_id
    }

    fn auto_withdrawals(&self) -> bool {
        // TACO pushes the swap output back to the caller automatically as part
        // of swap_multi_hop / swap_split_routes, so OC's separate withdraw step
        // is a no-op.
        //
        // EVENTUAL-CONSISTENCY NOTE — this is NOT the same guarantee ICPSwap
        // gives. ICPSwap's withdraw() awaits the actual ICRC1 transfer, so the
        // tokens are in the user canister before SuccessResult is returned.
        // TACO's transfer queue is async:
        //
        //   1. swap_multi_hop / swap_split_routes calls treasury.receive
        //      TransferTasks(queue, immediate = false) at the end. The
        //      `immediate` flag is `isInAllowedCanisters(caller)` which is
        //      FALSE for OC user canisters (TACO's allowedCanisters list is
        //      TACO-internal canisters only).
        //   2. With immediate=false, receiveTransferTasks just appends to
        //      transferQueue and sets a 5-second setTimer to drain a batch
        //      via transferTimer(false). See
        //      TACO_Backend/src/exchange/treasury.mo:141-190.
        //   3. swap_multi_hop returns to us as soon as receiveTransferTasks
        //      returns. The actual icrc1_transfer to this canister lands
        //      ~5-10 seconds later when the timer fires.
        //
        // Consequence: when OC reports SuccessResult { amount_out } to the
        // user, the tokens haven't physically arrived yet. The OC frontend
        // reading the wallet balance right after success will briefly see
        // stale state — fixed by a polling withdraw() on the OC side, or by
        // TACO making delivery synchronous for OC user canisters. Both deferred.
        //
        // No correctness issue: TACO's BlocksDone guard makes retries
        // idempotent, and tokens always arrive eventually via the queued
        // transfer.
        true
    }

    async fn deposit_account(&self) -> Result<Account, C2CError> {
        // TACO verifies deposits by inspecting the ledger block, looking for a
        // transfer to its `treasury_principal` (the exchange-treasury canister,
        // NOT the exchange canister itself — see TACO's checkReceive at
        // src/exchange/main.mo line 11235 and the treasury trader's reference
        // at src/swap/taco_swap.mo:19,440).
        Ok(Account {
            owner: self.treasury_canister_id,
            subaccount: None,
        })
    }

    async fn deposit(&self, amount: u128) -> Result<u128, C2CError> {
        // No-op for TACO: block-based verification happens inside the swap call.
        Ok(amount)
    }

    async fn swap(
        &self,
        amount: u128,
        min_amount_out: u128,
        deposit_block_index: Option<u64>,
    ) -> Result<Result<SwapSuccess, String>, C2CError> {
        let block_index = match deposit_block_index {
            Some(b) => b,
            None => return Ok(Err("TACO swap requires a deposit block index".to_string())),
        };

        // OC passes `amount = amount_to_dex - input_token.fee`. The ledger block
        // recorded `amount_to_dex` being transferred. We assume TACO's per-token
        // transfer fee equals the ledger transfer fee.
        let transferred = amount.saturating_add(self.input_token.fee);
        let tfee = self.input_token.fee;
        let usable = transferred.saturating_sub(tfee);
        if usable == 0 {
            return Ok(Err("TACO swap: deposit too small to cover transfer fee".to_string()));
        }

        let token_in = self.input_token.ledger.to_string();
        let token_out = self.output_token.ledger.to_string();

        // Single call: TACO runs the BatchMulti probe grid (10 fractions × top-5
        // routes) AND the 2/3-leg split-route optimizer internally, then returns
        // the chosen plan. Replaces the local build_swap_plan that used to live
        // here (and the parallel TS optimizer in the OC frontend). One source of
        // truth — when TACO tunes the optimizer (different thresholds, smarter
        // pruning), OC picks up the change automatically.
        let plan = taco_exchange_canister_c2c_client::get_expected_receive_amount_batch_multi_optimal(
            self.swap_canister_id,
            (token_in.clone(), token_out.clone(), Nat::from(usable)),
        )
        .await?;

        if plan.legs.is_empty() {
            return Ok(Err(format!("TACO swap: no viable route ({})", plan.route_description)));
        }

        // Defensive clamp on tradingFeeBps in case the canister returns a value
        // outside its enforced [1, 50] range.
        let fee_bps = nat_to_u128(plan.trading_fee_bps).clamp(1, 50);

        // Compute the true amount_in such that the recorded deposit covers
        //   amount_in × (10000 + fee_bps) / 10000 + tfee  ← TACO's checkReceive.
        let amount_in_total = usable.saturating_mul(10000) / (10000 + fee_bps);
        if amount_in_total == 0 {
            return Ok(Err("TACO swap: deposit too small to cover trading fee".to_string()));
        }

        if plan.legs.len() == 1 {
            let leg = &plan.legs[0];
            execute_swap_multi_hop(
                self.swap_canister_id,
                token_in,
                token_out,
                amount_in_total,
                leg.route.clone(),
                min_amount_out,
                block_index,
            )
            .await
        } else {
            let split_legs = make_split_legs_from_optimal(&plan.legs, amount_in_total, min_amount_out);
            execute_swap_split_routes(
                self.swap_canister_id,
                token_in,
                token_out,
                split_legs,
                min_amount_out,
                block_index,
            )
            .await
        }
    }

    async fn withdraw(&self, _successful_swap: bool, amount: u128) -> Result<u128, C2CError> {
        // auto_withdrawals() == true means swap_tokens.rs skips this call.
        Ok(amount)
    }
}

// Map TACO's chosen split-leg plan into the SplitLeg shape swap_split_routes
// expects. Uses remainder-in-last-leg so Σ leg.amount_in == amount_in_total
// exactly (TACO's checkReceive validates this sum against the deposit block).
// Per-leg min_leg_out is pro-rated by bp; sum ≤ min_out_total within
// integer-division floor (TACO's canonical check is the global min anyway).
fn make_split_legs_from_optimal(legs: &[optimal::OptimalSwapLeg], total: u128, min_out_total: u128) -> Vec<SplitLeg> {
    let n = legs.len();
    let mut allocated_in: u128 = 0;
    let mut allocated_min: u128 = 0;
    let mut out = Vec::with_capacity(n);
    for (i, leg) in legs.iter().enumerate() {
        let bp = nat_to_u128(leg.bp.clone());
        let (amount_in, min_leg_out) = if i + 1 == n {
            (
                total.saturating_sub(allocated_in),
                min_out_total.saturating_sub(allocated_min),
            )
        } else {
            let a = total.saturating_mul(bp) / 10000;
            let m = min_out_total.saturating_mul(bp) / 10000;
            allocated_in = allocated_in.saturating_add(a);
            allocated_min = allocated_min.saturating_add(m);
            (a, m)
        };
        out.push(SplitLeg {
            amount_in: amount_in.into(),
            route: leg.route.clone(),
            min_leg_out: min_leg_out.into(),
        });
    }
    out
}

async fn execute_swap_multi_hop(
    canister_id: CanisterId,
    token_in: String,
    token_out: String,
    amount_in: u128,
    route: Vec<SwapHop>,
    min_amount_out: u128,
    block_index: u64,
) -> Result<Result<SwapSuccess, String>, C2CError> {
    let response = taco_exchange_canister_c2c_client::swap_multi_hop(
        canister_id,
        (
            token_in,
            token_out,
            amount_in.into(),
            route,
            min_amount_out.into(),
            block_index.into(),
        ),
    )
    .await?;

    Ok(map_swap_result(response))
}

async fn execute_swap_split_routes(
    canister_id: CanisterId,
    token_in: String,
    token_out: String,
    legs: Vec<SplitLeg>,
    min_amount_out: u128,
    block_index: u64,
) -> Result<Result<SwapSuccess, String>, C2CError> {
    let response = taco_exchange_canister_c2c_client::swap_split_routes(
        canister_id,
        (token_in, token_out, legs, min_amount_out.into(), block_index.into()),
    )
    .await?;

    Ok(map_swap_result(response))
}

fn map_swap_result(result: SwapResult) -> Result<SwapSuccess, String> {
    match result {
        SwapResult::Ok(ok) => Ok(SwapSuccess {
            amount_out: nat_to_u128(ok.amount_out),
            // TACO has already pushed the output to the caller, so OC should
            // consider the withdraw step complete.
            withdrawal_success: Some(true),
        }),
        SwapResult::Err(error) => Err(format!("{error:?}")),
    }
}
