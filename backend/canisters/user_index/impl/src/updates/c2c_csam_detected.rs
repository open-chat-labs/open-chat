use crate::guards::caller_is_group_index;
use crate::model::moderation::{self, ModerationAlert};
use crate::model::reported_messages::AddProactiveDetectionArgs;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use types::ModerationCategories;
use user_index_canister::c2c_csam_detected::*;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_csam_detected(args: Args) -> Response {
    mutate_state(|state| c2c_csam_detected_impl(args, state));
    Response::Success
}

fn c2c_csam_detected_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();
    let categories = ModerationCategories::from_bits(args.flags).unwrap_or(ModerationCategories::SEXUAL_MINORS);

    // Create a resolvable report so that the auto-sanction can be reviewed: upheld, dismissed
    // (which reverses it), or contested by the sender. If an outcome already exists this is a
    // duplicate event and the sanction must not re-apply.
    let Some(report_index) = state
        .data
        .reported_messages
        .add_proactive_detection(AddProactiveDetectionArgs {
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            flags: categories.bits(),
            blob_references: args.blob_references,
            timestamp: now,
        })
    else {
        info!("CSAM detection ignored: report already has an outcome");
        return;
    };

    // Record the report against the sender's user record (feeds the repeat-offender count)
    state.data.users.push_reported_message(args.sender, report_index);

    let reported_message = state.data.reported_messages.get(report_index).unwrap().clone();

    // Quarantine media in the evidence vault first: this blocks public serving and pins the
    // blobs against every deletion path, preserving evidence ahead of the sanction
    moderation::quarantine_blobs(report_index, &reported_message, categories.bits(), state);

    moderation::delete_message(
        args.chat_id,
        args.thread_root_message_index,
        args.message_id,
        &mut state.data.fire_and_forget_handler,
    );
    moderation::suspend_sender(args.sender, now, state);

    moderation::post_moderation_alert(
        ModerationAlert {
            report_index: Some(report_index),
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            reporters: Vec::new(),
            categories,
            auto_sanctioned: true,
            content_excerpt: args.content_excerpt,
            blob_references: reported_message.blob_references,
            timestamp: now,
        },
        state,
    );
}
