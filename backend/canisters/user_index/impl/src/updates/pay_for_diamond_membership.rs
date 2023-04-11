use crate::guards::caller_is_openchat_user;
use crate::timer_job_types::{RecurringDiamondMembershipPayment, TimerJob};
use crate::{mutate_state, read_state, RuntimeState, ONE_GB};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{BlockIndex, TransferError};
use local_user_index_canister::{DiamondMembershipPaymentReceived, Event};
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::error;
use types::{Cryptocurrency, UserId, ICP};
use user_index_canister::pay_for_diamond_membership::{Response::*, *};
use utils::time::DAY_IN_MS;

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn pay_for_diamond_membership(args: Args) -> Response {
    let user_id = match read_state(|state| {
        let caller = state.env.caller();
        state.data.users.get_by_principal(&caller).map(|u| u.user_id)
    }) {
        Some(u) => u,
        _ => return UserNotFound,
    };

    pay_for_diamond_membership_impl(args, user_id, true).await
}

pub(crate) async fn pay_for_diamond_membership_impl(args: Args, user_id: UserId, manual_payment: bool) -> Response {
    if let Err(response) = mutate_state(|state| prepare(&args, user_id, state)) {
        return response;
    };

    let c2c_args = user_canister::c2c_charge_user_account::Args {
        amount: ICP::from_e8s(args.expected_price_e8s),
    };

    let response = match user_canister_c2c_client::c2c_charge_user_account(user_id.into(), &c2c_args).await {
        Ok(result) => match result {
            user_canister::c2c_charge_user_account::Response::Success(block_index) => {
                mutate_state(|state| process_charge(args, user_id, block_index, manual_payment, state))
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

fn prepare(args: &Args, user_id: UserId, runtime_state: &mut RuntimeState) -> Result<(), Response> {
    let diamond_membership = runtime_state.data.users.diamond_membership_details_mut(&user_id).unwrap();
    if diamond_membership.payment_in_progress() {
        Err(PaymentAlreadyInProgress)
    } else if let Err(result) = diamond_membership.can_extend(runtime_state.env.now()) {
        Err(CannotExtend(result))
    } else if args.token != Cryptocurrency::InternetComputer {
        Err(CurrencyNotSupported)
    } else if args.expected_price_e8s != args.duration.icp_price_e8s() {
        Err(PriceMismatch)
    } else {
        diamond_membership.set_payment_in_progress(true);
        Ok(())
    }
}

fn process_charge(
    args: Args,
    user_id: UserId,
    block_index: BlockIndex,
    manual_payment: bool,
    runtime_state: &mut RuntimeState,
) -> Response {
    if let Some(diamond_membership) = runtime_state.data.users.diamond_membership_details_mut(&user_id) {
        let now = runtime_state.env.now();
        diamond_membership.add_payment(
            args.token,
            args.expected_price_e8s,
            block_index,
            args.duration,
            args.recurring,
            manual_payment,
            now,
        );

        let expires_at = diamond_membership.expires_at().unwrap();
        let result = diamond_membership.hydrate(now).unwrap();

        runtime_state.data.users.mark_updated(&user_id, now);
        runtime_state.push_event_to_local_user_index(
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
                send_bot_message: true,
            }),
        );

        if let Some(user) = runtime_state.data.users.get_by_user_id(&user_id) {
            runtime_state.data.storage_index_user_sync_queue.push(UserConfig {
                user_id: user.principal,
                byte_limit: ONE_GB,
            });
            crate::jobs::sync_users_to_storage_index::start_job_if_required(runtime_state);
        }

        if args.recurring {
            runtime_state.data.timer_jobs.enqueue_job(
                TimerJob::RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment { user_id }),
                expires_at.saturating_sub(DAY_IN_MS),
                now,
            );
        }

        if manual_payment {
            runtime_state.data.diamond_membership_payment_metrics.manual_payments_taken += 1;
        } else {
            runtime_state.data.diamond_membership_payment_metrics.recurring_payments_taken += 1;
        }
        if let Some(amount) = runtime_state
            .data
            .diamond_membership_payment_metrics
            .amount_raised
            .iter_mut()
            .find(|(t, _)| *t == args.token)
            .map(|(_, amount)| amount)
        {
            *amount += args.expected_price_e8s as u128;
        } else {
            runtime_state
                .data
                .diamond_membership_payment_metrics
                .amount_raised
                .push((args.token, args.expected_price_e8s as u128));
        }

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
