use crate::guards::caller_is_openchat_user;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::timer_job_types::{RecurringDiamondMembershipPayment, TimerJob};
use crate::{mutate_state, read_state, RuntimeState, ONE_GB};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{DAY_IN_MS, HOUR_IN_MS, SNS_GOVERNANCE_CANISTER_ID};
use event_store_producer::EventBuilder;
use ic_ledger_types::{BlockIndex, TransferError};
use icrc_ledger_types::icrc1;
use icrc_ledger_types::icrc1::account::Account;
use jwt::{sign_and_encode_token, Claims};
use local_user_index_canister::{DiamondMembershipPaymentReceived, UserIndexToLocalUserIndexEvent};
use rand::Rng;
use serde::Serialize;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::error;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, UserId, ICP};
use user_index_canister::pay_for_diamond_membership::{Response::*, *};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn pay_for_diamond_membership(args: Args) -> Response {
    let Some(user_id) = read_state(|state| {
        let caller = state.env.caller();
        state.data.users.get_by_principal(&caller).map(|u| u.user_id)
    }) else {
        return UserNotFound;
    };

    pay_for_diamond_membership_impl(args, user_id, true).await
}

pub(crate) async fn pay_for_diamond_membership_impl(args: Args, user_id: UserId, manual_payment: bool) -> Response {
    if let Err(response) = mutate_state(|state| prepare(&args, user_id, state)) {
        return response;
    };

    let c2c_args = user_canister::c2c_charge_user_account::Args {
        ledger_canister_id: args.token.ledger_canister_id().unwrap(),
        amount: ICP::from_e8s(args.expected_price_e8s - args.token.fee().unwrap() as u64),
    };

    let response = match user_canister_c2c_client::c2c_charge_user_account(user_id.into(), &c2c_args).await {
        Ok(result) => match result {
            user_canister::c2c_charge_user_account::Response::Success(block_index) => {
                mutate_state(|state| process_charge(args, user_id, block_index, manual_payment, state))
            }
            user_canister::c2c_charge_user_account::Response::TransferError(error) => process_error(error),
            user_canister::c2c_charge_user_account::Response::TransferErrorV2(error) => process_error_v2(error),
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

fn prepare(args: &Args, user_id: UserId, state: &mut RuntimeState) -> Result<(), Response> {
    let diamond_membership = state.data.users.diamond_membership_details_mut(&user_id).unwrap();
    let fees = &state.data.diamond_membership_fees;
    if diamond_membership.payment_in_progress() {
        Err(PaymentAlreadyInProgress)
    } else if diamond_membership.is_lifetime_diamond_member() {
        Err(AlreadyLifetimeDiamondMember)
    } else {
        match args.token {
            Cryptocurrency::CHAT => {
                if args.expected_price_e8s != fees.chat_price_e8s(args.duration) {
                    return Err(PriceMismatch);
                }
            }
            Cryptocurrency::InternetComputer => {
                if args.expected_price_e8s != fees.icp_price_e8s(args.duration) {
                    return Err(PriceMismatch);
                }
            }
            _ => return Err(CurrencyNotSupported),
        }

        diamond_membership.set_payment_in_progress(true);
        Ok(())
    }
}

fn process_charge(
    args: Args,
    user_id: UserId,
    block_index: BlockIndex,
    manual_payment: bool,
    state: &mut RuntimeState,
) -> Response {
    let recurring = args.recurring && !args.duration.is_lifetime();
    let now = state.env.now();

    state.data.event_store_client.push(
        EventBuilder::new("diamond_membership_payment", now)
            .with_user(user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&PayForDiamondMembershipEventPayload {
                token: args.token.token_symbol().to_string(),
                amount: args.expected_price_e8s,
                duration: args.duration.to_string(),
                recurring: args.recurring,
                manual_payment,
            })
            .build(),
    );

    if let Some(diamond_membership) = state.data.users.diamond_membership_details_mut(&user_id) {
        diamond_membership.add_payment(
            args.token.clone(),
            args.expected_price_e8s,
            block_index,
            args.duration,
            recurring,
            manual_payment,
            now,
        );

        let expires_at = diamond_membership.expires_at().unwrap();
        let result = diamond_membership.hydrate(now).unwrap();

        state.data.users.mark_updated(&user_id, now);
        state.push_event_to_all_local_user_indexes(
            UserIndexToLocalUserIndexEvent::DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived {
                user_id,
                timestamp: now,
                expires_at,
                token: args.token.clone(),
                amount_e8s: args.expected_price_e8s,
                block_index,
                duration: args.duration,
                recurring,
                send_bot_message: true,
            }),
            None,
        );

        if let Some(user) = state.data.users.get_by_user_id(&user_id) {
            state.data.storage_index_user_sync_queue.push(UserConfig {
                user_id: user.principal,
                byte_limit: ONE_GB,
            });
            crate::jobs::sync_users_to_storage_index::try_run_now(state);
        }

        if recurring {
            state.data.timer_jobs.enqueue_job(
                TimerJob::RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment { user_id }),
                expires_at.saturating_sub(DAY_IN_MS),
                now,
            );
        }

        let transaction_fee = args.token.fee().unwrap() as u64;

        let amount_to_treasury = args.expected_price_e8s - (2 * transaction_fee);

        let now_nanos = state.env.now_nanos();

        let (recipient_account, reason) = if let Some(neuron_account) = matches!(
            (&args.token, args.duration),
            (Cryptocurrency::InternetComputer, DiamondMembershipPlanDuration::Lifetime)
        )
        .then_some(state.data.nns_neuron_account())
        .flatten()
        {
            (neuron_account, PendingPaymentReason::TopUpNeuron)
        } else if matches!(args.token, Cryptocurrency::CHAT) {
            (Account::from(SNS_GOVERNANCE_CANISTER_ID), PendingPaymentReason::Burn)
        } else {
            (Account::from(SNS_GOVERNANCE_CANISTER_ID), PendingPaymentReason::Treasury)
        };

        let treasury_payment = PendingPayment {
            amount: amount_to_treasury,
            currency: args.token.clone(),
            timestamp: now_nanos,
            recipient_account,
            memo: state.env.rng().gen(),
            reason,
        };
        state.queue_payment(treasury_payment);

        if manual_payment {
            state.data.diamond_membership_payment_metrics.manual_payments_taken += 1;
        } else {
            state.data.diamond_membership_payment_metrics.recurring_payments_taken += 1;
        }
        if let Some(amount) = state
            .data
            .diamond_membership_payment_metrics
            .amount_raised
            .iter_mut()
            .find(|(t, _)| *t == args.token)
            .map(|(_, amount)| amount)
        {
            *amount += args.expected_price_e8s as u128;
        } else {
            state
                .data
                .diamond_membership_payment_metrics
                .amount_raised
                .push((args.token, args.expected_price_e8s as u128));
        }

        let claims = Claims::new(now + HOUR_IN_MS, "diamond_membership".to_string(), result.clone());
        let proof_jwt =
            sign_and_encode_token(state.data.oc_key_pair.secret_key_der(), claims, state.env.rng()).unwrap_or_default();

        Success(SuccessResult {
            expires_at: result.expires_at,
            pay_in_chat: result.pay_in_chat,
            subscription: result.subscription,
            proof_jwt,
        })
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

fn process_error_v2(transfer_error: icrc1::transfer::TransferError) -> Response {
    match transfer_error {
        icrc1::transfer::TransferError::InsufficientFunds { balance } => InsufficientFunds(balance.0.try_into().unwrap()),
        error => TransferFailed(format!("{error:?}")),
    }
}

#[derive(Serialize)]
pub(crate) struct PayForDiamondMembershipEventPayload {
    pub token: String,
    pub amount: u64,
    pub duration: String,
    pub recurring: bool,
    pub manual_payment: bool,
}
