use crate::guards::caller_is_owner;
use crate::model::p2p_swaps::P2PSwap;
use crate::timer_job_types::NotifyEscrowCanisterOfDepositJob;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use escrow_canister::deposit_subaccount;
use ic_cdk_macros::update;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use types::{
    AcceptP2PSwapResult, AcceptSwapSuccess, CanisterId, Chat, EventIndex, P2PSwapLocation, P2PSwapStatus, ReserveP2PSwapResult,
    ReserveP2PSwapSuccess, TimestampMillis, UserId,
};
use user_canister::accept_p2p_swap::{Response::*, *};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};
use utils::consts::MEMO_P2P_SWAP_ACCEPT;
use utils::time::NANOS_PER_MILLISECOND;

#[update(guard = "caller_is_owner")]
#[trace]
async fn accept_p2p_swap(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        reserve_success,
        now,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let content = reserve_success.content;
    let transfer_result = match icrc_ledger_canister_c2c_client::icrc1_transfer(
        content.token1.ledger,
        &TransferArg {
            from_subaccount: None,
            to: Account {
                owner: escrow_canister_id,
                subaccount: Some(deposit_subaccount(my_user_id, content.swap_id)),
            },
            fee: Some(content.token1.fee.into()),
            created_at_time: Some(now * NANOS_PER_MILLISECOND),
            memo: Some(MEMO_P2P_SWAP_ACCEPT.to_vec().into()),
            amount: (content.token1_amount + content.token1.fee).into(),
        },
    )
    .await
    {
        Ok(Ok(index_nat)) => {
            let index: u64 = index_nat.0.try_into().unwrap();
            Ok(index)
        }
        Ok(Err(error)) => {
            if matches!(error, TransferError::InsufficientFunds { .. }) {
                Err(InsufficientFunds)
            } else {
                Err(InternalError(format!("{error:?}")))
            }
        }
        Err(error) => Err(InternalError(format!("{error:?}"))),
    };

    match transfer_result {
        Ok(index) => {
            mutate_state(|state| {
                state.data.p2p_swaps.add(P2PSwap {
                    id: content.swap_id,
                    location: P2PSwapLocation::from_message(Chat::Direct(args.user_id.into()), None, args.message_id),
                    created_by: reserve_success.created_by,
                    created: reserve_success.created,
                    token0: content.token0,
                    token0_amount: content.token0_amount,
                    token1: content.token1,
                    token1_amount: content.token1_amount,
                    expires_at: content.expires_at,
                });
                if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
                    let now = state.env.now();
                    if let AcceptP2PSwapResult::Success(status) =
                        chat.events.accept_p2p_swap(my_user_id, None, args.message_id, index, now)
                    {
                        state.data.user_canister_events_queue.push(
                            args.user_id.into(),
                            UserCanisterEvent::P2PSwapStatusChange(Box::new(P2PSwapStatusChange {
                                message_id: args.message_id,
                                status: P2PSwapStatus::Accepted(status),
                            })),
                        );
                        crate::jobs::push_user_canister_events::start_job_if_required(state);
                    }
                }
            });
            NotifyEscrowCanisterOfDepositJob::run(content.swap_id);
            Success(AcceptSwapSuccess { token1_txn_in: index })
        }
        Err(response) => {
            mutate_state(|state| {
                if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
                    let now = state.env.now();
                    chat.events.unreserve_p2p_swap(my_user_id, None, args.message_id, now);
                }
            });
            response
        }
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    reserve_success: ReserveP2PSwapSuccess,
    now: TimestampMillis,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();
        match chat
            .events
            .reserve_p2p_swap(my_user_id, None, args.message_id, EventIndex::default(), now)
        {
            ReserveP2PSwapResult::Success(reserve_success) => Ok(PrepareResult {
                my_user_id,
                escrow_canister_id: state.data.escrow_canister_id,
                reserve_success,
                now,
            }),
            ReserveP2PSwapResult::Failure(status) => Err(Box::new(StatusError(status.into()))),
            ReserveP2PSwapResult::SwapNotFound => Err(Box::new(SwapNotFound)),
        }
    } else {
        Err(Box::new(ChatNotFound))
    }
}
