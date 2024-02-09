use crate::guards::caller_is_openchat_user;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::timer_job_types::{RecurringDiamondMembershipPayment, TimerJob};
use crate::{mutate_state, read_state, RuntimeState, ONE_GB};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{BlockIndex, TransferError};
use icrc_ledger_types::icrc1;
use icrc_ledger_types::icrc1::account::Account;
use local_user_index_canister::{DiamondMembershipPaymentReceived, Event};
use rand::Rng;
use serde::Serialize;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::error;
use types::{Cryptocurrency, DiamondMembershipFees, DiamondMembershipPlanDuration, UserId, ICP};
use user_index_canister::pay_for_diamond_membership::{Response::*, *};
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
use utils::time::DAY_IN_MS;

#[update(guard = "caller_is_openchat_user")]
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
    let share_with = referrer_to_share_payment(user_id, state);
    let recurring = args.recurring && !args.duration.is_lifetime();
    let now = state.env.now();

    state.track_event(
        "diamond_membership_payment",
        now,
        Some(user_id),
        PayForDiamondMembershipEventPayload {
            token: args.token.token_symbol().to_string(),
            amount: args.expected_price_e8s,
            duration: args.duration.to_string(),
            recurring: args.recurring,
            manual_payment,
        },
    );

    if let Some(diamond_membership) = state.data.users.diamond_membership_details_mut(&user_id) {
        let has_ever_been_diamond_member = diamond_membership.has_ever_been_diamond_member();

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
            Event::DiamondMembershipPaymentReceived(DiamondMembershipPaymentReceived {
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

        let mut amount_to_treasury = args.expected_price_e8s - (2 * transaction_fee);

        let now_nanos = state.env.now_nanos();

        if let Some(share_with) = share_with {
            let fees = &state.data.diamond_membership_fees;

            let amount_to_referrer = amount_to_referer(&args.token, args.duration, fees);
            amount_to_treasury = amount_to_treasury.saturating_sub(amount_to_referrer + transaction_fee);

            let referral_payment = PendingPayment {
                amount: amount_to_referrer,
                currency: args.token.clone(),
                timestamp: now_nanos,
                recipient_account: Account::from(Principal::from(share_with)),
                memo: state.env.rng().gen(),
                reason: PendingPaymentReason::ReferralReward,
            };
            state.queue_payment(referral_payment);

            state.data.user_referral_leaderboards.add_reward(
                share_with,
                !has_ever_been_diamond_member,
                amount_to_referrer,
                now,
            );
        }

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

        Success(result)
    } else {
        error!(%user_id, "Diamond membership payment taken, but user no longer exists");
        UserNotFound
    }
}

fn referrer_to_share_payment(user_id: UserId, state: &RuntimeState) -> Option<UserId> {
    if let Some(user) = state.data.users.get_by_user_id(&user_id) {
        let now = state.env.now();
        let diamond_membership = &user.diamond_membership_details;
        if let Some(referred_by) = user.referred_by {
            if let Some(referrer) = state.data.users.get_by_user_id(&referred_by) {
                if referrer.diamond_membership_details.is_active(now) {
                    let one_year = DiamondMembershipPlanDuration::OneYear.as_millis();
                    let year_from_joined = user.date_created + one_year;
                    let threshold =
                        if diamond_membership.is_active(now) { diamond_membership.expires_at().unwrap() } else { now };
                    if threshold < year_from_joined {
                        return Some(referred_by);
                    }
                }
            }
        }
    }

    None
}

fn amount_to_referer(token: &Cryptocurrency, duration: DiamondMembershipPlanDuration, fees: &DiamondMembershipFees) -> u64 {
    // The referral reward is only for membership payments for the first year, so if a user pays for
    // lifetime Diamond membership, the referer is rewarded as if they had paid for 1 year.
    let reward_based_on_duration = if matches!(duration, DiamondMembershipPlanDuration::Lifetime) {
        DiamondMembershipPlanDuration::OneYear
    } else {
        duration
    };

    if matches!(token, Cryptocurrency::CHAT) {
        fees.chat_price_e8s(reward_based_on_duration) / 2
    } else {
        fees.icp_price_e8s(reward_based_on_duration) / 2
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
struct PayForDiamondMembershipEventPayload {
    token: String,
    amount: u64,
    duration: String,
    recurring: bool,
    manual_payment: bool,
}
