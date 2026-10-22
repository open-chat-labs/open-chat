use crate::RuntimeState;
use types::{CommunityId, Milliseconds, PublicCommunityActivity};

pub(crate) fn mark_community_active(
    community_id: CommunityId,
    duration: Milliseconds,
    activity: Option<PublicCommunityActivity>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    if let Some(c) = state.data.private_communities.get_mut(&community_id) {
        c.mark_active(now + duration);
    } else if let Some(c) = state.data.public_communities.get_mut(&community_id) {
        let activity = activity.unwrap_or_default();
        c.mark_active(now + duration, activity);
    }
}
