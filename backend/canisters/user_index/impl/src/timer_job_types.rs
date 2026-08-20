use crate::model::moderation;
use crate::model::reported_messages::build_restoration_message_to_sender;
use crate::updates::c2c_report_message::process_report;
use crate::updates::pay_for_diamond_membership::pay_for_diamond_membership_impl;
use crate::updates::suspend_user::suspend_user_impl;
use crate::updates::unsuspend_user::unsuspend_user_impl;
use crate::{mutate_state, read_state};
use canister_timer_jobs::Job;
use constants::{CHAT_LEDGER_CANISTER_ID, ICP_LEDGER_CANISTER_ID, MINUTE_IN_MS, SECOND_IN_MS};
use ic_ledger_types::Tokens;
use local_user_index_canister::{OpenChatBotMessageV2, UserIndexEvent};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use types::{
    ChatId, CommunityId, DiamondMembershipFees, DiamondMembershipPlanDuration, MessageContentInitial, Milliseconds,
    TextContent, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    RecurringDiamondMembershipPayment(RecurringDiamondMembershipPayment),
    SetUserSuspended(SetUserSuspended),
    SetUserSuspendedInGroup(SetUserSuspendedInGroup),
    SetUserSuspendedInCommunity(SetUserSuspendedInCommunity),
    UnsuspendUser(UnsuspendUser),
    ProcessReportClassification(ProcessReportClassification),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecurringDiamondMembershipPayment {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetUserSuspendedInGroup {
    pub user_id: UserId,
    pub group: ChatId,
    pub suspended: bool,
    pub attempt: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetUserSuspendedInCommunity {
    pub user_id: UserId,
    pub community: CommunityId,
    pub suspended: bool,
    pub attempt: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SetUserSuspended {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
    pub reason: String,
    pub suspended_by: UserId,
    #[serde(default)]
    pub attempt: usize,
    // Set by `downgrade_suspension_to_upheld_violation`, the one automated path which
    // deliberately REPLACES an indefinite suspension with a lesser one. The commit-time I1a
    // re-check then only has to confirm no MANUAL suspension arrived meanwhile: a downgrade
    // by definition fails the escalation rule the other automated paths are held to.
    #[serde(default)]
    pub downgrade: bool,
    // The report whose DETECTION caused this suspension, when the sanction must evaporate
    // under any human verdict on that report: the commit re-check refuses to apply once the
    // report is resolved, because the verdict arms are the sole authority for post-verdict
    // sanctions (I1b). None for verdict-aligned suspensions (upheld-violation, downgrade,
    // verdict-backed attempt sanctions), which must survive their report being resolved.
    #[serde(default)]
    pub caused_by_report: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UnsuspendUser {
    pub user_id: UserId,
    // Set when the job was scheduled to lift a durational suspension when it expires: the
    // unsuspend then only applies if that same suspension is still the one in force. Without
    // this, a suspension replaced by a later (eg. indefinite CSAM) one is still lifted when
    // the original expiry falls due.
    #[serde(default)]
    pub expected_suspension_timestamp: Option<TimestampMillis>,
    #[serde(default)]
    pub attempt: usize,
    // Set when a Dismissed verdict is reversing this report's sanction: the sender is told
    // what happened once the unsuspend has actually landed, not when it was enqueued
    #[serde(default)]
    pub restoration_report_index: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessReportClassification {
    pub report_index: u64,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::RecurringDiamondMembershipPayment(job) => job.execute(),
            TimerJob::SetUserSuspended(job) => job.execute(),
            TimerJob::SetUserSuspendedInGroup(job) => job.execute(),
            TimerJob::SetUserSuspendedInCommunity(job) => job.execute(),
            TimerJob::UnsuspendUser(job) => job.execute(),
            TimerJob::ProcessReportClassification(job) => job.execute(),
        }
    }
}

impl Job for ProcessReportClassification {
    fn execute(self) {
        ic_cdk::futures::spawn(process_report(self.report_index));
    }
}

impl Job for RecurringDiamondMembershipPayment {
    fn execute(self) {
        if let Some((duration, pay_in_chat, fees)) = read_state(|state| {
            let now = state.env.now();
            let fees = state.data.diamond_membership_fees.clone();
            state
                .data
                .users
                .get_by_user_id(&self.user_id)
                .map(|u| &u.diamond_membership_details)
                .filter(|d| d.is_recurring_payment_due(now))
                .and_then(|d| {
                    DiamondMembershipPlanDuration::try_from(d.subscription())
                        .ok()
                        .map(|duration| (duration, d.pay_in_chat(), fees))
                })
        }) {
            ic_cdk::futures::spawn_migratory(pay_for_diamond_membership(self.user_id, duration, fees, pay_in_chat));
        }

        async fn pay_for_diamond_membership(
            user_id: UserId,
            duration: DiamondMembershipPlanDuration,
            fees: DiamondMembershipFees,
            pay_in_chat: bool,
        ) {
            use user_index_canister::pay_for_diamond_membership::*;

            let price_e8s = if pay_in_chat { fees.chat_price_e8s(duration) } else { fees.icp_price_e8s(duration) };

            let args = Args {
                duration,
                ledger: if pay_in_chat { CHAT_LEDGER_CANISTER_ID } else { ICP_LEDGER_CANISTER_ID },
                expected_price_e8s: price_e8s,
                recurring: true,
            };

            match pay_for_diamond_membership_impl(args, user_id, false).await {
                Response::InsufficientFunds(balance) => {
                    mutate_state(|state| {
                        state.push_event_to_local_user_index(
                            user_id,
                            UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                                user_id,
                                thread_root_message_id: None,
                                content: MessageContentInitial::Text(TextContent {
                                    text: format!(
                                        "Failed to take payment for Diamond membership due to insufficient funds.
Payment amount: {}
Balance: {}

If you would like to extend your Diamond membership you will need to top up your account and pay manually.",
                                        Tokens::from_e8s(price_e8s),
                                        Tokens::from_e8s(balance)
                                    ),
                                }),
                                mentioned: Vec::new(),
                            })),
                        );
                        state
                            .data
                            .diamond_membership_payment_metrics
                            .recurring_payments_failed_due_to_insufficient_funds += 1;
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

impl Job for SetUserSuspended {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(suspend_user(self));

        // A suspension which silently fails to apply (eg. the user canister is stopped mid
        // upgrade) leaves a sanctioned user active, so retry rather than dropping it
        async fn suspend_user(job: SetUserSuspended) {
            let response = suspend_user_impl(
                job.user_id,
                job.duration,
                job.reason.clone(),
                job.suspended_by,
                job.downgrade,
                job.caused_by_report,
            )
            .await;
            if let user_index_canister::suspend_user::Response::InternalError(error) = response {
                if job.attempt < 10 {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::SetUserSuspended(SetUserSuspended {
                                attempt: job.attempt + 1,
                                ..job
                            }),
                            now + (30 * SECOND_IN_MS),
                            now,
                        );
                    });
                } else {
                    error!(user_id = %job.user_id, ?error, "Failed to suspend user after 10 attempts");
                }
            }
        }
    }
}

impl Job for SetUserSuspendedInGroup {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(set_user_suspended_in_group(
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

impl Job for SetUserSuspendedInCommunity {
    fn execute(self) {
        ic_cdk::futures::spawn_migratory(set_user_suspended_in_community(
            self.user_id,
            self.community,
            self.suspended,
            self.attempt,
        ));

        async fn set_user_suspended_in_community(user_id: UserId, community: CommunityId, suspended: bool, attempt: usize) {
            let args = community_canister::c2c_set_user_suspended::Args { user_id, suspended };
            if community_canister_c2c_client::c2c_set_user_suspended(community.into(), &args)
                .await
                .is_err()
                && attempt < 10
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::SetUserSuspendedInCommunity(SetUserSuspendedInCommunity {
                            user_id,
                            community,
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
    fn execute(self) {
        // Only lift the suspension this job was scheduled for. A durational suspension can
        // have been replaced by a later one (eg. an indefinite CSAM suspension) before its
        // expiry falls due, and lifting that one would silently unsuspend a sanctioned user.
        if let Some(expected) = self.expected_suspension_timestamp {
            let still_current = read_state(|state| {
                state
                    .data
                    .users
                    .get_by_user_id(&self.user_id)
                    .and_then(|u| u.suspension_details.as_ref())
                    .is_some_and(|d| d.timestamp == expected)
            });
            if !still_current {
                info!(user_id = %self.user_id, "Skipping expiry of a suspension which is no longer in force");
                return;
            }
        } else if !read_state(|state| moderation::suspension_is_automated(self.user_id, state)) {
            // A moderation-driven reversal (no expiry timestamp) may only lift what automation
            // applied. Re-checked here as well as in `unsuspend_sender`: the two are separated
            // by the timer tick, and a manual suspension imposed in that gap must survive
            // (I1a). The user is told no unsuspension happened, because none did (I5).
            info!(user_id = %self.user_id, "Skipping automated unsuspend: a manual suspension is in force");
            notify_sender_of_restoration(self.restoration_report_index, self.user_id, false);
            return;
        }

        ic_cdk::futures::spawn_migratory(unsuspend_user(self));

        async fn unsuspend_user(job: UnsuspendUser) {
            match unsuspend_user_impl(job.user_id).await {
                user_index_canister::unsuspend_user::Response::InternalError(error) if job.attempt < 10 => {
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::UnsuspendUser(UnsuspendUser {
                                attempt: job.attempt + 1,
                                ..job
                            }),
                            now + (30 * SECOND_IN_MS),
                            now,
                        );
                    });
                    error!(user_id = %job.user_id, ?error, "Failed to unsuspend user, retrying");
                }
                user_index_canister::unsuspend_user::Response::InternalError(error) => {
                    error!(user_id = %job.user_id, ?error, "Failed to unsuspend user after 10 attempts");
                    // The message is restored either way, but the account is still suspended:
                    // say so rather than claiming an unsuspension which did not happen
                    notify_sender_of_restoration(job.restoration_report_index, job.user_id, false);
                }
                user_index_canister::unsuspend_user::Response::Success => {
                    notify_sender_of_restoration(job.restoration_report_index, job.user_id, true)
                }
                // The user was not suspended after all: the restoration still happened, but
                // claiming an unsuspension would be wrong
                _ => notify_sender_of_restoration(job.restoration_report_index, job.user_id, false),
            }
        }

        fn notify_sender_of_restoration(report_index: Option<u64>, user_id: UserId, unsuspended: bool) {
            let Some(report_index) = report_index else {
                return;
            };
            mutate_state(|state| {
                if let Some(report) = state.data.reported_messages.get(report_index) {
                    let event = build_restoration_message_to_sender(&report.clone(), unsuspended);
                    state.push_event_to_local_user_index(user_id, event);
                }
            });
        }
    }
}
