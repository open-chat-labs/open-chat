use crate::RuntimeState;
use fire_and_forget_handler::FireAndForgetHandler;
use group_index_canister::c2c_mark_community_active;
use msgpack::serialize_then_unwrap;
use types::{CanisterId, Milliseconds, PublicCommunityActivity};

// If needed, notify the group index canister that there has been activity in this community
pub(crate) fn handle_activity_notification(state: &mut RuntimeState) {
    let now = state.env.now();

    if let Some(mark_active_duration) = state.data.activity_notification_state.notify_if_required(now) {
        let public_community_activity = state.data.is_public.then(|| PublicCommunityActivity {
            timestamp: now,
            member_count: state.data.members.len(),
            channel_count: state.data.channels.public_channel_count(),
        });

        call_group_index_canister(
            state.data.group_index_canister_id,
            mark_active_duration,
            public_community_activity,
            &mut state.data.fire_and_forget_handler,
        );
    }

    fn call_group_index_canister(
        canister_id: CanisterId,
        duration: Milliseconds,
        public_community_activity: Option<PublicCommunityActivity>,
        fire_and_forget_handler: &mut FireAndForgetHandler,
    ) {
        let args = c2c_mark_community_active::Args {
            duration,
            public_community_activity,
        };

        fire_and_forget_handler.send(
            canister_id,
            "c2c_mark_community_active_msgpack".to_string(),
            serialize_then_unwrap(args),
        );
    }
}
