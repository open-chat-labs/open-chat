use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::Reader;
use community_canister::report_message::{Response::*, *};
use group_index_canister::c2c_report_message;
use types::{CanisterId, MultiUserChat, UserId};

#[update(msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    run_regular_jobs();

    let (c2c_args, group_index_canister) = match read_state(|state| build_c2c_args(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_report_message(group_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| delete_message(&args, c2c_args.reporter, state));
            }

            match result {
                c2c_report_message::Response::Success => Success,
                c2c_report_message::Response::AlreadyReported => AlreadyReported,
                c2c_report_message::Response::InternalError(error) => InternalError(error),
                c2c_report_message::Response::Error(code, message) => Error(code, message),
            }
        }
        Err(err) => InternalError(format!("{err:?}")),
    }
}

fn build_c2c_args(args: &Args, state: &RuntimeState) -> Result<(c2c_report_message::Args, CanisterId), Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();

    let Some(member) = state.data.members.get(caller) else {
        return Err(UserNotInCommunity);
    };

    if member.suspended().value {
        return Err(UserSuspended);
    } else if member.lapsed().value {
        return Err(UserLapsed);
    }

    let user_id = member.user_id;

    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return Err(ChannelNotFound);
    };

    let chat = &channel.chat;

    let Some(channel_member) = chat.members.get(&user_id) else {
        return Err(UserNotInChannel);
    };

    if channel_member.suspended().value {
        return Err(UserSuspended);
    } else if channel_member.lapsed().value {
        return Err(UserLapsed);
    }

    if args.delete && !channel_member.role().can_delete_messages(&chat.permissions) {
        return Err(NotAuthorized);
    }

    let Some(events_reader) =
        channel
            .chat
            .events
            .events_reader(channel_member.min_visible_event_index(), args.thread_root_message_index, None)
    else {
        return Err(MessageNotFound);
    };

    let Some(message) = events_reader.message(args.message_id.into(), Some(user_id)) else {
        return Err(MessageNotFound);
    };

    Ok((
        c2c_report_message::Args {
            reporter: user_id,
            chat_id: MultiUserChat::Channel(state.env.canister_id().into(), args.channel_id),
            thread_root_message_index: args.thread_root_message_index,
            message,
            already_deleted: args.delete,
            is_public: channel.chat.is_public.value && state.data.is_public.value,
        },
        state.data.group_index_canister_id,
    ))
}

fn delete_message(args: &Args, reporter: UserId, state: &mut RuntimeState) {
    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        if let group_chat_core::DeleteMessagesResult::Success(results) = channel.chat.delete_messages(
            reporter,
            args.thread_root_message_index,
            vec![args.message_id],
            false,
            state.env.now(),
        ) {
            if matches!(results[0].1, chat_events::DeleteMessageResult::Success(_)) {
                handle_activity_notification(state);
            }
        }
    }
}
