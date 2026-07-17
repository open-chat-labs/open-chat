use crate::{RuntimeState, model::moderation_flags::ModerationFlags, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::set_group_moderation_flags::{Response::*, *};
use user_index_canister_c2c_client::lookup_user;

#[update(msgpack = true)]
#[trace]
async fn set_group_moderation_flags(args: Args) -> Response {
    let (caller, user_index_canister_id) = read_state(|state| (state.env.caller(), state.data.user_index_canister_id));

    match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(user)) if user.is_platform_moderator => (),
        Ok(_) => return NotAuthorized,
        Err(error) => return InternalError(format!("{error:?}")),
    };

    mutate_state(|state| commit(&args, state))
}

fn commit(args: &Args, state: &mut RuntimeState) -> Response {
    if let Some(group) = state.data.public_groups.get(&args.chat_id) {
        if args.flags == group.moderation_flags().bits() {
            return Unchanged;
        }

        let Some(moderation_flags) = ModerationFlags::from_bits(args.flags) else {
            return InvalidFlags;
        };

        if state.set_group_moderation_flags(args.chat_id, moderation_flags) {
            Success
        } else {
            ChatNotFound
        }
    } else {
        ChatNotFound
    }
}
