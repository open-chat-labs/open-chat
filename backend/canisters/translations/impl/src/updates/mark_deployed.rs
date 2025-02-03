use crate::guards::caller_is_deployment_operator;
use crate::model::translations::DecisionSummary;
use crate::mutate_state;
use crate::RuntimeState;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use translations_canister::mark_deployed::{Response::*, *};
use user_index_canister::c2c_send_openchat_bot_messages;
use user_index_canister::c2c_send_openchat_bot_messages::Message;

#[update(guard = "caller_is_deployment_operator", candid = true, msgpack = true)]
#[trace]
fn mark_deployed(args: Args) -> Response {
    mutate_state(|state| mark_deployed_impl(args, state))
}

fn mark_deployed_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.translations.mark_deployed(args.latest_approval, state.env.now());

    notify_translators_of_decisions(state);

    Success
}

// The notifications are sent asynchronously. We assume the user notifications (OpenChatBot messages)
// will all be sent before `mark_deployed` is next called otherwise the users will be notified of the same decisions.
// Alternatively we could mark each translation when we call build_notifications.
fn notify_translators_of_decisions(state: &mut RuntimeState) {
    let since = state.data.user_notifications_last_sent;

    let summaries = state.data.translations.collate_decision_summaries(since);
    let messages: Vec<_> = summaries
        .into_iter()
        .map(|(user_id, summary)| Message {
            text: build_message_text(summary),
            recipient: user_id,
        })
        .collect();

    let payload = c2c_send_openchat_bot_messages::Args { messages };
    state.data.fire_and_forget_handler.send(
        state.data.user_index_canister_id,
        "c2c_send_openchat_bot_messages_msgpack".to_string(),
        msgpack::serialize_then_unwrap(payload),
    );

    state.data.user_notifications_last_sent = state.env.now();
}

fn build_message_text(summary: DecisionSummary) -> String {
    let DecisionSummary {
        approved,
        rejected,
        deployed,
        newly_approved: paid,
    } = summary;
    format!(
        "Round-up of recent translation decisions:
        Approved: {approved}
        Rejected: {rejected}
        Applied: {deployed}
        CHAT earned: {paid}"
    )
}
