use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use fire_and_forget_handler::FireAndForgetHandler;
use group_canister::invite_users::{Response::*, *};
use group_chat_core::InvitedUsersResult;
use ic_cdk_macros::update;
use local_user_index_canister::{c2c_notify_events, Event, OpenChatBotMessage};
use msgpack::serialize_then_unwrap;
use types::{CanisterId, ChatId, MessageContent, TextContent, UserId};

#[update]
#[trace]
fn invite_users(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| invite_users_impl(args, state))
}

fn invite_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();

        match state.data.chat.invite_users(user_id, args.user_ids, now) {
            InvitedUsersResult::Success(r) => {
                handle_activity_notification(state);

                send_bot_message_to_invitees(
                    user_id,
                    r.invited_users,
                    state.env.canister_id().into(),
                    &state.data.chat.name,
                    state.data.local_user_index_canister_id,
                    &mut state.data.fire_and_forget_handler,
                );

                Success
            }
            InvitedUsersResult::UserNotInGroup => CallerNotInGroup,
            InvitedUsersResult::NotAuthorized => NotAuthorized,
            InvitedUsersResult::UserSuspended => UserSuspended,
            InvitedUsersResult::TooManyInvites(v) => TooManyInvites(v),
        }
    } else {
        CallerNotInGroup
    }
}

fn send_bot_message_to_invitees(
    invited_by: UserId,
    user_ids: Vec<UserId>,
    group_id: ChatId,
    group_name: &str,
    local_user_index: CanisterId,
    fire_and_forget_handler: &mut FireAndForgetHandler,
) {
    let args = c2c_notify_events::Args {
        events: user_ids
            .into_iter()
            .map(|user_id| build_bot_message_event(user_id, invited_by, group_id, group_name))
            .collect(),
    };
    fire_and_forget_handler.send(local_user_index, "c2c_notify_events".to_string(), serialize_then_unwrap(args));
}

fn build_bot_message_event(invited: UserId, invited_by: UserId, group_id: ChatId, group_name: &str) -> Event {
    Event::OpenChatBotMessage(OpenChatBotMessage {
        user_id: invited,
        message: MessageContent::Text(TextContent {
            text: format!("You have been invited to the group [{group_name}](/group/{group_id}) by @UserId({invited_by})."),
        }),
    })
}
