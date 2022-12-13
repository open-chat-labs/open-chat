use crate::types::{ChatEventInternal, MessageInternal, UpdatedMessageInternal};
use crate::{ProposalsUpdatedInternal, ThreadUpdatedInternal};
use candid::CandidType;
use itertools::Itertools;
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::{max, min, Reverse};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::iter::FromIterator;
use std::ops::{Bound, Deref, DerefMut, RangeBounds, RangeInclusive};
use types::*;

#[derive(Serialize, Deserialize)]
pub struct AllChatEvents {
    chat_id: ChatId,
    main: ChatEvents,
    threads: HashMap<MessageIndex, ChatEvents>,
    metrics: ChatMetrics,
    per_user_metrics: HashMap<UserId, ChatMetrics>,
    #[serde(default)]
    frozen: bool,
}

impl AllChatEvents {
    pub fn get_poll_end_dates(&mut self) -> Vec<(Option<MessageIndex>, MessageIndex, TimestampMillis)> {
        self.threads
            .iter()
            .flat_map(|(thread_root_message_index, events)| {
                events
                    .iter()
                    .filter_map(|e| e.event.as_message())
                    .map(|m| (Some(*thread_root_message_index), m))
            })
            .chain(
                self.main
                    .events
                    .iter()
                    .filter_map(|e| e.event.as_message())
                    .map(|e| (None, e)),
            )
            .filter_map(
                |(t, m)| if let MessageContentInternal::Poll(p) = &m.content { Some((t, m.message_index, p)) } else { None },
            )
            .filter(|(_, _, p)| !p.ended && p.config.end_date.is_some())
            .map(|(t, m, p)| (t, m, p.config.end_date.unwrap()))
            .collect()
    }

    pub fn recalculate_reported_message_metrics(&mut self) {
        let users: Vec<_> = self
            .threads
            .iter()
            .flat_map(|(_, events)| events.iter().filter_map(|e| e.event.as_message()))
            .chain(self.main.events.iter().filter_map(|e| e.event.as_message()))
            .filter(|m| m.deleted_by.as_ref().map_or(false, |d| d.deleted_by != m.sender))
            .map(|m| m.sender)
            .collect();

        self.metrics.reported_messages = 0;
        for metrics in self.per_user_metrics.values_mut() {
            metrics.reported_messages = 0;
        }

        for user_id in users {
            self.metrics.reported_messages += 1;
            self.per_user_metrics.entry(user_id).or_default().reported_messages += 1;
        }
    }

    pub fn new_direct_chat(them: UserId, now: TimestampMillis) -> AllChatEvents {
        let mut events = ChatEvents {
            chat_id: them.into(),
            thread_root_message_index: None,
            events_type: ChatEventsType::Direct,
            events: ChatEventsVec::default(),
            message_id_map: HashMap::new(),
            message_index_map: BTreeMap::new(),
        };

        events.push_event(ChatEventInternal::DirectChatCreated(DirectChatCreated {}), 0, now);

        AllChatEvents {
            chat_id: them.into(),
            main: events,
            threads: HashMap::new(),
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
        }
    }

    pub fn new_group_chat(
        chat_id: ChatId,
        name: String,
        description: String,
        created_by: UserId,
        now: TimestampMillis,
    ) -> AllChatEvents {
        let mut events = ChatEvents {
            chat_id,
            thread_root_message_index: None,
            events_type: ChatEventsType::Group,
            events: ChatEventsVec::default(),
            message_id_map: HashMap::new(),
            message_index_map: BTreeMap::new(),
        };

        events.push_event(
            ChatEventInternal::GroupChatCreated(Box::new(GroupChatCreated {
                name,
                description,
                created_by,
            })),
            0,
            now,
        );

        AllChatEvents {
            chat_id,
            main: events,
            threads: HashMap::new(),
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
        }
    }

    pub fn push_message(&mut self, args: PushMessageArgs) -> EventWrapper<Message> {
        let chat_events = if let Some(root_message_index) = args.thread_root_message_index {
            self.threads
                .entry(root_message_index)
                .or_insert_with(|| ChatEvents::new_thread(self.chat_id, root_message_index))
        } else {
            &mut self.main
        };

        let message_index = chat_events.next_message_index();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            replies_to: args.replies_to,
            reactions: Vec::new(),
            last_updated: None,
            last_edited: None,
            deleted_by: None,
            thread_summary: None,
            forwarded: args.forwarded,
        };
        let message = chat_events.hydrate_message(&message_internal, Some(message_internal.sender));

        let event_index = self.push_event(
            args.thread_root_message_index,
            ChatEventInternal::Message(Box::new(message_internal)),
            args.correlation_id,
            args.now,
        );

        if let Some(root_message_index) = args.thread_root_message_index {
            self.main.update_thread_summary(
                root_message_index,
                args.sender,
                Some(message_index),
                event_index,
                args.correlation_id,
                args.now,
            );
        }

