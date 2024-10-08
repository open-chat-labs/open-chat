use crate::guards::caller_is_owner;
use crate::{
    mutate_state, read_state, run_regular_jobs, RuntimeState, BASIC_GROUP_CREATION_LIMIT, PREMIUM_GROUP_CREATION_LIMIT,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group;
use tracing::error;
use types::{CanisterId, ChatId};
use user_canister::create_group::{Response::*, *};
use utils::document_validation::validate_avatar;
use utils::text_validation::{
    validate_description, validate_group_name, validate_rules, NameValidationError, RulesValidationError,
};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
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
                mutate_state(|state| commit(r.chat_id, r.local_user_index_canister_id, state));
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

fn prepare(args: Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    let now = state.env.now();
    let is_diamond_member = state.data.is_diamond_member(now);
    let group_creation_limit = if is_diamond_member { PREMIUM_GROUP_CREATION_LIMIT } else { BASIC_GROUP_CREATION_LIMIT };

    if state.data.suspended.value {
        Err(UserSuspended)
    } else if !is_diamond_member && args.is_public {
        Err(UnauthorizedToCreatePublicGroup)
    } else if state.data.group_chats.groups_created() >= group_creation_limit {
        Err(MaxGroupsCreated(group_creation_limit))
    } else if is_throttled() {
        Err(Throttled)
    } else if let Err(error) = validate_group_name(&args.name, args.is_public, None) {
        Err(match error {
            NameValidationError::TooShort(s) => NameTooShort(s),
            NameValidationError::TooLong(l) => NameTooLong(l),
            NameValidationError::Reserved => NameReserved,
        })
    } else if let Err(error) = validate_description(&args.description) {
        Err(DescriptionTooLong(error))
    } else if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
        return Err(match error {
            RulesValidationError::TooShort(s) => RulesTooShort(s),
            RulesValidationError::TooLong(l) => RulesTooLong(l),
        });
    } else if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        Err(AvatarTooBig(error))
    } else if args.gate_config.as_ref().map(|g| !g.validate()).unwrap_or_default() {
        Err(AccessGateInvalid)
    } else {
        let create_group_args = c2c_create_group::Args {
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            subtype: None,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            messages_visible_to_non_members: args.messages_visible_to_non_members,
            avatar: args.avatar,
            permissions_v2: args.permissions_v2,
            events_ttl: args.events_ttl,
            gate: args.gate,
            gate_config: args.gate_config,
        };
        Ok(PrepareResult {
            group_index_canister_id: state.data.group_index_canister_id,
            create_group_args,
        })
    }
}

fn commit(chat_id: ChatId, local_user_index_canister_id: CanisterId, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.group_chats.create(chat_id, local_user_index_canister_id, now);
}
