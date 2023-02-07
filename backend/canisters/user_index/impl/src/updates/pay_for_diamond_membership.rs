use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{BlockIndex, TransferError};
use local_user_index_canister::{DiamondMembershipPaymentReceived, Event};
use tracing::error;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, UserId, ICP};
use user_index_canister::pay_for_diamond_membership::{Response::*, *};

#[update]
#[trace]
async fn pay_for_diamond_membership(args: Args) -> Response {
    let user_id = match mutate_state(|state| prepare(&args, state)) {
        Ok(prepare_result) => prepare_result,
        Err(response) => return response,
    };

    let c2c_args = user_canister::c2c_charge_user_account::Args {
        amount: ICP::from_e8s(args.expected_price_e8s),
    };

    let response = match user_canister_c2c_client::c2c_charge_user_account(user_id.into(), &c2c_args).await {
        Ok(result) => match result {
            user_canister::c2c_charge_user_account::Response::Success(block_index) => {
                mutate_state(|state| process_charge(args, user_id, block_index, state))
            }
            user_canister::c2c_charge_user_account::Response::TransferError(error) => process_error(error),
            user_canister::c2c_charge_user_account::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    };
    if !matches!(response, Success(_)) {
        mutate_state(|state| {
            if let Some(diamond_membership) = state.data.users.diamond_membership_details_mut(&user_id) {
                diamond_membership.set_payment_in_progress(false);
            }
        });
    }
    response
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<UserId, Response> {
    let caller = runtime_state.env.caller();

    let user_id = match runtime_state.data.users.get_by_principal(&caller) {
        Some(u) => u.user_id,
        _ => return Err(UserNotFound),
    };

    let diamond_membership = runtime_state.data.users.diamond_membership_details_mut(&user_id).unwrap();
    if diamond_membership.payment_in_progress() {
        Err(PaymentAlreadyInProgress)
    } else if let Err(result) = diamond_membership.can_extend(runtime_state.env.now()) {
        Err(CannotExtend(result))
    } else if args.token != Cryptocurrency::InternetComputer {
        Err(CurrencyNotSupported)
    } else if args.expected_price_e8s != icp_price_e8s(args.duration) {
        Err(PriceMismatch)
    } else {
        diamond_membership.set_payment_in_progress(true);
        Ok(user_id)
    }
}

fn icp_price_e8s(duration: DiamondMembershipPlanDuration) -> u64 {
    match duration {
        DiamondMembershipPlanDuration::OneMonth => 20_000_000,    // 0.2 ICP
        DiamondMembershipPlanDuration::ThreeMonths => 50_000_000, // 0.5 ICP
        DiamondMembershipPlanDuration::OneYear => 150_000_000,    // 1.5 ICP
    }
}

fn process_charge(args: Args, user_id: UserId, block_index: BlockIndex, runtime_state: &mut RuntimeState) -> Response {
    if let Some(diamond_membership) = runtime_state.data.users.diamond_membership_details_mut(&user_id) {
        let now = runtime_state.env.now();
        diamond_membership.add_payment(
            args.token,
            args.expected_price_e8s,
            block_index,
            args.duration,
            args.recurring,
            now,
        );

        let expires_at = diamond_membership.expires_at().unwrap();
        let result = diamond_membership.hydrate(now).unwrap();

        runtime_state.data.push_event_to_local_user_index(
            user_id,
            Event::DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived {
                user_id,
                timestamp: now,
                expires_at,
                token: args.token,
                amount_e8s: args.expected_price_e8s,
                block_index,
                duration: args.duration,
                recurring: args.recurring,
            }),
        );
        Success(result)
    } else {
        error!(%user_id, "Diamond membership payment taken, but user no longer exists");
        UserNotFound
    }
}

fn process_error(transfer_error: TransferError) -> Response {
    match transfer_error {
        TransferError::InsufficientFunds { balance } => InsufficientFunds(balance.e8s()),
        error => TransferFailed(format!("{error:?}")),
    }
}
