use crate::User;
use group_index_canister::c2c_create_group;
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis, UserId};
use user_canister::create_group::Args;
use utils::document::validate_avatar;
use utils::text_validation::{
    NameValidationError, RulesValidationError, validate_description, validate_group_name, validate_rules,
};

// Validates the args and that the user may create the group, returning what to send the GroupIndex.
// `user_id` is the user the GroupIndex should create the group for, which a User canister leaves
// unset since it is the user.
pub fn prepare(
    user: &User,
    mut args: Args,
    user_id: Option<UserId>,
    test_mode: bool,
    now: TimestampMillis,
) -> OCResult<c2c_create_group::Args> {
    user.verify_not_suspended()?;

    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();
    args.rules.text = args.rules.text.trim().to_string();

    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    let membership = user.membership(now);
    let group_creation_limit = membership.group_creation_limit();

    if !membership.is_diamond_member() && args.is_public {
        Err(OCErrorCode::NotDiamondMember.into())
    } else if user.group_chats.groups_created() >= group_creation_limit {
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
    } else if args.gate_config.as_ref().map(|g| !g.validate(test_mode)).unwrap_or_default() {
        Err(OCErrorCode::InvalidAccessGate.into())
    } else {
        Ok(c2c_create_group::Args {
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
            user_id,
        })
    }
}
