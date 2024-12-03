use crate::{mutate_state, State};
use ic_ledger_types::{AccountIdentifier, BlockIndex, Memo, Subaccount, Timestamp, Tokens, TransferArgs};
use std::time::Duration;
use tracing::{error, info};
use types::{CanisterId, TimestampMillis};
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_secs(300);
const MEMO_TOP_UP_CANISTER: Memo = Memo(0x50555054); // == 'TPUP'

pub fn start_job() {
    run_now_then_interval(INTERVAL, run);
}

fn run() {
    match mutate_state(get_next_action) {
        Action::BurnIcp(burn) => ic_cdk::spawn(burn_icp(burn)),
        Action::NotifyTopUp(notify) => ic_cdk::spawn(notify_cmc(notify)),
        Action::None => {}
    }
}

enum Action {
    BurnIcp(BurnIcpDetails),
    NotifyTopUp(NotifyTopUpDetails),
    None,
}

struct BurnIcpDetails {
    amount: Tokens,
    this_canister_id: CanisterId,
    ledger: CanisterId,
    cmc: CanisterId,
    now: TimestampMillis,
}

struct NotifyTopUpDetails {
    this_canister_id: CanisterId,
    cmc: CanisterId,
    block_index: BlockIndex,
}

fn get_next_action(state: &mut State) -> Action {
    if let Some(block_index) = state.data.cycles_top_up_pending_notification.take() {
        Action::NotifyTopUp(NotifyTopUpDetails {
            this_canister_id: state.env.canister_id(),
            cmc: state.data.cycles_minting_canister,
            block_index,
        })
    } else {
        let cycles_balance = state.env.cycles_balance();

        // Burn ICP into cycles whenever the cycles balance is < 10 * min_cycles_balance
        if cycles_balance < 10 * state.data.min_cycles_balance {
            Action::BurnIcp(BurnIcpDetails {
                amount: state.data.icp_burn_amount,
                this_canister_id: state.env.canister_id(),
                ledger: state.data.ledger_canister,
                cmc: state.data.cycles_minting_canister,
                now: state.env.now(),
            })
        } else {
            Action::None
        }
    }
}

async fn burn_icp(burn_details: BurnIcpDetails) {
    info!(%burn_details.amount, "Burning ICP into cycles");

    match icp_ledger_canister_c2c_client::transfer(
        burn_details.ledger,
        &TransferArgs {
            memo: MEMO_TOP_UP_CANISTER,
            amount: burn_details.amount,
            fee: ic_ledger_types::DEFAULT_FEE,
            from_subaccount: None,
            to: AccountIdentifier::new(&burn_details.cmc, &Subaccount::from(burn_details.this_canister_id)),
            created_at_time: Some(Timestamp {
                timestamp_nanos: burn_details.now * 1_000_000,
            }),
        },
    )
    .await
    {
        Ok(Ok(block_index)) => {
            info!(block_index, "Transferred ICP to CMC");
            notify_cmc(NotifyTopUpDetails {
                this_canister_id: burn_details.this_canister_id,
                cmc: burn_details.cmc,
                block_index,
            })
            .await;
        }
        Ok(Err(err)) => {
            error!(?err, "Failed to burn ICP into cycles");
        }
        Err((code, message)) => {
            error!(?code, message, "Failed to burn ICP into cycles");
        }
    }
}

async fn notify_cmc(notify_details: NotifyTopUpDetails) {
    let response = cycles_minting_canister_c2c_client::notify_top_up(
        notify_details.cmc,
        &cycles_minting_canister::notify_top_up::Args {
            block_index: notify_details.block_index,
            canister_id: notify_details.this_canister_id,
        },
    )
    .await;

    match response {
        Ok(Ok(cycles)) => {
            info!(cycles, "Canister topped up with cycles");
        }
        err => {
            error!(?err, "Failed to notify the CMC");
            mutate_state(|state| state.data.cycles_top_up_pending_notification = Some(notify_details.block_index));
        }
    }
}