        EventWrapper {
            index: event_index,
            timestamp: args.now,
            correlation_id: args.correlation_id,
            event: message,
        }
    }

    pub fn edit_message(&mut self, args: EditMessageArgs) -> EditMessageResult {
        if let Some(message) = self.message_internal_mut_by_message_id(args.thread_root_message_index, args.message_id) {
            if message.sender == args.sender {
                if !matches!(message.content, MessageContentInternal::Deleted(_)) {
                    message.content = args.content.new_content_into_internal();
                    message.last_updated = Some(args.now);
                    message.last_edited = Some(args.now);
                    let event_index = self.push_event(
                        args.thread_root_message_index,
                        ChatEventInternal::MessageEdited(Box::new(UpdatedMessageInternal {
                            updated_by: args.sender,
                            message_id: args.message_id,
                        })),
                        args.correlation_id,
                        args.now,
                    );

                    if let Some(root_message_index) = args.thread_root_message_index {
                        self.main.update_thread_summary(
                            root_message_index,
                            args.sender,
                            None,
                            event_index,
                            args.correlation_id,
                            args.now,
                        );
                    }

                    return EditMessageResult::Success;
                }
            } else {
                return EditMessageResult::NotAuthorized;
            }
        }

        EditMessageResult::NotFound
    }

    pub fn delete_messages(
        &mut self,
        caller: UserId,
        is_admin: bool,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> Vec<(MessageId, DeleteMessageResult)> {
        let results = message_ids
            .into_iter()
            .map(|message_id| {
                (
                    message_id,
                    self.delete_message(caller, is_admin, thread_root_message_index, message_id, correlation_id, now),
                )
            })
            .collect();

        if let Some(root_message_index) = thread_root_message_index {
            if let Some(thread_events) = self.threads.get(&root_message_index) {
                self.main.update_thread_summary(
                    root_message_index,
                    caller,
                    None,
                    thread_events.last().index,
                    correlation_id,
                    now,
                );
            }
        }

        results
    }

    pub fn undelete_messages(
        &mut self,
        caller: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> Vec<(MessageId, UndeleteMessageResult)> {
        let results = message_ids
            .into_iter()
            .map(|message_id| {
                (
                    message_id,
                    self.undelete_message(caller, thread_root_message_index, message_id, correlation_id, now),
                )
            })
            .collect();

        if let Some(root_message_index) = thread_root_message_index {
            if let Some(thread_events) = self.threads.get(&root_message_index) {
                self.main.update_thread_summary(
                    root_message_index,
                    caller,
                    None,
                    thread_events.last().index,
                    correlation_id,
                    now,
                );
            }
        }

        results
    }

    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<MessageContentInternal> {
        let message = self.message_internal_mut_by_message_id(thread_root_message_index, message_id)?;
        let deleted_by = message.deleted_by.clone()?;

        Some(std::mem::replace(
            &mut message.content,
            MessageContentInternal::Deleted(deleted_by),
        ))
    }

    pub fn register_poll_vote(&mut self, args: RegisterPollVoteArgs) -> RegisterPollVoteResult {
        if let Some(message) = self.message_internal_mut_by_message_index(args.thread_root_message_index, args.message_index) {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return match p.register_vote(args.user_id, args.option_index, args.operation) {
                    types::RegisterVoteResult::Success(existing_vote_removed) => {
                        message.last_updated = Some(args.now);
                        let event = match args.operation {
                            VoteOperation::RegisterVote => {
                                ChatEventInternal::PollVoteRegistered(Box::new(PollVoteRegistered {
                                    user_id: args.user_id,
                                    message_id: message.message_id,
                                    existing_vote_removed,
                                }))
                            }
                            VoteOperation::DeleteVote => ChatEventInternal::PollVoteDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: args.user_id,
                                message_id: message.message_id,
                            })),
                        };
                        let votes = p.hydrate(Some(args.user_id)).votes;
                        let event_index = self.push_event(args.thread_root_message_index, event, args.correlation_id, args.now);

                        if let Some(root_message_index) = args.thread_root_message_index {
                            self.main.update_thread_summary(
                                root_message_index,
                                args.user_id,
                                None,
                                event_index,
                                args.correlation_id,
                                args.now,
                            );
                        }

                        RegisterPollVoteResult::Success(votes)
                    }
                    types::RegisterVoteResult::SuccessNoChange => {
                        RegisterPollVoteResult::SuccessNoChange(p.hydrate(Some(args.user_id)).votes)
                    }
                    types::RegisterVoteResult::PollEnded => RegisterPollVoteResult::PollEnded,
                    types::RegisterVoteResult::OptionIndexOutOfRange => RegisterPollVoteResult::OptionIndexOutOfRange,
                };
            }
        }

        RegisterPollVoteResult::PollNotFound
    }

    pub fn end_poll(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> EndPollResult {
        if let Some(message) = self.message_internal_mut_by_message_index(thread_root_message_index, message_index) {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return if p.ended || p.config.end_date.is_none() {
                    EndPollResult::UnableToEndPoll
                } else {
                    message.last_updated = Some(now);
                    p.ended = true;
                    let event = ChatEventInternal::PollEnded(Box::new(message_index));
                    self.push_event(thread_root_message_index, event, correlation_id, now);
                    EndPollResult::Success
                };
            }
        }

        EndPollResult::PollNotFound
    }

    pub fn record_proposal_vote(
        &mut self,
        user_id: UserId,
        message_index: MessageIndex,
        adopt: bool,
    ) -> RecordProposalVoteResult {
        if let Some(proposal) = self.main.message_internal_mut_by_message_index(message_index).and_then(|m| {
            if let MessageContentInternal::GovernanceProposal(p) = &mut m.content {
                Some(p)
            } else {
                None
            }
        }) {
            match proposal.votes.entry(user_id) {
                Vacant(e) => {
                    // We choose not to update the `last_updated` field on the message here because
                    // the update is private, only visible to the current user, and updating the
                    // field would cause the message to be returned to all users unnecessarily.
                    e.insert(adopt);
                    RecordProposalVoteResult::Success
                }
                Occupied(e) => RecordProposalVoteResult::AlreadyVoted(*e.get()),
            }
        } else {
            RecordProposalVoteResult::ProposalNotFound
        }
    }

    pub fn add_reaction(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        reaction: Reaction,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> AddRemoveReactionResult {
        if !reaction.is_valid() {
            // This should never happen because we validate earlier
            panic!("Invalid reaction: {reaction:?}");
        }

        if let Some(message) = self.message_internal_mut_by_message_id(thread_root_message_index, message_id) {
            let added = if let Some((_, users)) = message.reactions.iter_mut().find(|(r, _)| *r == reaction) {
                users.insert(user_id)
            } else {
                message.reactions.push((reaction, vec![user_id].into_iter().collect()));
                true
            };

            if !added {
                return AddRemoveReactionResult::NoChange;
            }

            message.last_updated = Some(now);

            let new_event_index = self.push_event(
                thread_root_message_index,
                ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                    updated_by: user_id,
                    message_id,
                })),
                correlation_id,
                now,
            );

            if let Some(root_message_index) = thread_root_message_index {
                self.main
                    .update_thread_summary(root_message_index, user_id, None, new_event_index, correlation_id, now);
            }

            AddRemoveReactionResult::Success(new_event_index)
        } else {
            AddRemoveReactionResult::MessageNotFound
        }
    }

    pub fn remove_reaction(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        reaction: Reaction,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> AddRemoveReactionResult {
        if let Some(message) = self.message_internal_mut_by_message_id(thread_root_message_index, message_id) {
            let (removed, is_empty) = message
                .reactions
                .iter_mut()
                .find(|(r, _)| *r == reaction)
                .map(|(_, u)| (u.remove(&user_id), u.is_empty()))
                .unwrap_or_default();

            if !removed {
                return AddRemoveReactionResult::NoChange;
            }

            if is_empty {
                message.reactions.retain(|(_, u)| !u.is_empty());
            }

            message.last_updated = Some(now);

            let new_event_index = self.push_event(
                thread_root_message_index,
                ChatEventInternal::MessageReactionRemoved(Box::new(UpdatedMessageInternal {
                    updated_by: user_id,
                    message_id,
                })),
                correlation_id,
                now,
            );

            if let Some(root_message_index) = thread_root_message_index {
                self.main
                    .update_thread_summary(root_message_index, user_id, None, new_event_index, correlation_id, now);
            }

            AddRemoveReactionResult::Success(new_event_index)
        } else {
            AddRemoveReactionResult::MessageNotFound
        }
    }

    pub fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        if let Some(thread_events) = self.threads.get(&thread_root_message_index) {
            self.main.update_thread_summary(
                thread_root_message_index,
                user_id,
                latest_thread_message_index_if_updated,
                thread_events.last().index,
                correlation_id,
                now,
            );
        }
    }

    pub fn update_proposals(
        &mut self,
        user_id: UserId,
        updates: Vec<(MessageId, ProposalStatusUpdate)>,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        let mut message_indexes = Vec::new();

        let chat_events = &mut self.main;

        for (message_id, update) in updates {
            if let Some(message) = chat_events
                .message_internal_mut_by_message_id(message_id)
                .filter(|m| m.sender == user_id)
            {
                if let MessageContentInternal::GovernanceProposal(p) = &mut message.content {
                    p.proposal.update_status(update, now);
                    message_indexes.push(message.message_index);
                }
            }
        }
        if !message_indexes.is_empty() {
            message_indexes.sort_unstable();

            let mut last_event = chat_events.events.last_mut().unwrap();
            let matches_last_event = if let ChatEventInternal::ProposalsUpdated(p) = &last_event.event {
                p.proposals == message_indexes
            } else {
                false
            };

            // Active proposals are updated roughly every minute, so in order to avoid adding
            // thousands of duplicate events, we first check if the current last event matches the
            // event being added, and if so we simply bump the timestamp of the existing event, else
            // we add a new event.
            if matches_last_event {
                last_event.timestamp = now;
            } else {
                self.push_event(
                    None,
                    ChatEventInternal::ProposalsUpdated(Box::new(ProposalsUpdatedInternal {
                        proposals: message_indexes,
                    })),
                    correlation_id,
                    now,
                );
            }
        }
    }

    pub fn push_main_event(&mut self, event: ChatEventInternal, correlation_id: u64, now: TimestampMillis) -> EventIndex {
        self.push_event(None, event, correlation_id, now)
    }

    pub fn search_messages(
        &self,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        query: &Query,
        max_results: u8,
        my_user_id: UserId,
    ) -> Vec<MessageMatch> {
        self.main
            .events
            .since(min_visible_event_index)
            .iter()
            .filter_map(|e| e.event.as_message().filter(|m| m.deleted_by.is_none()).map(|m| (e, m)))
            .filter(|(_, m)| if query.users.is_empty() { true } else { query.users.contains(&m.sender) })
            .filter_map(|(e, m)| {
                if query.tokens.is_empty() {
                    Some((1, m))
                } else {
                    let mut document: Document = (&m.content).into();
                    document.set_age(now - e.timestamp);
                    match document.calculate_score(query) {
                        0 => None,
                        n => Some((n, m)),
                    }
                }
            })
            .sorted_unstable_by_key(|(score, _)| *score)
            .rev()
            .take(max_results as usize)
            .map(|(score, message)| MessageMatch {
                chat_id: self.chat_id,
                message_index: message.message_index,
                sender: message.sender,
                content: message.content.hydrate(Some(my_user_id)),
                score,
            })
            .collect()
    }

    pub fn hydrate_mention(&self, mention: &MentionInternal) -> Option<Mention> {
        let chat_events = if let Some(root_message_index) = mention.thread_root_message_index {
            self.threads.get(&root_message_index)?
        } else {
            &self.main
        };
        chat_events.hydrate_mention(&mention.message_index)
    }

    pub fn metrics(&self) -> &ChatMetrics {
        &self.metrics
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: F) -> usize {
        self.main.event_count_since(since, &filter)
            + self
                .threads
                .values()
                .map(|e| e.event_count_since(since, &filter))
                .sum::<usize>()
    }

    pub fn user_metrics(&self, user_id: &UserId, if_updated_since: Option<TimestampMillis>) -> Option<&ChatMetrics> {
        self.per_user_metrics
            .get(user_id)
            .filter(|m| if let Some(since) = if_updated_since { m.last_active > since } else { true })
    }

    pub fn is_message_accessible_by_id(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> bool {
        thread_root_message_index
            .or_else(|| self.main.message_internal_by_message_id(message_id).map(|m| m.message_index))
            .map_or(false, |message_index| {
                self.is_message_accessible(min_visible_event_index, message_index)
            })
    }

    pub fn is_message_accessible_by_index(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
    ) -> bool {
        self.is_message_accessible(min_visible_event_index, thread_root_message_index.unwrap_or(message_index))
    }

    pub fn are_messages_accessible(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: &[MessageId],
    ) -> bool {
        if let Some(root_message_index) = thread_root_message_index {
            self.is_message_accessible(min_visible_event_index, root_message_index)
        } else {
            message_ids.iter().all(|id| {
                self.main
                    .event_index_by_message_id(*id)
                    .map_or(false, |event_index| event_index >= min_visible_event_index)
            })
        }
    }

    pub fn get_with_min_visible_event_index(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        min_visible_event_index: EventIndex,
    ) -> Option<(&ChatEvents, EventIndex)> {
        if let Some(root_message_index) = thread_root_message_index {
            self.main
                .event_index_by_message_index(root_message_index)
                .filter(|thread_event_index| *thread_event_index >= min_visible_event_index)
                .and_then(|_| self.threads.get(&root_message_index))
                .map(|events| (events, EventIndex::default()))
        } else {
            Some((&self.main, min_visible_event_index))
        }
    }

    pub fn main(&self) -> &ChatEvents {
        &self.main
    }

    pub fn latest_threads(
        &self,
        from_set: &HashSet<MessageIndex>,
        updated_since: Option<TimestampMillis>,
        max_threads: usize,
    ) -> Vec<GroupCanisterThreadDetails> {
        from_set
            .iter()
            .filter_map(|root_message_index| {
                self.threads.get(root_message_index).and_then(|thread_events| {
                    let latest_event = thread_events.last();
                    updated_since
                        .map_or(true, |since| latest_event.timestamp > since)
                        .then_some(GroupCanisterThreadDetails {
                            root_message_index: *root_message_index,
                            latest_event: latest_event.index,
                            latest_message: thread_events.latest_message_index().unwrap_or_default(),
                            last_updated: latest_event.timestamp,
                        })
                })
            })
            .sorted_unstable_by_key(|t| Reverse(t.last_updated))
            .take(max_threads)
            .collect()
    }

    pub fn get(&self, thread_root_message_index: Option<MessageIndex>) -> Option<&ChatEvents> {
        if let Some(root_message_index) = thread_root_message_index {
            self.threads.get(&root_message_index)
        } else {
            Some(&self.main)
        }
    }

    pub fn freeze(&mut self, user_id: UserId, reason: Option<String>, now: TimestampMillis) -> EventIndex {
        let event_index = self.push_event(
            None,
            ChatEventInternal::ChatFrozen(Box::new(ChatFrozen {
                frozen_by: user_id,
                reason,
            })),
            0,
            now,
        );
        self.frozen = true;
        event_index
    }

    pub fn unfreeze(&mut self, user_id: UserId, now: TimestampMillis) -> EventIndex {
        self.frozen = false;
        self.push_event(
            None,
            ChatEventInternal::ChatUnfrozen(Box::new(ChatUnfrozen { unfrozen_by: user_id })),
            0,
            now,
        )
    }

    // Note: this method assumes that if there is some thread_root_message_index then the thread exists
    fn push_event(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event: ChatEventInternal,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> EventIndex {
        if self.frozen {
            // We should never hit this because if the chat is frozen it should be handled earlier,
            // this is just here as a safety net.
            panic!("This chat is frozen");
        }

        self.add_to_metrics(&event, thread_root_message_index, now);

        let event_index = self
            .get_mut(thread_root_message_index)
            .unwrap()
            .push_event(event, correlation_id, now);

        event_index
    }

    fn delete_message(
        &mut self,
        caller: UserId,
        is_admin: bool,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> DeleteMessageResult {
        if let Some(message) = self.message_internal_mut_by_message_id(thread_root_message_index, message_id) {
            if message.sender == caller || is_admin {
                if message.deleted_by.is_some() {
                    return DeleteMessageResult::AlreadyDeleted;
                }
                match message.content {
                    MessageContentInternal::Deleted(_) => DeleteMessageResult::AlreadyDeleted,
                    MessageContentInternal::Crypto(_) => DeleteMessageResult::MessageTypeCannotBeDeleted,
                    _ => {
                        message.last_updated = Some(now);
                        message.deleted_by = Some(DeletedBy {
                            deleted_by: caller,
                            timestamp: now,
                        });

                        self.push_event(
                            thread_root_message_index,
                            ChatEventInternal::MessageDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: caller,
                                message_id,
                            })),
                            correlation_id,
                            now,
                        );

                        DeleteMessageResult::Success
                    }
                }
            } else {
                DeleteMessageResult::NotAuthorized
            }
        } else {
            DeleteMessageResult::NotFound
        }
    }

    fn undelete_message(
        &mut self,
        caller: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> UndeleteMessageResult {
        if let Some(message) = self.message_internal_mut_by_message_id(thread_root_message_index, message_id) {
            if let Some(deleted_by) = message.deleted_by.as_ref().map(|db| db.deleted_by) {
                if deleted_by == caller {
                    match message.content {
                        MessageContentInternal::Deleted(_) => UndeleteMessageResult::ContentRemoved,
                        MessageContentInternal::Crypto(_) => UndeleteMessageResult::InvalidMessageType,
                        _ => {
                            message.last_updated = Some(now);
                            message.deleted_by = None;

                            self.push_event(
                                thread_root_message_index,
                                ChatEventInternal::MessageUndeleted(Box::new(UpdatedMessageInternal {
                                    updated_by: caller,
                                    message_id,
                                })),
                                correlation_id,
                                now,
                            );

                            UndeleteMessageResult::Success
                        }
                    }
                } else {
                    UndeleteMessageResult::NotAuthorized
                }
            } else {
                UndeleteMessageResult::NotDeleted
            }
        } else {
            UndeleteMessageResult::NotFound
        }
    }

    fn get_mut(&mut self, thread_root_message_index: Option<MessageIndex>) -> Option<&mut ChatEvents> {
        if let Some(root_message_index) = thread_root_message_index {
            self.threads.get_mut(&root_message_index)
        } else {
            Some(&mut self.main)
        }
    }

    fn add_to_metrics(
        &mut self,
        event: &ChatEventInternal,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) {
        let deleted_message_sender = match event {
            ChatEventInternal::MessageDeleted(m) | ChatEventInternal::MessageUndeleted(m) => self
                .get(thread_root_message_index)
                .and_then(|e| e.message_internal_by_message_id(m.message_id))
                .map(|m| m.sender),
            _ => None,
        };

        event.add_to_metrics(&mut self.metrics, &mut self.per_user_metrics, deleted_message_sender, now);
    }

    fn is_message_accessible(&self, min_visible_event_index: EventIndex, message_index: MessageIndex) -> bool {
        self.main
            .event_index_by_message_index(message_index)
            .map_or(false, |event_index| event_index >= min_visible_event_index)
    }

    fn message_internal_mut_by_message_index(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
    ) -> Option<&mut MessageInternal> {
        self.get_mut(thread_root_message_index)
            .and_then(|chat_events| chat_events.message_internal_mut_by_message_index(message_index))
    }

    fn message_internal_mut_by_message_id(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<&mut MessageInternal> {
        self.get_mut(thread_root_message_index)
            .and_then(|chat_events| chat_events.message_internal_mut_by_message_id(message_id))
    }
}

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat_id: ChatId,
    thread_root_message_index: Option<MessageIndex>,
    events_type: ChatEventsType,
    events: ChatEventsVec,
    message_id_map: HashMap<MessageId, EventIndex>,
    message_index_map: BTreeMap<MessageIndex, EventIndex>,
}

