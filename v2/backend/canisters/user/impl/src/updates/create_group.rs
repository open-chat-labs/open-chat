use crate::{regular_jobs, RuntimeState, RUNTIME_STATE};
use group_canister::{MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH};
use group_index_canister::c2c_create_group;
use ic_cdk_macros::update;
use tracing::{error, instrument};
use types::{CanisterId, ChatId, FieldTooLongResult, MAX_AVATAR_SIZE};
use user_canister::create_group::{Response::*, *};

#[update]
#[instrument(level = "trace")]
async fn create_group(args: Args) -> Response {
    regular_jobs::run();

    let prepare_result = match RUNTIME_STATE.with(|state| prepare(args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_create_group(
        prepare_result.group_index_canister_id,
        &prepare_result.create_group_args,
    )
    .await
    {
        Ok(response) => match response {
            c2c_create_group::Response::Success(r) => {
                RUNTIME_STATE.with(|state| commit(r.chat_id, state.borrow_mut().as_mut().unwrap()));
                Success(SuccessResult { chat_id: r.chat_id })
            }
            c2c_create_group::Response::NameTaken => NameTaken,
            c2c_create_group::Response::CyclesBalanceTooLow => InternalError,
            c2c_create_group::Response::InternalError => InternalError,
        },
        Err(error) => {
            error!(?error, "Error calling create group");
            InternalError
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_group_args: c2c_create_group::Args,
}

fn prepare(args: Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    runtime_state.trap_if_caller_not_owner();

    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    if let Some(max) = runtime_state.data.group_chats.max_groups_created() {
        Err(MaxGroupsCreated(max))
    } else if is_throttled() {
        Err(Throttled)
    } else if args.name.len() > MAX_GROUP_NAME_LENGTH as usize {
        Err(NameTooLong(FieldTooLongResult {
            length_provided: args.name.len() as u32,
            max_length: MAX_GROUP_NAME_LENGTH,
        }))
    } else if args.description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(DescriptionTooLong(FieldTooLongResult {
            length_provided: args.description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else if args
        .avatar
        .as_ref()
        .map_or(false, |a| a.data.len() > MAX_AVATAR_SIZE as usize)
    {
        Err(AvatarTooBig(FieldTooLongResult {
            length_provided: args.avatar.as_ref().unwrap().data.len() as u32,
            max_length: MAX_AVATAR_SIZE as u32,
        }))
    } else {
        let create_group_args = c2c_create_group::Args {
            is_public: args.is_public,
            creator_principal: runtime_state.env.caller(),
            name: args.name,
            description: args.description,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            avatar: args.avatar,
        };
        Ok(PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            create_group_args,
        })
    }
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.group_chats.create(chat_id, now);
}
