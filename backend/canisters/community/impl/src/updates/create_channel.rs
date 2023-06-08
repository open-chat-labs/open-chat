use crate::{activity_notifications::handle_activity_notification, model::channels::Channel, mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::create_channel::{Response::*, *};
use group_chat_core::GroupChatCore;
use ic_cdk_macros::update;
use rand::Rng;
use types::ChannelId;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[update]
#[trace]
fn create_channel(args: Args) -> Response {
    mutate_state(|state| create_channel_impl(args, state))
}

fn create_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get_mut(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let is_authorized = if args.is_public {
            member.role.can_create_public_channel(&state.data.permissions)
        } else {
            member.role.can_create_private_channel(&state.data.permissions)
        };

        if !is_authorized {
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
            let channel_id: ChannelId = state.env.rng().gen();
            let chat = GroupChatCore::new(
                member.user_id,
                args.is_public,
                args.name,
                args.description,
                args.rules,
                None,
                None,
                args.history_visible_to_new_joiners,
                args.permissions.unwrap_or_default(),
                args.gate,
                args.events_ttl,
                state.env.now(),
            );
            state.data.channels.add(Channel { id: channel_id, chat });
            member.channels.insert(channel_id);
            handle_activity_notification(state);
            Success(SuccessResult { channel_id })
        }
    } else {
        NotAuthorized
    }
}
