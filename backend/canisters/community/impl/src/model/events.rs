use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{
    AvatarChanged, BannerChanged, ChannelDeleted, CommunityPermissionsChanged, CommunityRoleChanged, DefaultChannelsChanged,
    EventIndex, EventWrapper, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupInviteCodeChanged,
    GroupNameChanged, GroupRulesChanged, GroupUnfrozen, GroupVisibilityChanged, MemberJoined, MemberLeft, MembersRemoved,
    PrimaryLanguageChanged, TimestampMillis, UserId, UsersBlocked, UsersInvited, UsersUnblocked,
};

#[derive(Serialize, Deserialize)]
pub struct CommunityEvents {
    events_map: BTreeMap<EventIndex, EventWrapper<CommunityEvent>>,
    latest_event_index: EventIndex,
    latest_event_timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEvent {
    Created(Box<GroupCreated>),
    NameChanged(Box<GroupNameChanged>),
    DescriptionChanged(Box<GroupDescriptionChanged>),
    RulesChanged(Box<GroupRulesChanged>),
    AvatarChanged(Box<AvatarChanged>),
    BannerChanged(Box<BannerChanged>),
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
    ChannelDeleted(Box<ChannelDeleted>),
    DefaultChannelsChanged(Box<DefaultChannelsChanged>),
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
}

impl CommunityEvents {
    pub fn new(name: String, description: String, created_by: UserId, now: TimestampMillis) -> CommunityEvents {
        let event_index = EventIndex::default();
        let mut events_map = BTreeMap::new();

        events_map.insert(
            event_index,
            EventWrapper {
                index: event_index,
                timestamp: now,
                correlation_id: 0,
                expires_at: None,
                event: CommunityEvent::Created(Box::new(GroupCreated {
                    name,
                    description,
                    created_by,
                })),
            },
        );

        CommunityEvents {
            events_map,
            latest_event_index: event_index,
            latest_event_timestamp: now,
        }
    }

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

        self.latest_event_index = event_index;
        self.latest_event_timestamp = now;

        event_index
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.latest_event_index.incr()
    }

    pub fn latest_event_index(&self) -> EventIndex {
        self.latest_event_index
    }

    pub fn latest_event_timestamp(&self) -> TimestampMillis {
        self.latest_event_timestamp
    }

    pub(crate) fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<CommunityEvent>> {
        self.events_map.get(&event_index)
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventIndex>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = &EventWrapper<CommunityEvent>> + '_> {
        let range = if let Some(start) = start {
            if let Some(event_index) = self.get(start).map(|e| e.index) {
                if ascending {
                    self.events_map.range(event_index..)
                } else {
                    self.events_map.range(EventIndex::default()..=event_index)
                }
            } else {
                return Box::new(std::iter::empty());
            }
        } else {
            self.events_map.range(EventIndex::default()..)
        };

        let iter = range.map(|(_, e)| e);

        if ascending {
            Box::new(iter)
        } else {
            Box::new(iter.rev())
        }
    }
}