#[derive(CandidType, Serialize, Deserialize)]
enum ChatEventsType {
    Direct,
    Group,
    Thread,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub replies_to: Option<ReplyContext>,
    pub forwarded: bool,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub struct EditMessageArgs {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub enum EditMessageResult {
    Success,
    NotAuthorized,
    NotFound,
}

pub enum DeleteMessageResult {
    Success,
    AlreadyDeleted,
    MessageTypeCannotBeDeleted,
    NotAuthorized,
    NotFound,
}

pub enum UndeleteMessageResult {
    Success,
    NotDeleted,
    ContentRemoved,
    InvalidMessageType,
    NotAuthorized,
    NotFound,
}

pub struct RegisterPollVoteArgs {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub option_index: u32,
    pub operation: VoteOperation,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub enum RegisterPollVoteResult {
    Success(PollVotes),
    SuccessNoChange(PollVotes),
    PollEnded,
    PollNotFound,
    OptionIndexOutOfRange,
}

pub enum EndPollResult {
    Success,
    PollNotFound,
    UnableToEndPoll,
}

pub enum RecordProposalVoteResult {
    Success,
    AlreadyVoted(bool),
    ProposalNotFound,
}

pub enum AddRemoveReactionResult {
    Success(EventIndex),
    NoChange,
    MessageNotFound,
}

impl ChatEvents {
    pub fn new_thread(chat_id: ChatId, thread_root_message_index: MessageIndex) -> ChatEvents {
        ChatEvents {
            chat_id,
            thread_root_message_index: Some(thread_root_message_index),
            events_type: ChatEventsType::Thread,
            events: ChatEventsVec::default(),
            message_id_map: HashMap::new(),
            message_index_map: BTreeMap::new(),
        }
    }

    pub fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events.get(event_index)
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        self.events.get_mut(event_index)
    }

    pub fn hydrate_message_event_internal(
        &self,
        message_event: EventWrapper<&MessageInternal>,
        my_user_id: Option<UserId>,
    ) -> EventWrapper<Message> {
        EventWrapper {
            index: message_event.index,
            timestamp: message_event.timestamp,
            correlation_id: message_event.correlation_id,
            event: self.hydrate_message(message_event.event, my_user_id),
        }
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: &F) -> usize {
        self.events
            .iter()
            .rev()
            .take_while(|e| e.timestamp > since)
            .filter(|e| filter(&e.event))
            .count()
    }

    fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        latest_event_index: EventIndex,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        // If the current latest event is a `ThreadUpdated` event for the same thread then update
        // that existing event, else push a new event.
        let mut push_new_event = true;
        {
            let latest_event = self.events.last_mut().unwrap();
            if let ChatEventInternal::ThreadUpdated(u) = &mut latest_event.event {
                if u.message_index == thread_root_message_index {
                    latest_event.timestamp = now;
                    if let Some(latest_message_index) = latest_thread_message_index_if_updated {
                        u.latest_thread_message_index_if_updated = Some(latest_message_index);
                    }
                    push_new_event = false;
                }
            }
        };

        if push_new_event {
            self.push_event(
                ChatEventInternal::ThreadUpdated(Box::new(ThreadUpdatedInternal {
                    message_index: thread_root_message_index,
                    latest_thread_message_index_if_updated,
                })),
                correlation_id,
                now,
            );
        }

        let root_message = self
            .event_index_by_message_index(thread_root_message_index)
            .and_then(|e| self.events.get_mut(e))
            .and_then(|e| e.event.as_message_mut())
            .unwrap_or_else(|| panic!("Root thread message not found with message index {thread_root_message_index:?}"));

        root_message.last_updated = Some(now);

        let mut summary = root_message.thread_summary.get_or_insert_with(ThreadSummary::default);
        summary.latest_event_index = latest_event_index;
        summary.latest_event_timestamp = now;

        if latest_thread_message_index_if_updated.is_some() {
            summary.reply_count += 1;
            summary.participant_ids.push_if_not_contains(user_id);
        }
    }

    fn push_event(&mut self, event: ChatEventInternal, correlation_id: u64, now: TimestampMillis) -> EventIndex {
        let valid = match self.events_type {
            ChatEventsType::Direct => event.is_valid_for_direct_chat(),
            ChatEventsType::Group => event.is_valid_for_group_chat(),
            ChatEventsType::Thread => event.is_valid_for_thread(),
        };

        if !valid {
            panic!("Event type is not valid: {event:?}");
        }

        let event_index = self.events.next_event_index();
        if let ChatEventInternal::Message(m) = &event {
            match self.message_id_map.entry(m.message_id) {
                Vacant(e) => e.insert(event_index),
                _ => panic!("MessageId already used: {:?}", m.message_id),
            };
            self.message_index_map.insert(m.message_index, event_index);
        }

        self.events.push(EventWrapper {
            index: event_index,
            timestamp: now,
            correlation_id,
            event,
        });

        event_index
    }

    pub fn latest_message(&self, my_user_id: Option<UserId>) -> Option<EventWrapper<Message>> {
        self.latest_message_if_updated(0, my_user_id)
    }

    pub fn latest_message_if_updated(
        &self,
        since: TimestampMillis,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        let event_index = self.latest_message_event_index()?;
        let event = self.get(event_index)?;
        let message = event.event.as_message()?;

        if event.timestamp > since || message.last_updated.unwrap_or(0) > since {
            Some(EventWrapper {
                index: event.index,
                timestamp: event.timestamp,
                correlation_id: event.correlation_id,
                event: self.hydrate_message(message, my_user_id),
            })
        } else {
            None
        }
    }

    pub fn last(&self) -> &EventWrapper<ChatEventInternal> {
        self.events.last().unwrap()
    }

    pub fn latest_message_index(&self) -> Option<MessageIndex> {
        self.message_index_map.keys().last().copied()
    }

    pub fn latest_message_event_index(&self) -> Option<EventIndex> {
        self.message_index_map.values().last().copied()
    }

    pub fn next_message_index(&self) -> MessageIndex {
        self.latest_message_index().map_or(MessageIndex::default(), |m| m.incr())
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &EventWrapper<ChatEventInternal>> {
        self.events.iter()
    }

    pub fn since(&self, event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        self.events.since(event_index)
    }

    pub fn hydrate_message(&self, message: &MessageInternal, my_user_id: Option<UserId>) -> Message {
        Message {
            message_index: message.message_index,
            message_id: message.message_id,
            sender: message.sender,
            content: if let Some(deleted_by) = message.deleted_by.clone() {
                MessageContent::Deleted(deleted_by)
            } else {
                message.content.hydrate(my_user_id)
            },
            replies_to: message.replies_to.clone(),
            reactions: message
                .reactions
                .iter()
                .map(|(r, u)| (r.clone(), u.iter().copied().collect()))
                .collect(),
            edited: message.last_edited.is_some(),
            forwarded: message.forwarded,
            thread_summary: message.thread_summary.clone(),
            last_updated: message.last_updated,
        }
    }

    pub fn hydrate_updated_message(&self, message: &UpdatedMessageInternal) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: message.updated_by,
            event_index: self.event_index_by_message_id(message.message_id).unwrap_or_default(),
            message_id: message.message_id,
        }
    }

