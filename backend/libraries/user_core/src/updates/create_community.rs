use crate::{COMMUNITY_CREATION_LIMIT, User};
use group_index_canister::c2c_create_community;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{OCResult, TimestampMillis, UserId};
use user_canister::create_community::Args;
use utils::document::{validate_avatar, validate_banner};
use utils::text_validation::{
    NameValidationError, RulesValidationError, validate_channel_name, validate_community_name, validate_description,
    validate_rules,
};

// Validates the args and that the user may create the community, returning what to send the
// GroupIndex. `user_id` is the user the GroupIndex should create the community for, which a User
// canister leaves unset since it is the user.
pub fn prepare(
    user: &User,
    mut args: Args,
    user_id: Option<UserId>,
    test_mode: bool,
    now: TimestampMillis,
) -> OCResult<c2c_create_community::Args> {
    user.verify_not_suspended()?;

    args.name = args.name.trim().to_string();
    args.description = args.description.trim().to_string();
    args.rules.text = args.rules.text.trim().to_string();
    args.default_channels = args.default_channels.into_iter().map(|c| c.trim().to_string()).collect();

    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many communities in succession
        false
    }

    let is_diamond_member = user.membership(now).is_diamond_member();

    if !is_diamond_member {
        Err(OCErrorCode::NotDiamondMember.into())
    } else if user.communities.communities_created() >= COMMUNITY_CREATION_LIMIT {
        Err(OCErrorCode::MaxCommunitiesCreated.with_message(COMMUNITY_CREATION_LIMIT))
    } else if is_throttled() {
        Err(OCErrorCode::Throttled.into())
    } else if let Err(error) = validate_community_name(&args.name, args.is_public) {
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
    } else if let Err(error) = validate_banner(args.banner.as_ref()) {
        Err(OCErrorCode::BannerTooBig.with_json(&error))
    } else if args.gate_config.as_ref().map(|g| !g.validate(test_mode)).unwrap_or_default() {
        Err(OCErrorCode::InvalidAccessGate.into())
    } else if !default_channels_valid(&args.default_channels) {
        Err(OCErrorCode::InvalidChannelName.into())
    } else {
        Ok(c2c_create_community::Args {
            is_public: args.is_public,
            name: args.name,
            description: args.description,
            rules: args.rules,
            history_visible_to_new_joiners: args.history_visible_to_new_joiners,
            avatar: args.avatar,
            banner: args.banner,
            permissions: args.permissions,
            gate_config: args.gate_config,
            default_channels: args.default_channels,
            default_channel_rules: args.default_channel_rules,
            primary_language: args.primary_language,
            user_id,
        })
    }
}

fn default_channels_valid(default_channels: &[String]) -> bool {
    if default_channels.is_empty() || default_channels.iter().any(|channel| validate_channel_name(channel).is_err()) {
        return false;
    }

    let names: HashSet<String> = default_channels.iter().map(|name| name.to_lowercase()).collect();

    if names.len() != default_channels.len() {
        return false;
    }

    true
}
