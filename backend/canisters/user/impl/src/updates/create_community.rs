use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState, COMMUNITY_CREATION_LIMIT};
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community;
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, CommunityId};
use user_canister::create_community::{Response::*, *};
use utils::avatar_validation::validate_avatar;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update(guard = "caller_is_owner")]
#[trace]
async fn create_community(mut args: Args) -> Response {
    run_regular_jobs();

    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();
    args.rules.text = args.rules.text.trim().to_string();

    let prepare_result = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister_c2c_client::c2c_create_community(
        prepare_result.group_index_canister_id,
        &prepare_result.create_community_args,
    )
    .await
    {
        Ok(response) => match response {
            c2c_create_community::Response::Success(r) => {
                mutate_state(|state| commit(r.community_id, state));
                Success(SuccessResult {
                    community_id: r.community_id,
                })
            }
            c2c_create_community::Response::NameTaken => NameTaken,
            c2c_create_community::Response::CyclesBalanceTooLow
            | c2c_create_community::Response::UserNotFound
            | c2c_create_community::Response::InternalError => InternalError,
        },
        Err(error) => {
            error!(?error, "Error calling create community");
            InternalError
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_community_args: c2c_create_community::Args,
}

fn prepare(args: Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many communities in succession
        false
    }

    let now = runtime_state.env.now();
    let is_diamond_member = runtime_state.data.is_diamond_member(now);

    if runtime_state.data.suspended.value {
        Err(UserSuspended)
    } else if !is_diamond_member {
        Err(Unauthorized)
    } else if runtime_state.data.communities.communities_created() >= COMMUNITY_CREATION_LIMIT {
        Err(MaxCommunitiesCreated(COMMUNITY_CREATION_LIMIT))
    } else if is_throttled() {
        Err(Throttled)
    } else if let Err(error) = validate_name(&args.name, args.is_public) {
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
    } else {
        let create_community_args = c2c_create_community::Args {
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            avatar: args.avatar,
            permissions: args.permissions,
            gate: args.gate,
        };
        Ok(PrepareResult {
            group_index_canister_id: runtime_state.data.group_index_canister_id,
            create_community_args,
        })
    }
}

fn commit(community_id: CommunityId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    runtime_state.data.communities.create(community_id, now);
}
