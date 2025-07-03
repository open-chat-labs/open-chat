use crate::model::events::stable_memory::EventsStableStorage;
use chat_events::GroupGateUpdatedInternal;
use community_canister::community_events::EventsPageArgs;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use types::{
    AvatarChanged, BannerChanged, BotAdded, BotRemoved, BotUpdated, ChannelCreated, ChannelDeleted, ChannelId, ChatId,
    CommunityEvent, CommunityEventCategory, CommunityEventType, CommunityMemberJoined, CommunityMembersRemoved,
    CommunityPermissionsChanged, CommunityRoleChanged, CommunityUsersBlocked, CommunityVisibilityChanged, EventIndex,
    EventWrapper, EventWrapperInternal, GroupCreated, GroupDescriptionChanged, GroupFrozen, GroupGateUpdated, GroupImported,
    GroupInviteCodeChanged, GroupNameChanged, GroupRulesChanged, GroupUnfrozen, MemberLeft, PrimaryLanguageChanged,
    TimestampMillis, UserId, UsersInvited, UsersUnblocked,
};

mod stable_memory;

#[derive(Serialize, Deserialize)]
pub struct CommunityEvents {
    stable_events_map: EventsStableStorage,
    latest_event_index: EventIndex,
    latest_event_timestamp: TimestampMillis,
    #[serde(default)]
    bot_subscriptions: BTreeMap<CommunityEventType, HashSet<UserId>>,
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
    #[serde(rename = "mj", alias = "MemberJoined")]
    MemberJoined(Box<CommunityMemberJoinedInternal>),
    #[serde(rename = "ml", alias = "MemberLeft")]
    MemberLeft(Box<MemberLeft>),
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
    #[serde(rename = "cc", alias = "ChannelCreated")]
    ChannelCreated(Box<ChannelCreated>),
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
    // TODO: Delete after communities are upgraded
    pub fn read_all_events(&self) -> Vec<EventWrapperInternal<CommunityEventInternal>> {
        self.stable_events_map.page(EventIndex::default(), true, u32::MAX)
    }

    // TODO: Delete after communities are upgraded
    // This function assumes:
    // - The event indexes of the given events are sequential and start from 0.
    // - There are now more events than previously
    pub fn overwrite_all_events(&mut self, events: Vec<EventWrapperInternal<CommunityEventInternal>>) {
        let latest = events.last().unwrap();
        self.latest_event_index = latest.index;
        self.latest_event_timestamp = latest.timestamp;

        for event in events {
            self.stable_events_map.insert(event);
        }
    }

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
            bot_subscriptions: BTreeMap::new(),
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

    pub fn get_page_events(
        &self,
        args: EventsPageArgs,
        permitted_event_types: &HashSet<CommunityEventCategory>,
    ) -> EventsResponse {
        self.filter_events_by_type(
            self.stable_events_map.page(args.start_index, args.ascending, args.max_events),
            permitted_event_types,
        )
    }

    pub fn get_by_indexes(
        &self,
        event_indexes: &[EventIndex],
        permitted_event_types: &HashSet<CommunityEventCategory>,
    ) -> EventsResponse {
        self.filter_events_by_type(
            event_indexes.iter().filter_map(|&e| self.stable_events_map.get(e)).collect(),
            permitted_event_types,
        )
    }

    pub fn subscribe_bot_to_events(&mut self, bot_id: UserId, event_types: HashSet<CommunityEventType>) {
        // Remove any existing subscriptions
        self.unsubscribe_bot_from_events(bot_id);

        // Add the new subscriptions (if any)
        for event_type in event_types {
            self.bot_subscriptions.entry(event_type).or_default().insert(bot_id);
        }
    }

    pub fn unsubscribe_bot_from_events(&mut self, bot_id: UserId) {
        for subscriptions in self.bot_subscriptions.values_mut() {
            subscriptions.remove(&bot_id);
        }
        self.bot_subscriptions.retain(|_, subscriptions| !subscriptions.is_empty());
    }

    pub fn bots_to_notify(&self, event_type: &CommunityEventType) -> Vec<UserId> {
        self.bot_subscriptions
            .get(event_type)
            .map(|s| s.iter().cloned().collect())
            .unwrap_or_default()
    }

    fn filter_events_by_type(
        &self,
        events: Vec<EventWrapperInternal<CommunityEventInternal>>,
        permitted_event_types: &HashSet<CommunityEventCategory>,
    ) -> EventsResponse {
        let mut response = EventsResponse {
            events: Vec::new(),
            unauthorized: Vec::new(),
            latest_event_index: self.latest_event_index,
        };

        for wrapper in events {
            let event: CommunityEvent = wrapper.event.into();

            if event
                .event_type()
                .is_none_or(|event_type| permitted_event_types.contains(&CommunityEventCategory::from(event_type)))
            {
                response.events.push(EventWrapper {
                    index: wrapper.index,
                    timestamp: wrapper.timestamp,
                    expires_at: wrapper.expires_at,
                    event,
                });
            } else {
                response.unauthorized.push(wrapper.index);
            }
        }

        response
    }
}
pub struct EventsResponse {
    pub events: Vec<EventWrapper<CommunityEvent>>,
    pub unauthorized: Vec<EventIndex>,
    pub latest_event_index: EventIndex,
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
            CommunityEventInternal::MemberJoined(event) => CommunityEvent::MemberJoined(Box::new((*event).into())),
            CommunityEventInternal::MemberLeft(event) => CommunityEvent::MemberLeft(event),
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
            CommunityEventInternal::ChannelCreated(event) => CommunityEvent::ChannelCreated(event),
            CommunityEventInternal::ChannelDeleted(event) => CommunityEvent::ChannelDeleted(event),
            CommunityEventInternal::PrimaryLanguageChanged(event) => CommunityEvent::PrimaryLanguageChanged(event),
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunityMemberJoinedInternal {
    #[serde(rename = "u", alias = "user_id")]
    pub user_id: UserId,
    #[serde(rename = "c", alias = "channel_id", skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<ChannelId>,
    #[serde(rename = "i", alias = "invited_by", skip_serializing_if = "Option::is_none")]
    pub invited_by: Option<UserId>,
}

impl From<CommunityMemberJoinedInternal> for CommunityMemberJoined {
    fn from(value: CommunityMemberJoinedInternal) -> Self {
        CommunityMemberJoined {
            user_id: value.user_id,
            invited_by: value.invited_by,
            channel_id: value.channel_id,
        }
    }
}
