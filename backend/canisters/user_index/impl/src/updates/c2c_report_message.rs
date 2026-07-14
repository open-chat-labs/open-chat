use crate::{
    RuntimeState,
    guards::caller_is_user_canister_or_group_index,
    model::moderation::{self, ModerationAlert},
    model::reported_messages::{
        AddReportArgs, AddReportResult, AutomatedOutcome, ModerationAction, RecordOutcomeResult, build_message_to_reporter,
        build_message_to_sender,
    },
    mutate_state, read_state,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use group_community_common::openai_moderation;
use tracing::error;
use types::{Chat, ModerationCategories};
use user_index_canister::c2c_report_message::{Response::*, *};

#[update(guard = "caller_is_user_canister_or_group_index", msgpack = true)]
#[trace]
fn c2c_report_message(args: Args) -> Response {
    match mutate_state(|state| add_report(&args, state)) {
        Ok(report_index) => {
            ic_cdk::futures::spawn(process_report(args, report_index));
            Success
        }
        Err(response) => response,
    }
}

fn add_report(args: &Args, state: &mut RuntimeState) -> Result<u64, Response> {
    let add_report_args = AddReportArgs {
        chat_id: args.chat_id,
        thread_root_message_index: args.thread_root_message_index,
        message_index: args.message.message_index,
        message_id: args.message.message_id,
        sender: args.message.sender,
        already_deleted: args.already_deleted,
        reporter: args.reporter,
        timestamp: state.env.now(),
    };
    match state.data.reported_messages.add_report(add_report_args) {
        AddReportResult::New(report_index) => {
            // Record the reported message against the sender's user record
            state.data.users.push_reported_message(args.message.sender, report_index);
            Ok(report_index)
        }
        AddReportResult::ExistingOutcome(report_index) => {
            // Queue a message from the OC bot to the reporter describing what happened
            let reported_message = state.data.reported_messages.get(report_index).unwrap();
            state.push_event_to_local_user_index(args.reporter, build_message_to_reporter(reported_message, args.reporter));
            Err(Success)
        }
        AddReportResult::ExistingPending => Err(Success),
        AddReportResult::AlreadyReportedByUser => Err(AlreadyReported),
    }
}

async fn process_report(args: Args, report_index: u64) {
    let api_key = read_state(|state| state.data.openai_api_key.clone());

    let input = args.message.content.moderation_input();
    let mut categories = ModerationCategories::default();

    if let Some(api_key) = api_key
        && !input.is_empty()
    {
        match openai_moderation::moderate_input(&api_key, &input).await {
            Ok(result) => categories = result,
            Err(error) => error!(?error, "Failed to classify reported message"),
        }
    }

    mutate_state(|state| handle_moderation_result(args, report_index, categories, state));
}

fn handle_moderation_result(args: Args, report_index: u64, categories: ModerationCategories, state: &mut RuntimeState) {
    let now = state.env.now();
    let is_csam = categories.contains(ModerationCategories::SEXUAL_MINORS);

    let action = if is_csam {
        ModerationAction::AutoSanctioned
    } else if categories.is_empty() || categories.intersects(human_review_categories()) {
        // If the message wasn't flagged, the report may still be valid for a reason the API
        // cannot evaluate (eg. scam, spam), so it goes for human review either way
        ModerationAction::EscalatedForHumanReview
    } else {
        // Flagged as adult content only - hidden in the app store build but not a violation
        ModerationAction::FlaggedOnly
    };

    // Store the flags on the originating canister so the message can be hidden in the app store
    // build (public chats only - private messages are classified but not flagged)
    if !categories.is_empty() && args.is_public {
        flag_message(&args, categories, &mut state.data.fire_and_forget_handler);
    }

    if is_csam {
        if !args.already_deleted {
            moderation::delete_message(
                args.chat_id,
                args.thread_root_message_index,
                args.message.message_id,
                &mut state.data.fire_and_forget_handler,
            );
        }
        moderation::suspend_sender(args.message.sender, now, state);
    }

    let outcome = AutomatedOutcome {
        timestamp: now,
        flagged_categories: categories.bits(),
        action,
    };
    let reported_message = match state.data.reported_messages.record_outcome(report_index, outcome) {
        RecordOutcomeResult::Success(m) => m,
        RecordOutcomeResult::OutcomeExists(index) => {
            error!(?index, "Report outcome already recorded");
            return;
        }
        RecordOutcomeResult::ReportNotFound(index) => {
            error!(?index, "Report not found");
            return;
        }
    };

    if matches!(
        action,
        ModerationAction::AutoSanctioned | ModerationAction::EscalatedForHumanReview
    ) {
        moderation::post_moderation_alert(
            ModerationAlert {
                chat_id: reported_message.chat_id,
                thread_root_message_index: reported_message.thread_root_message_index,
                message_index: reported_message.message_index,
                sender: reported_message.sender,
                reporters: reported_message.reports.keys().copied().collect(),
                categories,
                auto_sanctioned: is_csam,
                content_excerpt: args.message.content.moderation_input().text,
                timestamp: now,
            },
            state,
        );
    }

    if is_csam {
        // Inform the sender that their message has violated the platform rules
        state.push_event_to_local_user_index(reported_message.sender, build_message_to_sender(&reported_message));
    }

    // Inform each reporter of the outcome of their report
    for reporter in reported_message.reports.keys() {
        state.push_event_to_local_user_index(*reporter, build_message_to_reporter(&reported_message, *reporter));
    }
}

// Categories which map to OpenChat T&C violations requiring human review
fn human_review_categories() -> ModerationCategories {
    ModerationCategories::HARASSMENT
        | ModerationCategories::HARASSMENT_THREATENING
        | ModerationCategories::VIOLENCE
        | ModerationCategories::VIOLENCE_GRAPHIC
        | ModerationCategories::SELF_HARM
        | ModerationCategories::ILLICIT
}

fn flag_message(args: &Args, categories: ModerationCategories, fire_and_forget_handler: &mut FireAndForgetHandler) {
    match args.chat_id {
        Chat::Group(group_id) => {
            let c2c_args = group_canister::c2c_flag_message::Args {
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message.message_id,
                flags: categories.bits(),
            };
            fire_and_forget_handler.send(
                group_id.into(),
                "c2c_flag_message_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&c2c_args),
            );
        }
        Chat::Channel(community_id, channel_id) => {
            let c2c_args = community_canister::c2c_flag_message::Args {
                channel_id,
                thread_root_message_index: args.thread_root_message_index,
                message_id: args.message.message_id,
                flags: categories.bits(),
            };
            fire_and_forget_handler.send(
                community_id.into(),
                "c2c_flag_message_msgpack".to_string(),
                msgpack::serialize_then_unwrap(&c2c_args),
            );
        }
        Chat::Direct(_) => {}
    }
}
