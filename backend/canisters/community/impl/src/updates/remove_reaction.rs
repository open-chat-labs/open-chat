use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::remove_reaction::*;
use types::OCResult;
use utils::migrated_user_ids::MigratedUserIds;

#[update(msgpack = true)]
#[trace]
fn remove_reaction(args: Args) -> Response {
    execute_update(|state| remove_reaction_impl(args, state)).into()
}

fn remove_reaction_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let user_id = state.get_calling_member(None, true)?.user_id;
    let now = state.env.now();
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;

    let result = channel.chat.remove_reaction(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        args.reaction,
        now,
        &MigratedUserIds::default(),
    )?;

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
