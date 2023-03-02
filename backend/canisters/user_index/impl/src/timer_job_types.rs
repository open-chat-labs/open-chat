use crate::updates::pay_for_diamond_membership::{icp_price_e8s, pay_for_diamond_membership_impl};
use crate::updates::suspend_user::suspend_user_impl;
use crate::updates::unsuspend_user::unsuspend_user_impl;
use crate::{mutate_state, read_state};
use canister_timer_jobs::Job;
use ic_ledger_types::Tokens;
use local_user_index_canister::OpenChatBotMessage;
use serde::{Deserialize, Serialize};
use types::{ChatId, Cryptocurrency, DiamondMembershipPlanDuration, MessageContent, Milliseconds, TextContent, UserId};
use utils::time::{MINUTE_IN_MS, SECOND_IN_MS};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment),
    DismissPlatformModerator(DismissPlatformModerator),
    SetUserSuspended(SetUserSuspended),
    SetUserSuspendedInGroup(SetUserSuspendedInGroup),
    UnsuspendUser(UnsuspendUser),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecurringDiamondMembershipPayment {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DismissPlatformModerator {
    pub user_id: UserId,
    pub group_id: ChatId,
    pub attempt: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetUserSuspendedInGroup {
    pub user_id: UserId,
    pub group: ChatId,
    pub suspended: bool,
    pub attempt: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetUserSuspended {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
    pub reason: String,
    pub suspended_by: UserId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UnsuspendUser {
    pub user_id: UserId,
}

impl Job for TimerJob {
    fn execute(&self) {
        match self {
            TimerJob::RecurringDiamondMembershipPayment(job) => job.execute(),
            TimerJob::DismissPlatformModerator(job) => job.execute(),
            TimerJob::SetUserSuspended(job) => job.execute(),
            TimerJob::SetUserSuspendedInGroup(job) => job.execute(),
            TimerJob::UnsuspendUser(job) => job.execute(),
        }
    }
}

impl Job for RecurringDiamondMembershipPayment {
    fn execute(&self) {
        if let Some(duration) = read_state(|state| {
            let now = state.env.now();
            state
                .data
                .users
                .get_by_user_id(&self.user_id)
                .map(|u| &u.diamond_membership_details)
                .filter(|d| d.is_recurring_payment_due(now))
                .and_then(|d| d.latest_duration())
        }) {
            ic_cdk::spawn(pay_for_diamond_membership(self.user_id, duration));
        }

        async fn pay_for_diamond_membership(user_id: UserId, duration: DiamondMembershipPlanDuration) {
            use local_user_index_canister::Event as LocalUserIndexEvent;
            use user_index_canister::pay_for_diamond_membership::*;

            let price_e8s = icp_price_e8s(duration);

            let args = Args {
                duration,
                token: Cryptocurrency::InternetComputer,
                expected_price_e8s: price_e8s,
                recurring: true,
            };

            match pay_for_diamond_membership_impl(args, user_id).await {
                Response::InsufficientFunds(balance) => {
                    mutate_state(|state| {
                        state.data.push_event_to_local_user_index(
                            user_id,
                            LocalUserIndexEvent::OpenChatBotMessage(OpenChatBotMessage {
                                user_id,
                                message: MessageContent::Text(TextContent {
                                    text: format!(
                                        "Failed to take payment for Diamond membership due to insufficient funds.\
Payment amount: {}\
Balance: {}\
\
If you would like to extend your Diamond membership you will need to top up your account and pay manually.",
                                        Tokens::from_e8s(price_e8s).to_string(),
                                        Tokens::from_e8s(balance).to_string()
                                    ),
                                }),
                            }),
                        )
                    });
                }
                Response::InternalError(_) => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment { user_id }),
                            now + 10 * MINUTE_IN_MS,
                            now,
                        )
                    });
                }
                _ => {}
            }
        }
    }
}

impl Job for DismissPlatformModerator {
    fn execute(&self) {
        ic_cdk::spawn(dismiss_platform_moderator(self.user_id, self.group_id, self.attempt));

        async fn dismiss_platform_moderator(user_id: UserId, group_id: ChatId, attempt: usize) {
            let c2c_args = group_canister::c2c_dismiss_super_admin::Args {
                user_id,
                correlation_id: 0,
            };
            if group_canister_c2c_client::c2c_dismiss_super_admin(group_id.into(), &c2c_args)
                .await
                .is_err()
                && attempt < 10
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::DismissPlatformModerator(DismissPlatformModerator {
                            user_id,
                            group_id,
                            attempt: attempt + 1,
                        }),
                        now + (30 * SECOND_IN_MS), // Try again in 30 seconds
                        now,
                    );
                });
            }
        }
    }
}

impl Job for SetUserSuspended {
    fn execute(&self) {
        ic_cdk::spawn(suspend_user(
            self.user_id,
            self.duration,
            self.reason.clone(),
            self.suspended_by,
        ));

        async fn suspend_user(user_id: UserId, duration: Option<Milliseconds>, reason: String, suspended_by: UserId) {
            suspend_user_impl(user_id, duration, reason, suspended_by).await;
        }
    }
}

impl Job for SetUserSuspendedInGroup {
    fn execute(&self) {
        ic_cdk::spawn(set_user_suspended_in_group(
            self.user_id,
            self.group,
            self.suspended,
            self.attempt,
        ));

        async fn set_user_suspended_in_group(user_id: UserId, group: ChatId, suspended: bool, attempt: usize) {
            let args = group_canister::c2c_set_user_suspended::Args { user_id, suspended };
            if group_canister_c2c_client::c2c_set_user_suspended(group.into(), &args)
                .await
                .is_err()
                && attempt < 10
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::SetUserSuspendedInGroup(SetUserSuspendedInGroup {
                            user_id,
                            group,
                            suspended,
                            attempt: attempt + 1,
                        }),
                        now + (30 * SECOND_IN_MS), // Try again in 30 seconds
                        now,
                    );
                });
            }
        }
    }
}

impl Job for UnsuspendUser {
    fn execute(&self) {
        ic_cdk::spawn(unsuspend_user(self.user_id));

        async fn unsuspend_user(user_id: UserId) {
            unsuspend_user_impl(user_id).await;
        }
    }
}
