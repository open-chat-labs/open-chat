use crate::model::public_groups::UpdateGroupResult;
use crate::updates::{validate_group, GroupValidationError};
use crate::{mutate_state, RuntimeState};
use canister_api_macros::trace;
use group_index_canister::c2c_update_group::{Response::*, *};
use ic_cdk_macros::update;
use types::ChatId;

#[update]
#[trace]
fn c2c_update_group(mut args: Args) -> Response {
    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();

    mutate_state(|state| c2c_update_group_impl(args, state))
}

fn c2c_update_group_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Err(error) = validate_group(&args.name, &args.description) {
        return match error {
            GroupValidationError::NameTooShort(f) => NameTooShort(f),
            GroupValidationError::NameTooLong(f) => NameTooLong(f),
            GroupValidationError::DescriptionTooLong(f) => DescriptionTooLong(f),
        };
    }

    let chat_id = ChatId::from(runtime_state.env.caller());
    match runtime_state
        .data
        .public_groups
        .update_group(&chat_id, args.name, args.description, args.avatar_id)
    {
        UpdateGroupResult::Success => Success,
        UpdateGroupResult::ChatNotFound => ChatNotFound,
        UpdateGroupResult::NameTaken => NameTaken,
    }
}
