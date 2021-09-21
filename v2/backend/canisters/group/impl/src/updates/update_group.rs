use crate::updates::update_group::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::update_group::*;
use group_canister::{MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH};
use group_index_canister::c2c_update_group;
use ic_cdk_macros::update;
use log::error;
use types::{CanisterId, ChatId, FieldTooLongResult};

#[update]
async fn update_group(args: Args) -> Response {
    check_cycles_balance();

    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    if prepare_result.is_public {
        let c2c_update_group_args = c2c_update_group::Args {
            name: args.name.clone(),
            description: args.description.clone(),
        };

        match group_index_canister_c2c_client::c2c_update_group(prepare_result.group_index_canister_id, &c2c_update_group_args)
            .await
        {
            Ok(response) => match response {
                c2c_update_group::Response::NameTaken => return NameTaken,
                c2c_update_group::Response::ChatNotFound => {
                    error!("Group not found in index: {:?}", prepare_result.chat_id);
                    return InternalError;
                }
                c2c_update_group::Response::Success => (),
            },
            Err(error) => {
                error!("Error calling update group: {:?}", error);
                return InternalError;
            }
        };
    }

    RUNTIME_STATE.with(|state| commit(args, state.borrow_mut().as_mut().unwrap()));
    Success
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    is_public: bool,
    chat_id: ChatId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = &runtime_state.env.caller();
    if args.name.len() > MAX_GROUP_NAME_LENGTH as usize {
        Err(NameTooLong(FieldTooLongResult {
            length_provided: args.name.len() as u32,
            max_length: MAX_GROUP_NAME_LENGTH,
        }))
    } else if args.description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(DescriptionTooLong(FieldTooLongResult {
            length_provided: args.description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(caller) {
        if !participant.role.can_update_group() {
            Err(NotAuthorized)
        } else if runtime_state.data.name != args.name && runtime_state.data.description != args.description {
            Err(Unchanged)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                is_public: runtime_state.data.is_public,
                chat_id: runtime_state.env.canister_id().into(),
            })
        }
    } else {
        Err(NotAuthorized)
    }
}

fn commit(args: Args, runtime_state: &mut RuntimeState) {
    runtime_state.data.name = args.name;
    runtime_state.data.description = args.description;
}
