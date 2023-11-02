use crate::guards::caller_is_owner;
use crate::{read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::Reader;
use ic_cdk_macros::update;
use types::{CanisterId, Chat};
use user_canister::report_message::{Response::*, *};
use user_index_canister::c2c_report_message;

#[update(guard = "caller_is_owner")]
#[trace]
async fn report_message(args: Args) -> Response {
    run_regular_jobs();

    let (c2c_args, user_index_canister) = match read_state(|state| build_c2c_args(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister, &c2c_args).await {
        Ok(result) => match result {
            c2c_report_message::Response::Success => Success,
            c2c_report_message::Response::InternalError(err) => InternalError(err),
        },
        Err(err) => InternalError(format!("{err:?}")),
    }
}

fn build_c2c_args(args: Args, state: &RuntimeState) -> Result<(c2c_report_message::Args, CanisterId), Response> {
    if let Some(chat) = state.data.direct_chats.get(&args.them.into()) {
        let user_id = state.env.canister_id().into();
        let main_events_reader = chat.events.main_events_reader();

        if let Some(message) = main_events_reader.message(args.message_id.into(), Some(user_id)) {
            Ok((
                c2c_report_message::Args {
                    reporter: user_id,
                    chat_id: Chat::Direct(args.them.into()),
                    message,
                    reason_code: args.reason_code,
                    notes: args.notes,
                },
                state.data.user_index_canister_id,
            ))
        } else {
            Err(MessageNotFound)
        }
    } else {
        Err(ChatNotFound)
    }
}