    pub fn hydrate_poll_vote_registered(&self, poll_vote_registered: &PollVoteRegistered) -> UpdatedMessage {
        UpdatedMessage {
            updated_by: poll_vote_registered.user_id,
            event_index: self
                .event_index_by_message_id(poll_vote_registered.message_id)
                .unwrap_or_default(),
            message_id: poll_vote_registered.message_id,
        }
    }

    pub fn hydrate_poll_ended(&self, message_index: MessageIndex) -> PollEnded {
        let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

        PollEnded {
            message_index,
            event_index,
        }
    }

    pub fn hydrate_thread_updated(
        &self,
        message_index: MessageIndex,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
    ) -> ThreadUpdated {
        let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

        ThreadUpdated {
            message_index,
            event_index,
            latest_thread_message_index_if_updated,
        }
    }

    pub fn hydrate_proposals_updated(&self, updates: &ProposalsUpdatedInternal) -> ProposalsUpdated {
        let proposals = updates
            .proposals
            .iter()
            .map(|&message_index| {
                let event_index = self.message_index_map.get(&message_index).copied().unwrap_or_default();

                ProposalUpdated {
                    event_index,
                    message_index,
                }
            })
            .collect();

        ProposalsUpdated { proposals }
    }

    pub fn message_event_by_message_index(
        &self,
        message_index: MessageIndex,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        self.message_event_internal_by_message_index(message_index)
            .map(|m| self.hydrate_message_event_internal(m, my_user_id))
    }

