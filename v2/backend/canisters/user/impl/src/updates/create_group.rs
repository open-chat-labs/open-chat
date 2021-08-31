use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::c2c_create_group;
use ic_cdk_macros::update;
use log::error;
use types::{CanisterId, ChatId};
use user_canister::create_group::{Response::*, *};

#[update]
async fn create_group(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister_client::c2c_create_group(
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
            c2c_create_group::Response::PublicGroupAlreadyExists => PublicGroupAlreadyExists,
            c2c_create_group::Response::CyclesBalanceTooLow => InternalError,
            c2c_create_group::Response::InternalError => InternalError,
        },
        Err(error) => {
            error!("Error calling create group: {:?}", error);
            InternalError
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_group_args: c2c_create_group::Args,
}

fn prepare(args: Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    if runtime_state.is_caller_owner() {
        if is_throttled() {
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
        } else {
            let create_group_args = c2c_create_group::Args {
                is_public: args.is_public,
                creator_principal: runtime_state.env.caller(),
                name: args.name,
                description: args.description,
                history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            };
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                create_group_args,
            })
        }
    } else {
        Err(NotAuthorized)
    }
}

fn commit(chat_id: ChatId, runtime_state: &mut RuntimeState) {
    runtime_state.data.group_chats.add(chat_id);
}
