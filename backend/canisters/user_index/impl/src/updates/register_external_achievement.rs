use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use icrc_ledger_types::icrc2::transfer_from::TransferFromArgs;
use tracing::error;
use types::{CanisterId, Cryptocurrency, TimestampNanos};
use user_index_canister::register_external_achievement::{Response::*, *};
use user_index_canister::ExternalAchievementInitial;

const CHIT_PER_CHAT: u128 = 5000;
const E8S_PER_CHAT: u128 = 100_000_000;
const MIN_REWARD: u32 = 5000;
const MIN_AWARDS: u32 = 200;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn register_external_achievement(args: Args) -> Response {
    let result = match read_state(|state| prepare(&args, state)) {
        Ok(r) => r,
        Err(_) => return Success, // Exit early
    };

    let chit_budget = args.max_awards * args.chit_reward;

    let payment_block_index = if !result.test_mode {
        // Try to make the CHAT transfer from the given user's wallet
        let from: Principal = args.submitted_by.into();
        let amount = ((chit_budget as u128) * E8S_PER_CHAT).div_ceil(CHIT_PER_CHAT);
        let transfer_args = TransferFromArgs {
            spender_subaccount: None,
            from: from.into(),
            to: result.this_canister_id.into(),
            amount: amount.into(),
            fee: Cryptocurrency::CHAT.fee().map(|fee| fee.into()),
            memo: None,
            created_at_time: Some(result.now_nanos),
        };

        match icrc2_transfer_from(Cryptocurrency::CHAT.ledger_canister_id().unwrap(), &transfer_args).await {
            Ok(block_index) => Some(block_index),
            Err(message) => {
                error!(message);
                return Success; // Exit early
            }
        }
    } else {
        None
    };

    mutate_state(|state| {
        // Record the achievement
        state.data.external_achievements.set(
            ExternalAchievementInitial {
                id: args.id,
                name: args.name,
                logo: args.logo,
                url: args.url,
                canister_id: args.canister_id,
                chit_reward: args.chit_reward,
                expires: args.expires,
                chit_budget,
                payment_block_index,
                submitted_by: args.submitted_by,
            },
            state.env.now(),
        );

        // TODO: Create a timer for when the achievement expires
        // 1. Refund any unspent CHAT
        // 2. Clear the awarded users HashSet
    });

    Success
}

struct PrepareResult {
    test_mode: bool,
    this_canister_id: CanisterId,
    now_nanos: TimestampNanos,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, ()> {
    if state
        .data
        .external_achievements
        .iter()
        .any(|(id, a)| a.name == args.name || *id == args.id)
        || args.chit_reward < MIN_REWARD
        || args.max_awards < MIN_AWARDS
    {
        return Err(());
    }

    Ok(PrepareResult {
        test_mode: state.data.test_mode,
        this_canister_id: state.env.canister_id(),
        now_nanos: state.env.now_nanos(),
    })
}

async fn icrc2_transfer_from(ledger_canister_id: CanisterId, transfer_args: &TransferFromArgs) -> Result<u64, String> {
    match icrc_ledger_canister_c2c_client::icrc2_transfer_from(ledger_canister_id, transfer_args).await {
        Ok(Ok(block_index)) => Ok(block_index.0.try_into().unwrap()),
        Ok(Err(err)) => Err(format!("Error calling 'icrc2_transfer_from': {err:?}")),
        Err(error) => Err(format!("IC error calling 'icrc2_transfer_from': {error:?}")),
    }
}
