use chat_events::GroupGateUpdatedInternal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{
    AvatarChanged, BannerChanged, ChannelDeleted, ChannelId, ChatId, CommunityMemberLeftInternal, CommunityMembersRemoved,
    CommunityPermissionsChanged, CommunityRoleChanged, CommunityUsersBlocked, CommunityVisibilityChanged,
    DefaultChannelsChanged, EventIndex, EventWrapper, GroupCreated, GroupDescriptionChanged, GroupFrozen,
    GroupInviteCodeChanged, GroupNameChanged, GroupRulesChanged, GroupUnfrozen, MemberJoinedInternal, PrimaryLanguageChanged,
    TimestampMillis, UserId, UsersInvited, UsersUnblocked,
};

#[derive(Serialize, Deserialize)]
pub struct CommunityEvents {
    events_map: BTreeMap<EventIndex, EventWrapper<CommunityEventInternal>>,
    latest_event_index: EventIndex,
    latest_event_timestamp: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum CommunityEventInternal {
    #[serde(rename = "cr", alias = "Created")]
    Created(Box<GroupCreated>),
    #[serde(rename = "nc", alias = "NameChanged")]
    NameChanged(Box<GroupNameChanged>),
    #[serde(rename = "dc", alias = "DescriptionChanged")]
    DescriptionChanged(Box<GroupDescriptionChanged>),
    #[serde(rename = "rc", alias = "RulesChanged")]
    RulesChanged(Box<GroupRulesChanged>),
    #[serde(rename = "ac", alias = "AvatarChanged")]
    AvatarChanged(Box<AvatarChanged>),
    #[serde(rename = "bc", alias = "BannerChanged")]
    BannerChanged(Box<BannerChanged>),
    #[serde(rename = "ui", alias = "UsersInvited")]
    UsersInvited(Box<UsersInvited>),
    #[serde(rename = "mj", alias = "MemberJoined")]
    MemberJoined(Box<MemberJoinedInternal>),
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
    #[serde(rename = "ml", alias = "MemberLeft")]
    MemberLeft(Box<CommunityMemberLeftInternal>),
    #[serde(rename = "rc", alias = "RoleChanged")]
    RoleChanged(Box<CommunityRoleChanged>),
    #[serde(rename = "ub", alias = "UsersBlocked")]
    UsersBlocked(Box<CommunityUsersBlocked>),
    #[serde(rename = "uu", alias = "UsersUnblocked")]
    UsersUnblocked(Box<UsersUnblocked>),
    #[serde(rename = "pc", alias = "PermissionsChanged")]
    PermissionsChanged(Box<CommunityPermissionsChanged>),
    #[serde(rename = "vc", alias = "VisibilityChanged")]
    VisibilityChanged(Box<CommunityVisibilityChanged>),
    #[serde(rename = "ic", alias = "InviteCodeChanged")]
    InviteCodeChanged(Box<GroupInviteCodeChanged>),
    #[serde(rename = "fr", alias = "Frozen")]
    Frozen(Box<GroupFrozen>),
    #[serde(rename = "uf", alias = "Unfrozen")]
    Unfrozen(Box<GroupUnfrozen>),
    #[serde(rename = "gu", alias = "GateUpdated")]
    GateUpdated(Box<GroupGateUpdatedInternal>),
    #[serde(rename = "cd", alias = "ChannelDeleted")]
    ChannelDeleted(Box<ChannelDeleted>),
    #[serde(rename = "dcc", alias = "DefaultChannelsChanged")]
    DefaultChannelsChanged(Box<DefaultChannelsChanged>),
    #[serde(rename = "pl", alias = "PrimaryLanguageChanged")]
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
    #[serde(rename = "gi", alias = "GroupImported")]
    GroupImported(Box<GroupImportedInternal>),
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
                event: CommunityEventInternal::Created(Box::new(GroupCreated {
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

    pub(crate) fn push_event(&mut self, event: CommunityEventInternal, now: TimestampMillis) -> EventIndex {
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

    pub(crate) fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<CommunityEventInternal>> {
        self.events_map.get(&event_index)
    }

    pub(crate) fn iter(
        &self,
        start: Option<EventIndex>,
        ascending: bool,
    ) -> Box<dyn Iterator<Item = &EventWrapper<CommunityEventInternal>> + '_> {
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupImportedInternal {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
    pub members_added: Vec<UserId>,
}