    pub fn message_event_by_message_id(
        &self,
        message_id: MessageId,
        my_user_id: Option<UserId>,
    ) -> Option<EventWrapper<Message>> {
        self.message_event_internal_by_message_id(message_id)
            .map(|m| self.hydrate_message_event_internal(m, my_user_id))
    }

    pub fn message_event_internal_by_message_index(
        &self,
        message_index: MessageIndex,
    ) -> Option<EventWrapper<&MessageInternal>> {
        self.message_index_map
            .get(&message_index)
            .and_then(|e| self.message_event_internal_by_event_index(*e))
    }

    pub fn message_event_internal_by_message_id(&self, message_id: MessageId) -> Option<EventWrapper<&MessageInternal>> {
        self.message_id_map
            .get(&message_id)
            .and_then(|e| self.message_event_internal_by_event_index(*e))
    }

    pub fn message_event_internal_by_event_index(&self, event_index: EventIndex) -> Option<EventWrapper<&MessageInternal>> {
        self.get(event_index)
            .and_then(|e| e.event.as_message().map(|m| (e, m)))
            .map(|(e, m)| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                correlation_id: e.correlation_id,
                event: m,
            })
    }

    pub fn message_internal_by_message_index(&self, message_index: MessageIndex) -> Option<&MessageInternal> {
        self.message_index_map
            .get(&message_index)
            .and_then(|e| self.message_internal_by_event_index(*e))
    }

    pub fn message_internal_by_message_id(&self, message_id: MessageId) -> Option<&MessageInternal> {
        self.message_id_map
            .get(&message_id)
            .and_then(|e| self.message_internal_by_event_index(*e))
    }

    pub fn message_internal_by_event_index(&self, event_index: EventIndex) -> Option<&MessageInternal> {
        self.get(event_index).and_then(|e| e.event.as_message())
    }

    pub fn message_internal_mut_by_message_index(&mut self, message_index: MessageIndex) -> Option<&mut MessageInternal> {
        self.event_index_by_message_index(message_index)
            .and_then(|e| self.message_internal_mut_by_event_index(e))
    }

    pub fn message_internal_mut_by_message_id(&mut self, message_id: MessageId) -> Option<&mut MessageInternal> {
        self.event_index_by_message_id(message_id)
            .and_then(|e| self.message_internal_mut_by_event_index(e))
    }

    pub fn message_internal_mut_by_event_index(&mut self, event_index: EventIndex) -> Option<&mut MessageInternal> {
        self.get_mut(event_index).and_then(|e| e.event.as_message_mut())
    }

    pub fn event_index_by_message_index(&self, message_index: MessageIndex) -> Option<EventIndex> {
        self.message_index_map.get(&message_index).copied()
    }

    pub fn event_index_by_message_id(&self, message_id: MessageId) -> Option<EventIndex> {
        self.message_id_map.get(&message_id).copied()
    }

    pub fn hydrate_mention(&self, message_index: &MessageIndex) -> Option<Mention> {
        self.message_index_map
            .get(message_index)
            .and_then(|event_index| self.get(*event_index))
            .and_then(|e| {
                e.event.as_message().map(|m| Mention {
                    thread_root_message_index: self.thread_root_message_index,
                    message_id: m.message_id,
                    message_index: m.message_index,
                    event_index: e.index,
                    mentioned_by: m.sender,
                })
            })
    }

    pub fn affected_event_indexes_since(&self, since: TimestampMillis, max_results: usize) -> Vec<EventIndex> {
        let mut affected_events = HashSet::new();

        for EventWrapper { event, .. } in self.events.iter().rev().take_while(|e| e.timestamp > since) {
            for index in self.affected_event_indexes(event) {
                if affected_events.insert(index) && affected_events.len() == max_results {
                    break;
                }
            }
        }

        affected_events.into_iter().collect()
    }

    pub fn affected_event_indexes(&self, event: &ChatEventInternal) -> Vec<EventIndex> {
        fn option_to_vec<T>(option: Option<T>) -> Vec<T> {
            option.map_or(vec![], |v| vec![v])
        }

        match event {
            ChatEventInternal::MessageEdited(m) => option_to_vec(self.message_id_map.get(&m.message_id).copied()),
            ChatEventInternal::MessageDeleted(m) => option_to_vec(self.message_id_map.get(&m.message_id).copied()),
            ChatEventInternal::MessageUndeleted(m) => option_to_vec(self.message_id_map.get(&m.message_id).copied()),
            ChatEventInternal::MessageReactionAdded(r) => option_to_vec(self.message_id_map.get(&r.message_id).copied()),
            ChatEventInternal::MessageReactionRemoved(r) => option_to_vec(self.message_id_map.get(&r.message_id).copied()),
            ChatEventInternal::PollVoteRegistered(v) => option_to_vec(self.message_id_map.get(&v.message_id).copied()),
            ChatEventInternal::PollVoteDeleted(v) => option_to_vec(self.message_id_map.get(&v.message_id).copied()),
            ChatEventInternal::PollEnded(p) => option_to_vec(self.message_index_map.get(p).copied()),
            ChatEventInternal::ThreadUpdated(u) => option_to_vec(self.message_index_map.get(&u.message_index).copied()),
            ChatEventInternal::ProposalsUpdated(p) => p
                .proposals
                .iter()
                .filter_map(|p| self.message_index_map.get(p))
                .copied()
                .collect(),
            _ => vec![],
        }
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn get_range(
        &self,
        from_event_index: EventIndex,
        to_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .get_range(from_event_index..=to_event_index)
            .iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn get_by_index(&self, indexes: Vec<EventIndex>, my_user_id: Option<UserId>) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .get_by_index(&indexes)
            .iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_events: usize,
        min_visible_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .from_index(start, ascending, max_events, min_visible_event_index)
            .into_iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn get_events_window(
        &self,
        mid_point: EventIndex,
        max_events: usize,
        min_visible_event_index: EventIndex,
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        self.events
            .get_window(mid_point, max_events, min_visible_event_index)
            .into_iter()
            .map(|e| self.hydrate_event(e, my_user_id))
            .collect()
    }

    pub fn affected_events(
        &self,
        events: &[EventWrapper<ChatEvent>],
        my_user_id: Option<UserId>,
    ) -> Vec<EventWrapper<ChatEvent>> {
        // We use this set to exclude events that are already in the input list
        let event_indexes_set: HashSet<_> = events.iter().map(|e| e.index).collect();

        let affected_event_indexes = events
            .iter()
            .flat_map(|e| e.event.affected_events())
            .filter(|e| !event_indexes_set.contains(e))
            .unique()
            .collect();

        self.get_by_index(affected_event_indexes, my_user_id)
    }

    pub fn latest_messages(&self, message_count: u32, my_user_id: Option<UserId>) -> Vec<EventWrapper<Message>> {
        self.message_index_map
            .values()
            .rev()
            .filter_map(|event_index| self.events.get(*event_index))
            .filter_map(|e| {
                if let ChatEventInternal::Message(message) = &e.event {
                    Some(EventWrapper {
                        index: e.index,
                        timestamp: e.timestamp,
                        correlation_id: e.correlation_id,
                        event: self.hydrate_message(message, my_user_id),
                    })
                } else {
                    None
                }
            })
            .take(message_count as usize)
            .collect()
    }

    fn hydrate_event(&self, event: &EventWrapper<ChatEventInternal>, my_user_id: Option<UserId>) -> EventWrapper<ChatEvent> {
        let event_data = match &event.event {
            ChatEventInternal::DirectChatCreated(d) => ChatEvent::DirectChatCreated(*d),
            ChatEventInternal::Message(m) => ChatEvent::Message(Box::new(self.hydrate_message(m, my_user_id))),
            ChatEventInternal::MessageEdited(m) => ChatEvent::MessageEdited(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageDeleted(m) => ChatEvent::MessageDeleted(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageUndeleted(m) => ChatEvent::MessageUndeleted(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionAdded(m) => ChatEvent::MessageReactionAdded(self.hydrate_updated_message(m)),
            ChatEventInternal::MessageReactionRemoved(m) => ChatEvent::MessageReactionRemoved(self.hydrate_updated_message(m)),
            ChatEventInternal::GroupChatCreated(g) => ChatEvent::GroupChatCreated(*g.clone()),
            ChatEventInternal::GroupNameChanged(g) => ChatEvent::GroupNameChanged(*g.clone()),
            ChatEventInternal::GroupDescriptionChanged(g) => ChatEvent::GroupDescriptionChanged(*g.clone()),
            ChatEventInternal::GroupRulesChanged(g) => ChatEvent::GroupRulesChanged(*g.clone()),
            ChatEventInternal::AvatarChanged(g) => ChatEvent::AvatarChanged(*g.clone()),
            ChatEventInternal::OwnershipTransferred(e) => ChatEvent::OwnershipTransferred(*e.clone()),
            ChatEventInternal::ParticipantsAdded(p) => ChatEvent::ParticipantsAdded(*p.clone()),
            ChatEventInternal::ParticipantsRemoved(p) => ChatEvent::ParticipantsRemoved(*p.clone()),
            ChatEventInternal::ParticipantJoined(p) => ChatEvent::ParticipantJoined(*p.clone()),
            ChatEventInternal::ParticipantLeft(p) => ChatEvent::ParticipantLeft(*p.clone()),
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => ChatEvent::ParticipantAssumesSuperAdmin(*p.clone()),
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => ChatEvent::ParticipantRelinquishesSuperAdmin(*p.clone()),
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => ChatEvent::ParticipantDismissedAsSuperAdmin(*p.clone()),
            ChatEventInternal::RoleChanged(r) => ChatEvent::RoleChanged(*r.clone()),
            ChatEventInternal::UsersBlocked(u) => ChatEvent::UsersBlocked(*u.clone()),
            ChatEventInternal::UsersUnblocked(u) => ChatEvent::UsersUnblocked(*u.clone()),
            ChatEventInternal::MessagePinned(p) => ChatEvent::MessagePinned(*p.clone()),
            ChatEventInternal::PermissionsChanged(p) => ChatEvent::PermissionsChanged(*p.clone()),
            ChatEventInternal::MessageUnpinned(u) => ChatEvent::MessageUnpinned(*u.clone()),
            ChatEventInternal::PollVoteRegistered(v) => ChatEvent::PollVoteRegistered(self.hydrate_poll_vote_registered(v)),
            ChatEventInternal::PollVoteDeleted(v) => ChatEvent::PollVoteDeleted(self.hydrate_updated_message(v)),
            ChatEventInternal::PollEnded(m) => ChatEvent::PollEnded(self.hydrate_poll_ended(**m)),
            ChatEventInternal::ThreadUpdated(m) => {
                ChatEvent::ThreadUpdated(self.hydrate_thread_updated(m.message_index, m.latest_thread_message_index_if_updated))
            }
            ChatEventInternal::ProposalsUpdated(p) => ChatEvent::ProposalsUpdated(self.hydrate_proposals_updated(p)),
            ChatEventInternal::GroupVisibilityChanged(g) => ChatEvent::GroupVisibilityChanged(*g.clone()),
            ChatEventInternal::GroupInviteCodeChanged(g) => ChatEvent::GroupInviteCodeChanged(*g.clone()),
            ChatEventInternal::ChatFrozen(f) => ChatEvent::ChatFrozen(*f.clone()),
            ChatEventInternal::ChatUnfrozen(u) => ChatEvent::ChatUnfrozen(*u.clone()),
        };

        EventWrapper {
            index: event.index,
            timestamp: event.timestamp,
            correlation_id: event.correlation_id,
            event: event_data,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
struct ChatEventsVec {
    events: Vec<EventWrapper<ChatEventInternal>>,
}

impl From<Vec<EventWrapper<ChatEventInternal>>> for ChatEventsVec {
    fn from(events: Vec<EventWrapper<ChatEventInternal>>) -> Self {
        ChatEventsVec { events }
    }
}

impl ChatEventsVec {
    pub fn push(&mut self, event: EventWrapper<ChatEventInternal>) {
        if event.index != self.next_event_index() {
            panic!(
                "Incorrect event index. Expected: {}. Got: {}",
                self.next_event_index(),
                event.index
            );
        }
        self.events.push(event);
    }

    pub fn get(&self, event_index: EventIndex) -> Option<&EventWrapper<ChatEventInternal>> {
        self.events.get(usize::from(event_index))
    }

    pub fn get_mut(&mut self, event_index: EventIndex) -> Option<&mut EventWrapper<ChatEventInternal>> {
        self.events.get_mut(usize::from(event_index))
    }

    pub fn since(&self, event_index: EventIndex) -> &[EventWrapper<ChatEventInternal>] {
        self.get_range(event_index..=u32::MAX.into())
    }

    pub fn get_range(&self, range: RangeInclusive<EventIndex>) -> &[EventWrapper<ChatEventInternal>] {
        let start = usize::from(*range.start());
        let end = usize::from(*range.end());
        self.events_range_safe(start..=end, 0)
    }

    pub fn get_by_index(&self, indexes: &[EventIndex]) -> Vec<&EventWrapper<ChatEventInternal>> {
        indexes.iter().filter_map(|i| self.events.get(usize::from(*i))).collect()
    }

    #[allow(clippy::wrong_self_convention)]
    pub fn from_index(
        &self,
        start: EventIndex,
        ascending: bool,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        let start_index = usize::from(start);
        let min_visible_index = usize::from(min_visible_event_index);
        let iter: Box<dyn Iterator<Item = &EventWrapper<ChatEventInternal>>> = if ascending {
            let range = &self.events_range_safe(start_index.., min_visible_index);
            Box::new(range.iter())
        } else {
            let range = &self.events_range_safe(..=start_index, min_visible_index);
            Box::new(range.iter().rev())
        };

        let mut events = Vec::new();
        for event in iter.take(max_events) {
            events.push(event);
        }
        if !ascending {
            events.reverse();
        }
        events
    }

    pub fn get_window(
        &self,
        mid_point: EventIndex,
        max_events: usize,
        min_visible_event_index: EventIndex,
    ) -> Vec<&EventWrapper<ChatEventInternal>> {
        let mid_point_index = usize::from(mid_point);
        let min_visible_index = usize::from(min_visible_event_index);
        let mut forwards_iter = self.events_range_safe(mid_point_index.., min_visible_index).iter();
        let mut backwards_iter = self
            .events_range_safe(min_visible_index..mid_point_index, min_visible_index)
            .iter()
            .rev();

        let mut events = VecDeque::new();

        let mut max_reached = false;
        let mut min_reached = false;

        let mut iter_forwards = true;

        // Alternates between iterating forwards and backwards (unless either end is
        // reached) adding one event each time until the message limit is reached, the
        // event limit is reached, or there are no more events available.
        loop {
            if events.len() == max_events || (min_reached && max_reached) {
                break;
            }

            if iter_forwards {
                if let Some(next) = forwards_iter.next() {
                    events.push_back(next);
                } else {
                    max_reached = true;
                }
                if !min_reached {
                    iter_forwards = false;
                }
            } else {
                if let Some(previous) = backwards_iter.next() {
                    events.push_front(previous);
                } else {
                    min_reached = true;
                }
                if !max_reached {
                    iter_forwards = true;
                }
            }
        }

        Vec::from_iter(events)
    }

    pub fn next_event_index(&self) -> EventIndex {
        self.events.last().map_or(EventIndex::default(), |e| e.index.incr())
    }

    fn events_range_safe(
        &self,
        range: impl RangeBounds<usize>,
        min_visible_index: usize,
    ) -> &[EventWrapper<ChatEventInternal>] {
        let start = match range.start_bound().cloned() {
            Bound::Included(s) => max(s, min_visible_index),
            Bound::Excluded(s) => max(s.saturating_sub(1), min_visible_index),
            Bound::Unbounded => min_visible_index,
        };

        let max = self.events.len();
        let end = match range.end_bound().cloned() {
            Bound::Included(e) => min(e.saturating_add(1), max),
            Bound::Excluded(e) => min(e, max),
            Bound::Unbounded => max,
        };

        if start < end {
            &self.events[start..end]
        } else {
            &[]
        }
    }
}

impl Deref for ChatEventsVec {
    type Target = Vec<EventWrapper<ChatEventInternal>>;

    fn deref(&self) -> &Self::Target {
        &self.events
    }
}

impl DerefMut for ChatEventsVec {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.events
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use std::mem::size_of;

    #[test]
    fn enum_size() {
        let size = size_of::<ChatEventInternal>();
        assert_eq!(size, 16);
    }

    #[test]
    fn since() {
        let events = setup_events();

        let results = events.main.since(10.into());

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let max_event_index = results.last().unwrap().index.into();

        assert!(event_indexes.into_iter().eq(10u32..=max_event_index));
    }

    #[test]
    fn get_range() {
        let events = setup_events();

        let results = events.main.events.get_range(10.into()..=20.into());

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=20));
    }

    #[test]
    fn from_index_event_limit() {
        let events = setup_events();

        let results = events.main.events.from_index(10.into(), true, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(10u32..=34));
    }

    #[test]
    fn from_index_event_limit_rev() {
        let events = setup_events();

        let results = events.main.events.from_index(40.into(), false, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(16u32..=40));
    }

    #[test]
    fn from_index_start_index_exceeds_max() {
        let events = setup_events();

        let results = events
            .main
            .events
            .from_index(u32::MAX.into(), true, 25, EventIndex::default());

        assert!(results.is_empty());
    }

    #[test]
    fn from_index_rev_start_index_exceeds_max() {
        let events = setup_events();

        let results = events
            .main
            .events
            .from_index(u32::MAX.into(), false, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        assert!(event_indexes.into_iter().eq(72u32..=96));
    }

    #[test]
    fn get_events_window_event_limit() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.main.events.get_window(mid_point, 25, EventIndex::default());

        assert_eq!(results.len(), 25);

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), results.len() / 2);
        assert!(event_indexes.into_iter().eq(9u32..=33));
    }

    #[test]
    fn get_events_window_min_visible_event_index() {
        let events = setup_events();
        let mid_point = 21.into();

        let results = events.main.events.get_window(mid_point, 40, 18.into());

        assert_eq!(
            results
                .iter()
                .filter(|e| matches!(e.event, ChatEventInternal::Message(_)))
                .count(),
            20
        );

        let event_indexes: Vec<u32> = results.iter().map(|e| e.index.into()).collect();

        let mid_point_index = results.iter().position(|e| e.index == mid_point);

        assert_eq!(mid_point_index.unwrap(), 3);
        assert!(event_indexes.into_iter().eq(18u32..=57));
    }

    fn setup_events() -> AllChatEvents {
        let user_id = Principal::from_slice(&[1]).into();

        let mut events = AllChatEvents::new_direct_chat(Principal::from_slice(&[2]).into(), 1);

        for i in 2..50 {
            let message_id = i.into();
            events.push_message(PushMessageArgs {
                sender: user_id,
                thread_root_message_index: None,
                message_id,
                content: MessageContentInternal::Text(TextContent {
                    text: "hello".to_owned(),
                }),
                replies_to: None,
                now: i as u64,
                forwarded: false,
                correlation_id: 0,
            });
            events.push_main_event(
                ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                    updated_by: user_id,
                    message_id,
                })),
                0,
                i as u64,
            );
        }

        events
    }
}
