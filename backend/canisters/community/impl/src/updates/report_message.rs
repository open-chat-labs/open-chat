use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::Reader;
use community_canister::report_message::{Response::*, *};
use group_index_canister::c2c_report_message;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, MultiUserChat, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    run_regular_jobs();

    let (c2c_args, group_index_canister) = match read_state(|state| build_c2c_args(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_report_message(group_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| delete_message(&args, c2c_args.reporter, state));
            }

            match result {
                c2c_report_message::Response::Success => Success,
                c2c_report_message::Response::AlreadyReported => Error(OCErrorCode::AlreadyReported.into()),
                c2c_report_message::Response::InternalError(error) => Error(OCErrorCode::Unknown.with_message(error)),
                c2c_report_message::Response::Error(error) => Error(error),
            }
        }
        Err(error) => Error(error.into()),
    }
}

fn build_c2c_args(args: &Args, state: &RuntimeState) -> OCResult<(c2c_report_message::Args, CanisterId)> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let user_id = member.user_id;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let chat = &channel.chat;
    let channel_member = chat.members.get_verified_member(user_id)?;

    if args.delete && !channel_member.role().can_delete_messages(&chat.permissions) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let events_reader = channel
        .chat
        .events
        .events_reader(channel_member.min_visible_event_index(), args.thread_root_message_index, None)
        .ok_or(OCErrorCode::MessageNotFound)?;

    let message = events_reader
        .message(args.message_id.into(), Some(user_id))
        .ok_or(OCErrorCode::MessageNotFound)?;

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
        if let Ok(results) = channel.chat.delete_messages(
            reporter,
            args.thread_root_message_index,
            vec![args.message_id],
            false,
            state.env.now(),
        ) {
            if results.iter().any(|(_, r)| r.is_ok()) {
                handle_activity_notification(state);
            }
        }
    }
}
