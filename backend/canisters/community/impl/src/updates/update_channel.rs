use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::update_channel::{Response::*, *};
use group_chat_core::UpdateResult;
use ic_cdk_macros::update;
use types::OptionUpdate;

#[update]
#[trace]
fn update_channel(args: Args) -> Response {
    mutate_state(|state| update_channel_impl(args, state))
}

fn update_channel_impl(mut args: Args, state: &mut RuntimeState) -> Response {
    clean_args(&mut args);

    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let caller = state.env.caller();

        if let Some(member) = state.data.members.get(caller) {
            match channel.chat.update(
                member.user_id,
                args.name,
                args.description,
                args.rules,
                args.avatar,
                args.permissions,
                args.gate,
                OptionUpdate::NoChange,
                state.env.now(),
            ) {
                UpdateResult::Success => Success,
                UpdateResult::UserSuspended => UserSuspended,
                UpdateResult::UserNotInGroup => UserNotInChannel,
                UpdateResult::NotAuthorized => NotAuthorized,
                UpdateResult::NameTooShort(v) => NameTooShort(v),
                UpdateResult::NameTooLong(v) => NameTooLong(v),
                UpdateResult::NameReserved => NameReserved,
                UpdateResult::DescriptionTooLong(v) => DescriptionTooLong(v),
                UpdateResult::RulesTooShort(v) => RulesTooShort(v),
                UpdateResult::RulesTooLong(v) => RulesTooLong(v),
                UpdateResult::AvatarTooBig(v) => AvatarTooBig(v),
                UpdateResult::NameTaken => NameTaken,
            }
        } else {
            UserNotInCommunity
        }
    } else {
        ChannelNotFound
    }
}

fn clean_args(args: &mut Args) {
    args.name = args.name.as_ref().map(|name| name.trim().to_string());
    args.description = args.description.as_ref().map(|desc| desc.trim().to_string());

    if let Some(rules) = &mut args.rules {
        rules.text = rules.text.trim().to_string();
    }
}
