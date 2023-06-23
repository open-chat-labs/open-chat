use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::report_message_v2::{Response::*, *};
use types::{CanisterId, ChatId, Empty, UserId};

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn report_message_v2(args: Args) -> Response {
    let PrepareResult {
        user_id,
        platform_moderators_group,
        user_index_canister_id,
    } = read_state(prepare);

    let platform_moderators_group = if let Some(group) = platform_moderators_group {
        group
    } else {
        match user_index_canister_c2c_client::platform_moderators_group(user_index_canister_id, &Empty {}).await {
            Ok(user_index_canister::platform_moderators_group::Response::Success(group)) => {
                mutate_state(|state| state.data.platform_moderators_group = Some(group));
                group
            }
            Err(error) => return InternalError(format!("{error:?}")),
        }
    };

    let c2c_args = group_canister::c2c_report_message_v2::Args {
        user_id,
        chat_id: args.chat_id,
        thread_root_message_index: args.thread_root_message_index,
        event_index: args.event_index,
        reason_code: args.reason_code,
        notes: args.notes,
    };
    match group_canister_c2c_client::c2c_report_message_v2(platform_moderators_group.into(), &c2c_args).await {
        Ok(_) => Success,
        Err(error) => InternalError(format!("Failed to call 'group::c2c_report_message_v2': {error:?}")),
    }
}

struct PrepareResult {
    user_id: UserId,
    platform_moderators_group: Option<ChatId>,
    user_index_canister_id: CanisterId,
}

fn prepare(state: &RuntimeState) -> PrepareResult {
    let user_id = state.calling_user().user_id;

    PrepareResult {
        user_id,
        platform_moderators_group: state.data.platform_moderators_group,
        user_index_canister_id: state.data.user_index_canister_id,
    }
}
