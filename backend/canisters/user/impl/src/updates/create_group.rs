use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group;
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{CanisterId, ChatId, OCResult};
use user_canister::create_group::{Response::*, *};
use utils::document::validate_avatar;
use utils::text_validation::{
    NameValidationError, RulesValidationError, validate_description, validate_group_name, validate_rules,
};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn create_group(args: Args) -> Response {
    execute_update_async(|| create_group_impl(args)).await
}

async fn create_group_impl(mut args: Args) -> Response {
    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();
    args.rules.text = args.rules.text.trim().to_string();

    let prepare_result = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
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
            c2c_create_group::Response::NameTaken => Error(OCErrorCode::NameTaken.into()),
            c2c_create_group::Response::Error(error) => Error(error),
            c2c_create_group::Response::CyclesBalanceTooLow
            | c2c_create_group::Response::UserNotFound
            | c2c_create_group::Response::InternalError => Error(OCErrorCode::Unknown.into()),
        },
        Err(error) => {
            error!(?error, "Error calling create group");
            Error(error.into())
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_group_args: c2c_create_group::Args,
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_suspended()?;

    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    let now = state.env.now();
    let membership = state.data.membership(now);
    let group_creation_limit = membership.group_creation_limit();

    if !membership.is_diamond_member() && args.is_public {
        Err(OCErrorCode::NotDiamondMember.into())
    } else if state.data.group_chats.groups_created() >= group_creation_limit {
        Err(OCErrorCode::MaxGroupsCreated.with_message(group_creation_limit))
    } else if is_throttled() {
        Err(OCErrorCode::Throttled.into())
    } else if let Err(error) = validate_group_name(&args.name, args.is_public, None) {
        Err(match error {
            NameValidationError::TooShort(s) => OCErrorCode::NameTooShort.with_json(&s),
            NameValidationError::TooLong(l) => OCErrorCode::NameTooLong.with_json(&l),
            NameValidationError::Reserved => OCErrorCode::NameReserved.into(),
        })
    } else if let Err(error) = validate_description(&args.description) {
        Err(OCErrorCode::DescriptionTooLong.with_json(&error))
    } else if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
        Err(match error {
            RulesValidationError::TooShort(s) => OCErrorCode::RulesTooShort.with_json(&s),
            RulesValidationError::TooLong(l) => OCErrorCode::RulesTooLong.with_json(&l),
        })
    } else if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        Err(OCErrorCode::AvatarTooBig.with_json(&error))
    } else if args
        .gate_config
        .as_ref()
        .map(|g| !g.validate(state.data.test_mode))
        .unwrap_or_default()
    {
        Err(OCErrorCode::InvalidAccessGate.into())
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
