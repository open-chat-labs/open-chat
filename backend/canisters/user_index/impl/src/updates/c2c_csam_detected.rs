use crate::guards::caller_is_group_index;
use crate::model::moderation::{self, ModerationAlert};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
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

    moderation::delete_message(
        args.chat_id,
        args.thread_root_message_index,
        args.message_id,
        &mut state.data.fire_and_forget_handler,
    );
    moderation::suspend_sender(args.sender, now, state);

    // Always post CSAM alerts to the moderation channel, even though the auto-sanction has
    // already been applied, for legal record-keeping
    moderation::post_moderation_alert(
        ModerationAlert {
            report_index: None,
            chat_id: args.chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            reporters: Vec::new(),
            categories,
            auto_sanctioned: true,
            content_excerpt: args.content_excerpt,
            timestamp: now,
        },
        state,
    );
}
