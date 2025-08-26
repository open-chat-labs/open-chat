use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::Reader;
use group_canister::report_message::*;
use group_index_canister::c2c_report_message;
use oc_error_codes::OCErrorCode;
use types::{Caller, CanisterId, MultiUserChat, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    execute_update_async(|| report_message_impl(args)).await
}

async fn report_message_impl(args: Args) -> Response {
    let (c2c_args, group_index_canister) = match read_state(|state| build_c2c_args(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    match group_index_canister_c2c_client::c2c_report_message(group_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| delete_message(&args, c2c_args.reporter, state));
            }

            match result {
                c2c_report_message::Response::Success => Response::Success,
                c2c_report_message::Response::AlreadyReported => Response::Error(OCErrorCode::AlreadyReported.into()),
                c2c_report_message::Response::InternalError(error) => Response::Error(OCErrorCode::Unknown.with_message(error)),
                c2c_report_message::Response::Error(error) => Response::Error(error),
            }
        }
        Err(error) => Response::Error(error.into()),
    }
}

fn build_c2c_args(args: &Args, state: &RuntimeState) -> OCResult<(c2c_report_message::Args, CanisterId)> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let chat = &state.data.chat;

    if args.delete && !member.role().can_delete_messages(&chat.permissions) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let user_id = member.user_id();

    if let Some(events_reader) =
        chat.events
            .events_reader(member.min_visible_event_index(), args.thread_root_message_index, None)
        && let Some(message) = events_reader.message(args.message_id.into(), Some(user_id))
    {
        return Ok((
            c2c_report_message::Args {
                reporter: user_id,
                chat_id: MultiUserChat::Group(state.env.canister_id().into()),
                thread_root_message_index: args.thread_root_message_index,
                message,
                already_deleted: args.delete,
                is_public: state.data.chat.is_public.value,
            },
            state.data.group_index_canister_id,
        ));
    }
    Err(OCErrorCode::MessageNotFound.into())
}

fn delete_message(args: &Args, reporter: UserId, state: &mut RuntimeState) {
    if let Ok(results) = state.data.chat.delete_messages(
        Caller::User(reporter),
        args.thread_root_message_index,
        vec![args.message_id],
        false,
        state.env.now(),
    ) && results.iter().any(|(_, r)| r.is_ok())
    {
        handle_activity_notification(state);
    }
}
