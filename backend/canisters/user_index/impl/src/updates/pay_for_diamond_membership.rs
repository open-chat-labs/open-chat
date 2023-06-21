use crate::guards::caller_is_openchat_user;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::timer_job_types::{RecurringDiamondMembershipPayment, TimerJob};
use crate::{mutate_state, read_state, RuntimeState, ONE_GB};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{BlockIndex, TransferError};
use local_user_index_canister::{DiamondMembershipPaymentReceived, Event};
use rand::Rng;
use storage_index_canister::add_or_update_users::UserConfig;
use tracing::error;
use types::{Cryptocurrency, DiamondMembershipPlanDuration, UserId, ICP};
use user_index_canister::pay_for_diamond_membership::{Response::*, *};
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
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

fn prepare(args: &Args, user_id: UserId, state: &mut RuntimeState) -> Result<(), Response> {
    let diamond_membership = state.data.users.diamond_membership_details_mut(&user_id).unwrap();
    if diamond_membership.payment_in_progress() {
        Err(PaymentAlreadyInProgress)
    } else if let Err(result) = diamond_membership.can_extend(state.env.now()) {
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
    state: &mut RuntimeState,
) -> Response {
    let share_with = referrer_to_share_payment(user_id, state);

    if let Some(diamond_membership) = state.data.users.diamond_membership_details_mut(&user_id) {
        let now = state.env.now();
        let has_ever_been_diamond_member = diamond_membership.has_ever_been_diamond_member();

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

        state.data.users.mark_updated(&user_id, now);
        state.push_event_to_local_user_index(
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
        crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);

        if let Some(user) = state.data.users.get_by_user_id(&user_id) {
            state.data.storage_index_user_sync_queue.push(UserConfig {
                user_id: user.principal,
                byte_limit: ONE_GB,
            });
            crate::jobs::sync_users_to_storage_index::start_job_if_required(state);
        }

        if args.recurring {
            state.data.timer_jobs.enqueue_job(
                TimerJob::RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment { user_id }),
                expires_at.saturating_sub(DAY_IN_MS),
                now,
            );
        }

        let mut amount_to_treasury = args.expected_price_e8s - (2 * Cryptocurrency::InternetComputer.fee() as u64);

        let now_nanos = state.env.now_nanos();

        if let Some(share_with) = share_with {
            let amount_to_referrer = args.expected_price_e8s / 2;
            amount_to_treasury -= amount_to_referrer;
            amount_to_treasury -= Cryptocurrency::InternetComputer.fee() as u64;

            let referral_payment = PendingPayment {
                amount: amount_to_referrer,
                currency: Cryptocurrency::InternetComputer,
                timestamp: now_nanos,
                recipient: share_with.into(),
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

        let treasury_payment = PendingPayment {
            amount: amount_to_treasury,
            currency: Cryptocurrency::InternetComputer,
            timestamp: now_nanos,
            recipient: SNS_GOVERNANCE_CANISTER_ID,
            memo: state.env.rng().gen(),
            reason: PendingPaymentReason::Treasury,
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

fn process_error(transfer_error: TransferError) -> Response {
    match transfer_error {
        TransferError::InsufficientFunds { balance } => InsufficientFunds(balance.e8s()),
        error => TransferFailed(format!("{error:?}")),
    }
}
