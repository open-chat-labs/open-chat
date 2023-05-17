use std::collections::BTreeMap;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    AvatarChanged, CommunityPermissionsChanged, CommunityRoleChanged, EventIndex, EventWrapper, GroupCreated,
    GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged, GroupNameChanged, GroupRulesChanged,
    GroupUnfrozen, GroupVisibilityChanged, MemberJoined, MemberLeft, MembersRemoved, TimestampMillis, UsersBlocked,
    UsersInvited, UsersUnblocked,
};

#[derive(Serialize, Deserialize, Default)]
pub struct CommunityEvents {
    events_map: BTreeMap<EventIndex, EventWrapper<CommunityEvent>>,
    latest_event_index: Option<EventIndex>,
    latest_event_timestamp: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEvent {
    Created(Box<GroupCreated>),
    NameChanged(Box<GroupNameChanged>),
    DescriptionChanged(Box<GroupDescriptionChanged>),
    RulesChanged(Box<GroupRulesChanged>),
    AvatarChanged(Box<AvatarChanged>),
    UsersInvited(Box<UsersInvited>),
    MemberJoined(Box<MemberJoined>),
    MembersRemoved(Box<MembersRemoved>),
    MemberLeft(Box<MemberLeft>),
    RoleChanged(Box<CommunityRoleChanged>),
    UsersBlocked(Box<UsersBlocked>),
    UsersUnblocked(Box<UsersUnblocked>),
    PermissionsChanged(Box<CommunityPermissionsChanged>),
    VisibilityChanged(Box<GroupVisibilityChanged>),
    InviteCodeChanged(Box<GroupInviteCodeChanged>),
    Frozen(Box<GroupFrozen>),
    Unfrozen(Box<GroupUnfrozen>),
    GateUpdated(Box<GroupGateUpdated>),
}

impl CommunityEvents {
    pub(crate) fn push_event(&mut self, event: CommunityEvent, now: TimestampMillis) -> EventIndex {
        let event_index = self.next_event_index();

        self.events_map.insert(
            event_index,
            EventWrapper {
                index: event_index,
                timestamp: now,
                correlation_id: 0,
                expires_at: None,
                event,
            },
        );
        self.latest_event_index = Some(event_index);
        self.latest_event_timestamp = Some(now);

        event_index
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.map_or(EventIndex::default(), |e| e.incr())
    }
}
