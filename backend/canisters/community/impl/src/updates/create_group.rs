use crate::model::groups::Group;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::create_group::{Response::*, *};
use ic_cdk_macros::update;
use rand::Rng;
use types::CommunityGroupId;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update]
#[trace]
fn create_group(args: Args) -> Response {
    mutate_state(|state| create_group_impl(args, state))
}

fn create_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get_by_principal(&caller) {
        let is_authorized = if args.is_public {
            member.role.can_create_public_group(&state.data.permissions)
        } else {
            member.role.can_create_private_group(&state.data.permissions)
        };
        if is_authorized {
            NotAuthorized
        } else if let Err(error) = validate_name(&args.name, args.is_public) {
            match error {
                NameValidationError::TooShort(s) => NameTooShort(s),
                NameValidationError::TooLong(l) => NameTooLong(l),
                NameValidationError::Reserved => NameReserved,
            }
        } else if let Err(error) = validate_description(&args.description) {
            DescriptionTooLong(error)
        } else if let Err(error) = validate_rules(args.rules.enabled, &args.rules.text) {
            match error {
                RulesValidationError::TooShort(s) => RulesTooShort(s),
                RulesValidationError::TooLong(l) => RulesTooLong(l),
            }
        } else {
            let group_id: CommunityGroupId = state.env.rng().gen();
            let group = Group::new(
                args.is_public,
                args.name,
                args.description,
                args.rules,
                args.history_visible_to_new_joiners,
                state.env.now(),
            );
            state.data.groups.add(group_id, group);
            Success(SuccessResult { group_id })
        }
    } else {
        NotAuthorized
    }
}
