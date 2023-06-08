use crate::{mutate_state, RuntimeState};
use group_index_canister::c2c_mark_community_active;
use types::{CanisterId, PublicCommunityActivity};

// If needed, notify the group index canister that there has been activity in this community
pub(crate) fn handle_activity_notification(state: &mut RuntimeState) {
    let now = state.env.now();
    let mark_active_duration = state.data.mark_active_duration;

    let requires_notification = state
        .data
        .activity_notification_state
        .start_if_required(now, mark_active_duration);

    if requires_notification {
        let public_community_activity = state.data.is_public.then_some(PublicCommunityActivity {
            timestamp: now,
            member_count: state.data.members.len(),
        });

        let args = c2c_mark_community_active::Args {
            duration: mark_active_duration,
            public_community_activity,
        };

        ic_cdk::spawn(call_group_index_canister(state.data.group_index_canister_id, args));
    }

    async fn call_group_index_canister(canister_id: CanisterId, args: c2c_mark_community_active::Args) {
        let response = group_index_canister_c2c_client::c2c_mark_community_active(canister_id, &args).await;
        mutate_state(|state| handle_response(response.is_ok(), state));
    }

    fn handle_response(success: bool, state: &mut RuntimeState) {
        if success {
            let now = state.env.now();
            state.data.activity_notification_state.mark_succeeded(now);
        } else {
            state.data.activity_notification_state.mark_failed();
        }
    }
}
