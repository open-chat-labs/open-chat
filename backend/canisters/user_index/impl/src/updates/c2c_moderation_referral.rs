use crate::guards::caller_is_group_index;
use crate::model::moderation::{self, ModerationAlert};
use crate::model::reported_messages::{AddProactiveDetectionArgs, ModerationAction};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use tracing::info;
use types::ModerationCategories;
use user_index_canister::c2c_moderation_referral::*;

// A message whose classifier score for a configured category (other than sexual/minors)
// exceeded the moderation-referral threshold: create a resolvable report and alert the
// moderators. No action is taken against the message or the sender unless a human upholds
// the report.
#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_moderation_referral(args: Args) -> Response {
    mutate_state(|state| c2c_moderation_referral_impl(args, state));
    Response::Success
}

fn c2c_moderation_referral_impl(args: Args, state: &mut RuntimeState) {
    let now = state.env.now();
    let Some(categories) = ModerationCategories::from_bits(args.flags) else {
        return;
    };

    let Some((report_index, is_new_report)) = state
        .data
        .reported_messages
        .add_proactive_detection(AddProactiveDetectionArgs {
            action: ModerationAction::EscalatedForHumanReview,
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
        info!("Moderation referral ignored: report already has an outcome");
        return;
    };

    // Record the report against the sender's user record (feeds the repeat-offender count,
    // which only counts reports once a human upholds them)
    if is_new_report {
        state.data.users.push_reported_message(args.sender, report_index);
    }

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
            auto_sanctioned: false,
            content_excerpt: args.content_excerpt,
            // The content is still live in the chat, so the moderator reviews it in place;
            // the blob references stay on the report record for the verdict to act on
            blob_references: Vec::new(),
            timestamp: now,
        },
        state,
    );
}
