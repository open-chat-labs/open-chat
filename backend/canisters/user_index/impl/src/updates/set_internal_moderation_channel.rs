use crate::RuntimeState;
use tracing::info;
use types::OCResult;
use user_index_canister::set_internal_moderation_channel::Args;

// Behind dual authorization (#9136) - reachable only via propose_protected_action +
// confirm_protected_action by two different platform operators - because redirecting the
// channel points the stream of moderation alerts (report excerpts and context) at a channel
// of the caller's choosing.
pub(crate) fn execute(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.internal_moderation_channel = args.channel.map(|c| (c.community_id, c.channel_id));
    info!("Internal moderation channel updated");
    Ok(())
}
