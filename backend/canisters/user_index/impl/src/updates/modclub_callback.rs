use crate::{
    guards::caller_is_modclub,
    model::{
        reported_messages::{
            build_message_to_reporter, build_message_to_sender, rule_id_from_modclub_rule_id, RecordOutcomeResult,
            ReportOutcome, ViolatedRules,
        },
        user::{SuspensionDetails, SuspensionDuration},
    },
    mutate_state,
    timer_job_types::{SetUserSuspended, TimerJob},
    RuntimeState,
};
use candid::Nat;
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use ic_cdk_macros::update;
use msgpack::serialize_then_unwrap;
use tracing::error;
use types::{CanisterId, ChannelId, MessageId, MessageIndex, UserId};
use user_index_canister::modclub_callback::*;
use utils::consts::OPENCHAT_BOT_USER_ID;
use x509_parser::num_bigint::BigUint;

#[update(guard = "caller_is_modclub")]
#[trace]
fn modclub_callback(args: Args) {
    ic_cdk::spawn(handle_modclub_callback(args))
}

async fn handle_modclub_callback(args: Args) {
    mutate_state(|state| {
        let now = state.env.now();
        let outcome = ReportOutcome {
            timestamp: now,
            approved: nat_to_u32(args.approvedCount),
            rejected: nat_to_u32(args.rejectedCount),
            violated_rules: args
                .violatedRules
                .into_iter()
                .map(|v| ViolatedRules {
                    rule_id: rule_id_from_modclub_rule_id(v.id),
                    rejected: nat_to_u32(v.rejectionCount),
                })
                .collect(),
        };

        let report_index = args.sourceId.parse().unwrap();

        let reported_message = match state.data.reported_messages.record_outcome(report_index, outcome) {
            RecordOutcomeResult::Success(m) => m,
            RecordOutcomeResult::OutcomeExists(_) => {
                error!(?report_index, "Modclub outcome already recorded");
                return;
            }
            RecordOutcomeResult::ReportNotFound => {
                error!(?report_index, "Report not found");
                return;
            }
        };

        if reported_message.rejected() {
            // If the message has been judged to break the platform rules then delete it
            if !reported_message.already_deleted {
                match reported_message.chat_id {
                    types::Chat::Group(group_id) => delete_group_message(
                        group_id.into(),
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        &mut state.data.fire_and_forget_handler,
                    ),
                    types::Chat::Channel(community_id, channel_id) => delete_channel_message(
                        community_id.into(),
                        channel_id,
                        reported_message.thread_root_message_index,
                        reported_message.message_id,
                        &mut state.data.fire_and_forget_handler,
                    ),
                    // But don't delete messages from direct chats - the reporter can delete it themselves
                    types::Chat::Direct(_) => (),
                }
            }

            // Suspend the sender for a day or permanently for repeat or egregious violations
            if let Some(details) =
                should_suspend_sender(reported_message.sender, reported_message.outcome.as_ref().unwrap(), state)
            {
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SetUserSuspended(SetUserSuspended {
                        user_id: reported_message.sender,
                        duration: details.duration.into(),
                        reason: details.reason,
                        suspended_by: details.suspended_by,
                    }),
                    now,
                    now,
                );
            }

            // Inform the sender that their message has violated the platform rules
            state.push_event_to_local_user_index(reported_message.sender, build_message_to_sender(&reported_message));
        }

        // Inform each reporter of the outcome of their report
        for reporter in reported_message.reports.keys() {
            state.push_event_to_local_user_index(*reporter, build_message_to_reporter(&reported_message, *reporter));
        }

        // Push message + outcome to the platform moderators group
        if let Some(_platform_moderators_group) = state.data.platform_moderators_group {}
    });
}

fn delete_channel_message(
    canister_id: CanisterId,
    channel_id: ChannelId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = community_canister::delete_messages::Args {
        channel_id,
        thread_root_message_index,
        message_ids: vec![message_id],
        as_platform_moderator: Some(true),
    };
    fire_and_forget_handler.send(
        canister_id,
        "delete_messages_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}

fn delete_group_message(
    canister_id: CanisterId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = group_canister::delete_messages::Args {
        thread_root_message_index,
        message_ids: vec![message_id],
        as_platform_moderator: Some(true),
        correlation_id: 0,
    };
    fire_and_forget_handler.send(
        canister_id,
        "delete_messages_msgpack".to_string(),
        serialize_then_unwrap(args),
    );
}

fn nat_to_u32(num: Nat) -> u32 {
    let bi: BigUint = num.into();
    bi.to_u32_digits()[0]
}

fn should_suspend_sender(sender: UserId, outcome: &ReportOutcome, state: &RuntimeState) -> Option<SuspensionDetails> {
    if let Some(user) = state.data.users.get_by_user_id(&sender) {
        if let Some(current_suspension_details) = user.suspension_details.as_ref() {
            if matches!(current_suspension_details.duration, SuspensionDuration::Indefinitely) {
                return None;
            }
        }

        let (duration, reason) = if outcome.unanimous_rejection_decision(Some(1)) {
            (SuspensionDuration::Indefinitely, "Unanimous decision by Modclub moderators that the message depicts, promotes or attempts to normalize chld sexual abuse".to_string())
        } else if user
            .reported_messages
            .iter()
            .filter_map(|i| state.data.reported_messages.get(*i))
            .filter(|r| r.rejected())
            .count()
            >= 2
        {
            (
                SuspensionDuration::Indefinitely,
                "Multiple violations of the platform rules".to_string(),
            )
        } else {
            (
                SuspensionDuration::Duration(1000 * 3600 * 24),
                "Violation of platform rules".to_string(),
            )
        };

        Some(SuspensionDetails {
            timestamp: state.env.now(),
            duration,
            reason,
            suspended_by: OPENCHAT_BOT_USER_ID,
        })
    } else {
        None
    }
}

// fn push_message_to_platform_moderators_group(
//     canister_id: CanisterId,
//     chat_id: MultiUserChat,
//     thread_root_message_index: Option<MessageIndex>,
//     event_index: EventIndex,
//     reason_code: u32,
//     notes: String,
//     fire_and_forget_handler: &mut FireAndForgetHandler,
// ) {
//     let args = group_canister::c2c_report_message_v2::Args {
//         user_id: OPENCHAT_BOT_USER_ID,
//         chat_id,
//         thread_root_message_index,
//         event_index,
//         reason_code,
//         notes: Some(notes),
//     };
//     fire_and_forget_handler.send(
//         canister_id,
//         "c2c_report_message_v2_msgpack".to_string(),
//         serialize_then_unwrap(args),
//     );
// }
