use crate::guards::caller_is_owner;
use crate::{
    mutate_state, read_state, run_regular_jobs, RuntimeState, BASIC_GROUP_CREATION_LIMIT, PREMIUM_GROUP_CREATION_LIMIT,
};
use canister_tracing_macros::trace;
use group_index_canister::{c2c_create_group, MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_RULES_LENGTH};
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, ChatId, FieldTooLongResult, FieldTooShortResult, MAX_AVATAR_SIZE};
use user_canister::create_group::{Response::*, *};
use utils::group_validation::{validate_name, NameValidationError};

#[update(guard = "caller_is_owner")]
#[trace]
async fn create_group(mut args: Args) -> Response {
    run_regular_jobs();

    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();
    args.rules.text = args.rules.text.trim().to_string();

    let prepare_result = match read_state(|state| prepare(args, state)) {
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
                mutate_state(|state| commit(r.chat_id, state));
                Success(SuccessResult { chat_id: r.chat_id })
            }
            c2c_create_group::Response::NameTaken => NameTaken,
            c2c_create_group::Response::CyclesBalanceTooLow
            | c2c_create_group::Response::UserNotFound
            | c2c_create_group::Response::InternalError => InternalError,
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
    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    let now = runtime_state.env.now();
    let is_diamond_member = runtime_state.data.is_diamond_member(now);
    let group_creation_limit = if is_diamond_member { PREMIUM_GROUP_CREATION_LIMIT } else { BASIC_GROUP_CREATION_LIMIT };

    if runtime_state.data.suspended.value {
        Err(UserSuspended)
    } else if !is_diamond_member && args.is_public {
        Err(UnauthorizedToCreatePublicGroup)
    } else if runtime_state.data.group_chats.groups_created() >= group_creation_limit {
        Err(MaxGroupsCreated(group_creation_limit))
    } else if is_throttled() {
        Err(Throttled)
    } else if let Err(error) = validate_name(&args.name, args.is_public) {
        Err(match error {
            NameValidationError::TooShort(s) => NameTooShort(s),
            NameValidationError::TooLong(l) => NameTooLong(l),
            NameValidationError::Reserved => NameReserved,
        })
    } else if args.description.len() > MAX_GROUP_DESCRIPTION_LENGTH as usize {
        Err(DescriptionTooLong(FieldTooLongResult {
            length_provided: args.description.len() as u32,
            max_length: MAX_GROUP_DESCRIPTION_LENGTH,
        }))
    } else if args.rules.enabled && args.rules.text.is_empty() {
        Err(RulesTooShort(FieldTooShortResult {
            length_provided: args.rules.text.len() as u32,
            min_length: 1,
        }))
    } else if args.rules.text.len() > MAX_GROUP_RULES_LENGTH as usize {
        Err(RulesTooLong(FieldTooLongResult {
            length_provided: args.rules.text.len() as u32,
            max_length: MAX_GROUP_RULES_LENGTH,
        }))
    } else if args
        .avatar
        .as_ref()
        .map_or(false, |a| a.data.len() > MAX_AVATAR_SIZE as usize)
    {
        Err(AvatarTooBig(FieldTooLongResult {
            length_provided: args.avatar.as_ref().unwrap().data.len() as u32,
            max_length: MAX_AVATAR_SIZE,
        }))
    } else {
        let create_group_args = c2c_create_group::Args {
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            subtype: args.subtype,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            avatar: args.avatar,
            permissions: args.permissions,
            events_ttl: args.events_ttl,
            gate: args.gate,
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
