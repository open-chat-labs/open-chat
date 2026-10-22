use crate::RuntimeState;
use types::{ChatId, Milliseconds, PublicGroupActivity};

pub(crate) fn mark_group_active(
    chat_id: ChatId,
    duration: Milliseconds,
    public_group_activity: Option<PublicGroupActivity>,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    if let Some(g) = state.data.private_groups.get_mut(&chat_id) {
        g.mark_active(now + duration);
    } else if let Some(g) = state.data.public_groups.get_mut(&chat_id) {
        let activity = public_group_activity.unwrap_or_default();
        g.mark_active(now + duration, activity);
    }
}
