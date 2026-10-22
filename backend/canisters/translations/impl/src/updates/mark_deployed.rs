use crate::RuntimeState;
use crate::guards::caller_is_deployment_operator;
use crate::model::translations::DecisionSummary;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use translations_canister::mark_deployed::*;
use user_index_canister::{OpenChatBotMessage, TranslationsEvent};

#[update(guard = "caller_is_deployment_operator", candid = true, msgpack = true)]
#[trace]
fn mark_deployed(args: Args) -> Response {
    mutate_state(|state| mark_deployed_impl(args, state))
}

fn mark_deployed_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.translations.mark_deployed(args.latest_approval, state.env.now());

    notify_translators_of_decisions(state);

    Response::Success
}

// The notifications are sent asynchronously. We assume the user notifications (OpenChatBot messages)
// will all be sent before `mark_deployed` is next called otherwise the users will be notified of the same decisions.
// Alternatively we could mark each translation when we call build_notifications.
fn notify_translators_of_decisions(state: &mut RuntimeState) {
    let since = state.data.user_notifications_last_sent;

    let summaries = state.data.translations.collate_decision_summaries(since);
    for (user_id, summary) in summaries {
        state.push_event_to_user_index(TranslationsEvent::SendOpenChatBotMessage(OpenChatBotMessage {
            text: build_message_text(summary),
            recipient: user_id,
        }));
    }

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
