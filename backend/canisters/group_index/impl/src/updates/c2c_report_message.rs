use crate::guards::caller_is_group_or_community_canister;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_report_message::{Response::*, *};

#[update(guard = "caller_is_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_report_message(args: Args) -> Response {
    let user_index_canister_id = read_state(|state| state.data.user_index_canister_id);

    let c2c_args = user_index_canister::c2c_report_message::Args {
        chat_id: args.chat_id.into(),
        reporter: args.reporter,
        thread_root_message_index: args.thread_root_message_index,
        message: args.message,
        already_deleted: args.already_deleted,
        is_public: args.is_public,
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister_id, &c2c_args).await {
        Ok(user_index_canister::c2c_report_message::Response::Success) => Success,
        Ok(user_index_canister::c2c_report_message::Response::AlreadyReported) => AlreadyReported,
        Err(error) => InternalError(format!("{error:?}")),
    }
}
