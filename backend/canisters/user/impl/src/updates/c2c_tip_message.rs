use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{Reader, TipMessageArgs, TipMessageResult};
use ledger_utils::format_crypto_amount_with_symbol;
use types::{DirectMessageTipped, EventIndex, Notification, UserId};
use user_canister::c2c_tip_message::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_tip_message_impl(args, state.env.caller().into(), state))
}

pub(crate) fn c2c_tip_message_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();
        let my_user_id = state.env.canister_id().into();

        let tip_message_args = TipMessageArgs {
            user_id: caller_user_id,
            recipient: my_user_id,
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            ledger: args.ledger,
            token: args.token.clone(),
            amount: args.amount,
            now,
        };

        if matches!(
            chat.events.tip_message(tip_message_args, EventIndex::default(),),
            TipMessageResult::Success
        ) {
            if let Some(event) = chat
                .events
                .main_events_reader()
                .message_event_internal(args.message_id.into())
            {
                let notification = Notification::DirectMessageTipped(DirectMessageTipped {
                    them: caller_user_id,
                    thread_root_message_index: args.thread_root_message_index,
                    message_index: event.event.message_index,
                    message_event_index: event.index,
                    username: args.username,
                    display_name: args.display_name,
                    tip: format_crypto_amount_with_symbol(args.amount, args.decimals, args.token.token_symbol()),
                    user_avatar_id: args.user_avatar_id,
                });
                state.push_notification(my_user_id, notification);
            }
        }
    }
    Success
}
