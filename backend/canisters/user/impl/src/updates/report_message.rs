use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, Chat, EventIndex, OCResult, UserId};
use user_canister::report_message::*;
use user_index_canister::c2c_report_message;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    run_regular_jobs();

    let (c2c_args, user_index_canister) = match read_state(|state| build_c2c_args(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| delete_message(&args, c2c_args.reporter, state));
            }

            match result {
                c2c_report_message::Response::Success => Response::Success,
                c2c_report_message::Response::AlreadyReported => Response::Error(OCErrorCode::AlreadyReported.into()),
            }
        }
        Err(error) => Response::Error(error.into()),
    }
}

fn build_c2c_args(args: &Args, state: &RuntimeState) -> OCResult<(c2c_report_message::Args, CanisterId)> {
    state.data.verify_not_suspended()?;

    let chat = state.data.direct_chats.get_or_err(&args.them.into())?;
    let user_id = state.env.canister_id().into();
    let events_reader = chat.events.main_events_reader();

    let message = events_reader
        .message(args.message_id.into(), Some(user_id))
        .ok_or(OCErrorCode::MessageNotFound)?;

    Ok((
        c2c_report_message::Args {
            reporter: user_id,
            chat_id: Chat::Direct(args.them.into()),
            thread_root_message_index: None,
            message,
            already_deleted: args.delete,
            is_public: false,
        },
        state.data.user_index_canister_id,
    ))
}

fn delete_message(args: &Args, reporter: UserId, state: &mut RuntimeState) {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.them.into()) {
        chat.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: reporter,
            is_admin: true,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: vec![args.message_id],
            now: state.env.now(),
        });
    }
}
