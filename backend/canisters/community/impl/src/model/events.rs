use crate::model::events::stable_memory::EventsStableStorage;
use chat_events::GroupGateUpdatedInternal;
use community_canister::community_events::EventsPageArgs;
use serde::{Deserialize, Serialize};
use types::{
    AvatarChanged, BannerChanged, BotAdded, BotRemoved, BotUpdated, ChannelDeleted, ChannelId, ChatId, CommunityEvent,
    CommunityMembersRemoved, CommunityPermissionsChanged, CommunityRoleChanged, CommunityUsersBlocked,
    CommunityVisibilityChanged, EventIndex, EventWrapper, EventWrapperInternal, GroupCreated, GroupDescriptionChanged,
    GroupFrozen, GroupGateUpdated, GroupImported, GroupInviteCodeChanged, GroupNameChanged, GroupRulesChanged, GroupUnfrozen,
    PrimaryLanguageChanged, TimestampMillis, UserId, UsersInvited, UsersUnblocked,
};

mod stable_memory;

#[derive(Serialize, Deserialize)]
pub struct CommunityEvents {
    stable_events_map: EventsStableStorage,
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
    #[serde(rename = "mr", alias = "MembersRemoved")]
    MembersRemoved(Box<CommunityMembersRemoved>),
    #[serde(rename = "rl", alias = "RoleChanged")]
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
    #[serde(rename = "pl", alias = "PrimaryLanguageChanged")]
    PrimaryLanguageChanged(Box<PrimaryLanguageChanged>),
    #[serde(rename = "gi", alias = "GroupImported")]
    GroupImported(Box<GroupImportedInternal>),
    #[serde(rename = "ba")]
    BotAdded(Box<BotAdded>),
    #[serde(rename = "br")]
    BotRemoved(Box<BotRemoved>),
    #[serde(rename = "bu")]
    BotUpdated(Box<BotUpdated>),
    // This should never happen!
    // But if it ever does, it's better to return the remaining events
    // than to endlessly fail attempting to load the broken event(s)
    #[serde(rename = "fd")]
    FailedToDeserialize,
}

impl CommunityEvents {
    pub fn new(name: String, description: String, created_by: UserId, now: TimestampMillis) -> CommunityEvents {
        let event_index = EventIndex::default();
        let event = EventWrapperInternal {
            index: event_index,
            timestamp: now,
            expires_at: None,
            event: CommunityEventInternal::Created(Box::new(GroupCreated {
                name,
                description,
                created_by,
            })),
        };

        let mut stable_events_map = EventsStableStorage::default();
        stable_events_map.insert(event);

        CommunityEvents {
            stable_events_map,
            latest_event_index: event_index,
            latest_event_timestamp: now,
        }
    }

    pub(crate) fn push_event(&mut self, event: CommunityEventInternal, now: TimestampMillis) -> EventIndex {
        let event_index = self.next_event_index();
        self.stable_events_map.insert(EventWrapperInternal {
            index: event_index,
            timestamp: now,
            expires_at: None,
            event,
        });

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

    pub fn get_page_events(&self, args: EventsPageArgs) -> Vec<EventWrapper<CommunityEvent>> {
        self.stable_events_map
            .page(args.start_index, args.ascending, args.max_events)
            .into_iter()
            .map(|e| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                expires_at: e.expires_at,
                event: e.event.into(),
            })
            .collect()
    }

    pub fn get_by_indexes(&self, event_indexes: &[EventIndex]) -> Vec<EventWrapper<CommunityEvent>> {
        event_indexes
            .iter()
            .filter_map(|&e| self.stable_events_map.get(e))
            .map(|e| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                expires_at: e.expires_at,
                event: e.event.clone().into(),
            })
            .collect()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GroupImportedInternal {
    pub group_id: ChatId,
    pub channel_id: ChannelId,
    pub members_added: Vec<UserId>,
}

impl From<CommunityEventInternal> for CommunityEvent {
    fn from(value: CommunityEventInternal) -> Self {
        match value {
            CommunityEventInternal::Created(event) => CommunityEvent::Created(event),
            CommunityEventInternal::NameChanged(event) => CommunityEvent::NameChanged(event),
            CommunityEventInternal::DescriptionChanged(event) => CommunityEvent::DescriptionChanged(event),
            CommunityEventInternal::RulesChanged(event) => CommunityEvent::RulesChanged(event),
            CommunityEventInternal::AvatarChanged(event) => CommunityEvent::AvatarChanged(event),
            CommunityEventInternal::BannerChanged(event) => CommunityEvent::BannerChanged(event),
            CommunityEventInternal::UsersInvited(event) => CommunityEvent::UsersInvited(event),
            CommunityEventInternal::MembersRemoved(event) => CommunityEvent::MembersRemoved(event),
            CommunityEventInternal::RoleChanged(event) => CommunityEvent::RoleChanged(event),
            CommunityEventInternal::UsersBlocked(event) => CommunityEvent::UsersBlocked(event),
            CommunityEventInternal::UsersUnblocked(event) => CommunityEvent::UsersUnblocked(event),
            CommunityEventInternal::PermissionsChanged(event) => CommunityEvent::PermissionsChanged(event),
            CommunityEventInternal::VisibilityChanged(event) => CommunityEvent::VisibilityChanged(event),
            CommunityEventInternal::InviteCodeChanged(event) => CommunityEvent::InviteCodeChanged(event),
            CommunityEventInternal::Frozen(event) => CommunityEvent::Frozen(event),
            CommunityEventInternal::Unfrozen(event) => CommunityEvent::Unfrozen(event),
            CommunityEventInternal::GateUpdated(event) => CommunityEvent::GateUpdated(Box::new(GroupGateUpdated {
                updated_by: event.updated_by,
                new_gate_config: event.new_gate_config.map(|gc| gc.into()),
            })),
            CommunityEventInternal::ChannelDeleted(event) => CommunityEvent::ChannelDeleted(Box::new(ChannelDeleted {
                channel_id: event.channel_id,
                name: event.name,
                deleted_by: event.deleted_by,
                bot_command: event.bot_command,
            })),
            CommunityEventInternal::PrimaryLanguageChanged(event) => {
                CommunityEvent::PrimaryLanguageChanged(Box::new(PrimaryLanguageChanged {
                    previous: event.previous,
                    new: event.new,
                    changed_by: event.changed_by,
                }))
            }
            CommunityEventInternal::GroupImported(event) => CommunityEvent::GroupImported(Box::new(GroupImported {
                group_id: event.group_id,
                channel_id: event.channel_id,
            })),
            CommunityEventInternal::BotAdded(event) => CommunityEvent::BotAdded(event),
            CommunityEventInternal::BotRemoved(event) => CommunityEvent::BotRemoved(event),
            CommunityEventInternal::BotUpdated(event) => CommunityEvent::BotUpdated(event),
            CommunityEventInternal::FailedToDeserialize => CommunityEvent::FailedToDeserialize,
        }
    }
}
