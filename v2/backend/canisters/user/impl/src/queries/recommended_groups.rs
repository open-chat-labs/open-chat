use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::{CanisterId, ChatId};
use user_canister::recommended_groups::{Response::*, *};

#[query(guard = "caller_is_owner")]
async fn recommended_groups(args: Args) -> Response {
    let (group_index_canister_id, exclusions) = read_state(prepare);

    let c2c_args = group_index_canister::c2c_recommended_groups::Args {
        count: args.count,
        exclusions,
    };

    match group_index_canister_c2c_client::c2c_recommended_groups(group_index_canister_id, &c2c_args).await {
        Ok(group_index_canister::c2c_recommended_groups::Response::Success(result)) => {
            Success(SuccessResult { groups: result.groups })
        }
        Err(error) => InternalError(error.1),
    }
}

fn prepare(runtime_state: &RuntimeState) -> (CanisterId, Vec<ChatId>) {
    let group_index_canister_id = runtime_state.data.group_index_canister_id;
    let mut exclusions: Vec<_> = runtime_state.data.group_chats.iter().map(|g| g.chat_id).collect();
    exclusions.extend(runtime_state.data.recommended_group_exclusions.iter().copied());

    (group_index_canister_id, exclusions)
}
