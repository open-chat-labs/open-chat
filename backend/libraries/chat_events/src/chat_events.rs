use crate::expiring_events::ExpiringEvents;
use crate::*;
use ::types::{
    ChatFrozen, ChatId, ChatMetrics, ChatUnfrozen, Cryptocurrency, DeletedBy, DirectChatCreated, EventIndex, EventWrapper,
    EventsTimeToLiveUpdated, GroupCanisterThreadDetails, GroupChatCreated, Mention, MentionInternal, Message,
    MessageContentInitial, MessageContentInternal, MessageId, MessageIndex, MessageMatch, Milliseconds, PollVoteRegistered,
    PollVotes, ProposalStatusUpdate, PushEventResult, PushIfNotContains, RangeSet, Reaction, RegisterVoteResult, ReplyContext,
    ThreadSummary, TimestampMillis, Timestamped, UserId, VoteOperation,
};
use ic_ledger_types::Tokens;
use itertools::Itertools;
use search::{Document, Query};
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat_id: ChatId,
    chat_type: ChatType,
    main: ChatEventsList,
    threads: HashMap<MessageIndex, ChatEventsList>,
    metrics: ChatMetrics,
    per_user_metrics: HashMap<UserId, ChatMetrics>,
    frozen: bool,
    events_ttl: Timestamped<Option<Milliseconds>>,
    expiring_events: ExpiringEvents,
}

impl ChatEvents {
    pub fn new_direct_chat(them: UserId, events_ttl: Option<Milliseconds>, now: TimestampMillis) -> ChatEvents {
        let mut events = ChatEvents {
            chat_id: them.into(),
            chat_type: ChatType::Direct,
            main: ChatEventsList::default(),
            threads: HashMap::new(),
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
        };

        events.push_event(None, ChatEventInternal::DirectChatCreated(DirectChatCreated {}), 0, now);

        events
    }

    pub fn new_group_chat(
        chat_id: ChatId,
        name: String,
        description: String,
        created_by: UserId,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
    ) -> ChatEvents {
        let mut events = ChatEvents {
            chat_id,
            chat_type: ChatType::Group,
            main: ChatEventsList::default(),
            threads: HashMap::new(),
            metrics: ChatMetrics::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
        };

        events.push_event(
            None,
            ChatEventInternal::GroupChatCreated(Box::new(GroupChatCreated {
                name,
                description,
                created_by,
            })),
            0,
            now,
        );

        events
    }

    pub fn push_message(&mut self, args: PushMessageArgs) -> EventWrapper<Message> {
        let events_list = if let Some(root_message_index) = args.thread_root_message_index {
            self.threads.entry(root_message_index).or_default()
        } else {
            &mut self.main
        };

        let message_index = events_list.next_message_index();
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
        let message = message_internal.hydrate(Some(message_internal.sender));

        let push_event_result = self.push_event(
            args.thread_root_message_index,
            ChatEventInternal::Message(Box::new(message_internal)),
            args.correlation_id,
            args.now,
        );

        if let Some(root_message_index) = args.thread_root_message_index {
            self.update_thread_summary(
                root_message_index,
                args.sender,
                Some(message_index),
                push_event_result.index,
                args.correlation_id,
                args.now,
            );
        }

        EventWrapper {
            index: push_event_result.index,
            timestamp: args.now,
            correlation_id: args.correlation_id,
            expires_at: push_event_result.expires_at,
            event: message,
        }
    }

    pub fn edit_message(&mut self, args: EditMessageArgs) -> EditMessageResult {
        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
            args.now,
        ) {
            if message.sender == args.sender {
                if !matches!(message.content, MessageContentInternal::Deleted(_)) {
                    message.content = args.content.new_content_into_internal();
                    message.last_updated = Some(args.now);
                    message.last_edited = Some(args.now);
                    let push_event_result = self.push_event(
                        args.thread_root_message_index,
                        ChatEventInternal::MessageEdited(Box::new(UpdatedMessageInternal {
                            updated_by: args.sender,
                            message_id: args.message_id,
                        })),
                        args.correlation_id,
                        args.now,
                    );

                    if let Some(root_message_index) = args.thread_root_message_index {
                        self.update_thread_summary(
                            root_message_index,
                            args.sender,
                            None,
                            push_event_result.index,
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

    pub fn delete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, DeleteMessageResult)> {
        let results: Vec<_> = args
            .iter()
            .map(|delete_message_args| (delete_message_args.message_id, self.delete_message(delete_message_args)))
            .collect();

        if results.iter().any(|(_, r)| matches!(r, DeleteMessageResult::Success)) {
            self.update_thread_summary_after_successful_delete_undelete(args);
        }

        results
    }

    pub fn undelete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, UndeleteMessageResult)> {
        let results: Vec<_> = args
            .iter()
            .map(|undelete_message_args| (undelete_message_args.message_id, self.undelete_message(undelete_message_args)))
            .collect();

        if results.iter().any(|(_, r)| matches!(r, UndeleteMessageResult::Success)) {
            self.update_thread_summary_after_successful_delete_undelete(args);
        }

        results
    }

    fn update_thread_summary_after_successful_delete_undelete(&mut self, args: DeleteUndeleteMessagesArgs) {
        if let Some(root_message_index) = args.thread_root_message_index {
            if let Some(thread_events) = self.threads.get(&root_message_index) {
                if let Some(latest_event_index) = thread_events.latest_event_index() {
                    self.update_thread_summary(
                        root_message_index,
                        args.caller,
                        None,
                        latest_event_index,
                        args.correlation_id,
                        args.now,
                    );
                }
            }
        }
    }

    fn delete_message(&mut self, args: DeleteUndeleteMessageArgs) -> DeleteMessageResult {
        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
            args.now,
        ) {
            if message.sender == args.caller || args.is_admin {
                if message.deleted_by.is_some() {
                    return DeleteMessageResult::AlreadyDeleted;
                }
                match message.content {
                    MessageContentInternal::Deleted(_) => DeleteMessageResult::AlreadyDeleted,
                    MessageContentInternal::Crypto(_) => DeleteMessageResult::MessageTypeCannotBeDeleted,
                    _ => {
                        message.last_updated = Some(args.now);
                        message.deleted_by = Some(DeletedBy {
                            deleted_by: args.caller,
                            timestamp: args.now,
                        });

                        self.push_event(
                            args.thread_root_message_index,
                            ChatEventInternal::MessageDeleted(Box::new(UpdatedMessageInternal {
                                updated_by: args.caller,
                                message_id: args.message_id,
                            })),
                            args.correlation_id,
                            args.now,
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

    fn undelete_message(&mut self, args: DeleteUndeleteMessageArgs) -> UndeleteMessageResult {
        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
            args.now,
        ) {
            if let Some(deleted_by) = message.deleted_by.as_ref().map(|db| db.deleted_by) {
                if deleted_by == args.caller || (args.is_admin && message.sender != deleted_by) {
                    match message.content {
                        MessageContentInternal::Deleted(_) => UndeleteMessageResult::HardDeleted,
                        MessageContentInternal::Crypto(_) => UndeleteMessageResult::InvalidMessageType,
                        _ => {
                            message.last_updated = Some(args.now);
                            message.deleted_by = None;

                            self.push_event(
                                args.thread_root_message_index,
                                ChatEventInternal::MessageUndeleted(Box::new(UpdatedMessageInternal {
                                    updated_by: args.caller,
                                    message_id: args.message_id,
                                })),
                                args.correlation_id,
                                args.now,
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

    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> Option<MessageContentInternal> {
        let message = self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into(), now)?;
        let deleted_by = message.deleted_by.clone()?;

        Some(std::mem::replace(
            &mut message.content,
            MessageContentInternal::Deleted(deleted_by),
        ))
    }

    pub fn register_poll_vote(&mut self, args: RegisterPollVoteArgs) -> RegisterPollVoteResult {
        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_index.into(),
            args.now,
        ) {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return match p.register_vote(args.user_id, args.option_index, args.operation) {
                    RegisterVoteResult::Success(existing_vote_removed) => {
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
                        let push_event_result =
                            self.push_event(args.thread_root_message_index, event, args.correlation_id, args.now);

                        if let Some(root_message_index) = args.thread_root_message_index {
                            self.update_thread_summary(
                                root_message_index,
                                args.user_id,
                                None,
                                push_event_result.index,
                                args.correlation_id,
                                args.now,
                            );
                        }

                        RegisterPollVoteResult::Success(votes)
                    }
                    RegisterVoteResult::SuccessNoChange => {
                        RegisterPollVoteResult::SuccessNoChange(p.hydrate(Some(args.user_id)).votes)
                    }
                    RegisterVoteResult::PollEnded => RegisterPollVoteResult::PollEnded,
                    RegisterVoteResult::OptionIndexOutOfRange => RegisterPollVoteResult::OptionIndexOutOfRange,
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
        if let Some(message) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_index.into(), now)
        {
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
        min_visible_event_index: EventIndex,
        message_index: MessageIndex,
        adopt: bool,
        now: TimestampMillis,
    ) -> RecordProposalVoteResult {
        if let Some(proposal) = self
            .message_internal_mut(min_visible_event_index, None, message_index.into(), now)
            .and_then(
                |m| {
                    if let MessageContentInternal::GovernanceProposal(p) = &mut m.content {
                        Some(p)
                    } else {
                        None
                    }
                },
            )
        {
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

    pub fn update_proposals(
        &mut self,
        user_id: UserId,
        updates: Vec<(MessageId, ProposalStatusUpdate)>,
        correlation_id: u64,
        now: TimestampMillis,
    ) {
        let mut message_indexes = Vec::new();

        for (message_id, update) in updates {
            if let Some(message) = self
                .main
                .get_mut(message_id.into(), EventIndex::default(), now)
                .and_then(|e| e.event.as_message_mut())
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

            let mut push_new_event = true;
            if let Some(last_event) = self.main.last_mut() {
                if let ChatEventInternal::ProposalsUpdated(p) = &last_event.event {
                    if p.proposals == message_indexes {
                        last_event.timestamp = now;
                        push_new_event = false;
                    }
                }
            }

            // Active proposals are updated roughly every minute, so in order to avoid adding
            // thousands of duplicate events, we first check if the current last event matches the
            // event being added, and if so we simply bump the timestamp of the existing event, else
            // we add a new event.
            if push_new_event {
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

    pub fn add_reaction(&mut self, args: AddRemoveReactionArgs) -> AddRemoveReactionResult {
        if !args.reaction.is_valid() {
            // This should never happen because we validate earlier
            panic!("Invalid reaction: {:?}", args.reaction);
        }

        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
            args.now,
        ) {
            let added = if let Some((_, users)) = message.reactions.iter_mut().find(|(r, _)| *r == args.reaction) {
                users.insert(args.user_id)
            } else {
                message
                    .reactions
                    .push((args.reaction, vec![args.user_id].into_iter().collect()));
                true
            };

            if !added {
                return AddRemoveReactionResult::NoChange;
            }

            message.last_updated = Some(args.now);

            let push_event_result = self.push_event(
                args.thread_root_message_index,
                ChatEventInternal::MessageReactionAdded(Box::new(UpdatedMessageInternal {
                    updated_by: args.user_id,
                    message_id: args.message_id,
                })),
                args.correlation_id,
                args.now,
            );

            if let Some(root_message_index) = args.thread_root_message_index {
                self.update_thread_summary(
                    root_message_index,
                    args.user_id,
                    None,
                    push_event_result.index,
                    args.correlation_id,
                    args.now,
                );
            }

            AddRemoveReactionResult::Success(push_event_result)
        } else {
            AddRemoveReactionResult::MessageNotFound
        }
    }

    pub fn remove_reaction(&mut self, args: AddRemoveReactionArgs) -> AddRemoveReactionResult {
        if let Some(message) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
            args.now,
        ) {
            let (removed, is_empty) = message
                .reactions
                .iter_mut()
                .find(|(r, _)| *r == args.reaction)
                .map(|(_, u)| (u.remove(&args.user_id), u.is_empty()))
                .unwrap_or_default();

            if !removed {
                return AddRemoveReactionResult::NoChange;
            }

            if is_empty {
                message.reactions.retain(|(_, u)| !u.is_empty());
            }

            message.last_updated = Some(args.now);

            let push_event_result = self.push_event(
                args.thread_root_message_index,
                ChatEventInternal::MessageReactionRemoved(Box::new(UpdatedMessageInternal {
                    updated_by: args.user_id,
                    message_id: args.message_id,
                })),
                args.correlation_id,
                args.now,
            );

            if let Some(root_message_index) = args.thread_root_message_index {
                self.update_thread_summary(
                    root_message_index,
                    args.user_id,
                    None,
                    push_event_result.index,
                    args.correlation_id,
                    args.now,
                );
            }

            AddRemoveReactionResult::Success(push_event_result)
        } else {
            AddRemoveReactionResult::MessageNotFound
        }
    }

    pub fn reserve_prize(
        &mut self,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        user_id: UserId,
        now: TimestampMillis,
    ) -> ReservePrizeResult {
        if let Some(event) = self.main.get_mut(message_id.into(), min_visible_event_index, now) {
            if let ChatEventInternal::Message(message) = &mut event.event {
                if let MessageContentInternal::Prize(content) = &mut message.content {
                    if content.end_date < now {
                        return ReservePrizeResult::PrizeEnded;
                    }

                    if content.prizes_remaining.is_empty() {
                        return ReservePrizeResult::PrizeFullyClaimed;
                    }

                    if content.winners.contains(&user_id) || content.reservations.contains(&user_id) {
                        return ReservePrizeResult::AlreadyClaimed;
                    }

                    // Pop the last prize and reserve it
                    let amount = content.prizes_remaining.pop().expect("some prizes_remaining");
                    content.reservations.insert(user_id);
                    message.last_updated = Some(now);

                    let token = content.transaction.token();

                    return ReservePrizeResult::Success(token, amount);
                }
            }
        }

        ReservePrizeResult::MessageNotFound
    }

    pub fn claim_prize(&mut self, message_id: MessageId, winner: UserId, now: TimestampMillis) -> ClaimPrizeResult {
        if let Some(event) = self
            .main
            .get_mut(message_id.into(), EventIndex::default(), TimestampMillis::default())
        {
            if let ChatEventInternal::Message(message) = &mut event.event {
                if let MessageContentInternal::Prize(content) = &mut message.content {
                    // Remove the reservation
                    if content.reservations.remove(&winner) {
                        // Add the user to winners list
                        content.winners.insert(winner);
                        message.last_updated = Some(now);
                        return ClaimPrizeResult::Success(message.message_index);
                    } else {
                        return ClaimPrizeResult::ReservationNotFound;
                    }
                }
            }
        }

        ClaimPrizeResult::MessageNotFound
    }

    pub fn unreserve_prize(
        &mut self,
        message_id: MessageId,
        user_id: UserId,
        amount: Tokens,
        now: TimestampMillis,
    ) -> UnreservePrizeResult {
        if let Some(event) = self
            .main
            .get_mut(message_id.into(), EventIndex::default(), TimestampMillis::default())
        {
            if let ChatEventInternal::Message(message) = &mut event.event {
                if let MessageContentInternal::Prize(content) = &mut message.content {
                    // Remove the reservation
                    if content.reservations.remove(&user_id) {
                        // Put the prize back
                        content.prizes_remaining.push(amount);
                        message.last_updated = Some(now);
                        return UnreservePrizeResult::Success;
                    } else {
                        return UnreservePrizeResult::ReservationNotFound;
                    }
                }
            }
        }

        UnreservePrizeResult::MessageNotFound
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
        if let Some(latest_event) = self.main.last_mut() {
            if let ChatEventInternal::ThreadUpdated(u) = &mut latest_event.event {
                if u.message_index == thread_root_message_index {
                    latest_event.timestamp = now;
                    if let Some(latest_message_index) = latest_thread_message_index_if_updated {
                        u.latest_thread_message_index_if_updated = Some(latest_message_index);
                    }
                    push_new_event = false;
                }
            }
        }

        if push_new_event {
            self.push_event(
                None,
                ChatEventInternal::ThreadUpdated(Box::new(ThreadUpdatedInternal {
                    message_index: thread_root_message_index,
                    latest_thread_message_index_if_updated,
                })),
                correlation_id,
                now,
            );
        }

        let root_message = self
            .message_internal_mut(EventIndex::default(), None, thread_root_message_index.into(), now)
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

    // Note: this method assumes that if there is some thread_root_message_index then the thread exists
    fn push_event(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event: ChatEventInternal,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> PushEventResult {
        if self.frozen {
            // We should never hit this because if the chat is frozen it should be handled earlier,
            // this is just here as a safety net.
            panic!("This chat is frozen");
        }

        let valid = if thread_root_message_index.is_some() {
            event.is_valid_for_thread()
        } else {
            match self.chat_type {
                ChatType::Direct => event.is_valid_for_direct_chat(),
                ChatType::Group => event.is_valid_for_group_chat(),
            }
        };

        if !valid {
            panic!("Event type is not valid: {event:?}");
        }

        let expires_at = self.expiry_date(&event, thread_root_message_index.is_some(), now);

        let events_list = if let Some(root_message_index) = thread_root_message_index {
            self.threads.get_mut(&root_message_index).unwrap()
        } else {
            &mut self.main
        };

        let deleted_message_sender = match &event {
            ChatEventInternal::MessageDeleted(m) | ChatEventInternal::MessageUndeleted(m) => {
                ChatEventsListReader::new(events_list, now)
                    .message_internal(m.message_id.into())
                    .map(|m| m.sender)
            }
            _ => None,
        };

        event.add_to_metrics(&mut self.metrics, &mut self.per_user_metrics, deleted_message_sender, now);

        let maybe_message_index = event.as_message().map(|m| m.message_index);
        let event_index = events_list.push_event(event, correlation_id, expires_at, now);

        if let Some(timestamp) = expires_at {
            self.expiring_events.insert(event_index, maybe_message_index, timestamp);
        }

        self.remove_expired_events(now);

        PushEventResult {
            index: event_index,
            timestamp: now,
            expires_at,
        }
    }

    pub fn get_events_time_to_live(&self) -> &Timestamped<Option<Milliseconds>> {
        &self.events_ttl
    }

    pub fn set_events_time_to_live(&mut self, user_id: UserId, events_ttl: Option<Milliseconds>, now: TimestampMillis) {
        if events_ttl != self.events_ttl.value {
            self.events_ttl = Timestamped::new(events_ttl, now);
            self.push_main_event(
                ChatEventInternal::EventsTimeToLiveUpdated(Box::new(EventsTimeToLiveUpdated {
                    updated_by: user_id,
                    new_ttl: events_ttl,
                })),
                0,
                now,
            );
        }
    }

    pub fn search_messages(
        &self,
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        query: &Query,
        max_results: u8,
        my_user_id: UserId,
    ) -> Vec<MessageMatch> {
        self.visible_main_events_reader(min_visible_event_index, now)
            .iter(None, true)
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

    pub fn push_main_event(&mut self, event: ChatEventInternal, correlation_id: u64, now: TimestampMillis) -> PushEventResult {
        self.push_event(None, event, correlation_id, now)
    }

    pub fn push_thread_event(
        &mut self,
        thread_root_message_index: MessageIndex,
        event: ChatEventInternal,
        correlation_id: u64,
        now: TimestampMillis,
    ) -> EventIndex {
        let events = self.threads.entry(thread_root_message_index).or_default();
        events.push_event(event, correlation_id, None, now)
    }

    pub fn hydrate_mention(
        &self,
        min_visible_event_index: EventIndex,
        mention: &MentionInternal,
        now: TimestampMillis,
    ) -> Option<Mention> {
        let events_reader = self.events_reader(min_visible_event_index, mention.thread_root_message_index, now)?;
        events_reader.hydrate_mention(mention)
    }

    pub fn metrics(&self) -> &ChatMetrics {
        &self.metrics
    }

    pub fn user_metrics(&self, user_id: &UserId, if_updated_since: Option<TimestampMillis>) -> Option<&ChatMetrics> {
        self.per_user_metrics
            .get(user_id)
            .filter(|m| if let Some(since) = if_updated_since { m.last_active > since } else { true })
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(
        &self,
        since: TimestampMillis,
        now: TimestampMillis,
        filter: F,
    ) -> usize {
        self.main.event_count_since(since, now, &filter)
            + self
                .threads
                .values()
                .map(|e| e.event_count_since(since, now, &filter))
                .sum::<usize>()
    }

    pub fn is_accessible(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
        now: TimestampMillis,
    ) -> bool {
        if let Some(events_list) = self.events_reader(min_visible_event_index, thread_root_message_index, now) {
            events_list.is_accessible(event_key, min_visible_event_index, now)
        } else {
            false
        }
    }

    pub fn latest_threads<'a>(
        &self,
        min_visible_event_index: EventIndex,
        root_message_indexes: impl Iterator<Item = &'a MessageIndex>,
        updated_since: Option<TimestampMillis>,
        max_threads: usize,
        now: TimestampMillis,
    ) -> Vec<GroupCanisterThreadDetails> {
        root_message_indexes
            .filter(|&&root_message_index| {
                self.main
                    .is_accessible(root_message_index.into(), min_visible_event_index, now)
            })
            .filter_map(|root_message_index| {
                self.threads.get(root_message_index).and_then(|thread_events| {
                    let last_updated = thread_events.latest_event_timestamp()?;
                    let latest_event = thread_events.latest_event_index()?;
                    updated_since
                        .map_or(true, |since| last_updated > since)
                        .then_some(GroupCanisterThreadDetails {
                            root_message_index: *root_message_index,
                            latest_event,
                            latest_message: thread_events.latest_message_index().unwrap_or_default(),
                            last_updated,
                        })
                })
            })
            .sorted_unstable_by_key(|t| Reverse(t.last_updated))
            .take(max_threads)
            .collect()
    }

    pub fn freeze(&mut self, user_id: UserId, reason: Option<String>, now: TimestampMillis) -> PushEventResult {
        let push_event_result = self.push_event(
            None,
            ChatEventInternal::ChatFrozen(Box::new(ChatFrozen {
                frozen_by: user_id,
                reason,
            })),
            0,
            now,
        );
        self.frozen = true;
        push_event_result
    }

    pub fn unfreeze(&mut self, user_id: UserId, now: TimestampMillis) -> PushEventResult {
        self.frozen = false;
        self.push_event(
            None,
            ChatEventInternal::ChatUnfrozen(Box::new(ChatUnfrozen { unfrozen_by: user_id })),
            0,
            now,
        )
    }

    pub fn next_message_expiry(&self, now: TimestampMillis) -> Option<TimestampMillis> {
        self.expiring_events.next_message_expiry(now)
    }

    pub fn expired_messages(&self, now: TimestampMillis) -> RangeSet<MessageIndex> {
        self.expiring_events.expired_messages(now)
    }

    pub fn expired_messages_since(&self, since: TimestampMillis, now: TimestampMillis) -> RangeSet<MessageIndex> {
        self.expiring_events.expired_messages_since(since, now)
    }

    fn remove_expired_events(&mut self, now: TimestampMillis) {
        for event_index in self.expiring_events.process_expired_events(now) {
            if let Some(event) = self.main.remove_expired_event(event_index) {
                if let ChatEventInternal::Message(m) = event.event {
                    self.threads.remove(&m.message_index);
                }
            }
        }
    }

    pub fn main_events_reader(&self, now: TimestampMillis) -> ChatEventsListReader {
        ChatEventsListReader::new(&self.main, now)
    }

    pub fn visible_main_events_reader(
        &self,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> ChatEventsListReader {
        ChatEventsListReader::with_min_visible_event_index(&self.main, min_visible_event_index, now)
    }

    pub fn events_reader(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> Option<ChatEventsListReader> {
        let events_list = self.events_list(min_visible_event_index, thread_root_message_index, now)?;

        if thread_root_message_index.is_some() {
            Some(ChatEventsListReader::new(events_list, now))
        } else {
            Some(ChatEventsListReader::with_min_visible_event_index(
                events_list,
                min_visible_event_index,
                now,
            ))
        }
    }

    fn events_list(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> Option<&ChatEventsList> {
        if let Some(root_message_index) = thread_root_message_index {
            if self
                .main
                .is_accessible(root_message_index.into(), min_visible_event_index, now)
            {
                self.threads.get(&root_message_index)
            } else {
                None
            }
        } else {
            Some(&self.main)
        }
    }

    fn events_list_mut(
        &mut self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> Option<&mut ChatEventsList> {
        if let Some(root_message_index) = thread_root_message_index {
            if self
                .main
                .is_accessible(root_message_index.into(), min_visible_event_index, now)
            {
                self.threads.get_mut(&root_message_index)
            } else {
                None
            }
        } else {
            Some(&mut self.main)
        }
    }

    fn message_internal_mut(
        &mut self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
        now: TimestampMillis,
    ) -> Option<&mut MessageInternal> {
        let events_list = self.events_list_mut(min_visible_event_index, thread_root_message_index, now)?;

        events_list
            .get_mut(event_key, min_visible_event_index, now)
            .and_then(|e| e.event.as_message_mut())
    }

    fn expiry_date(&self, event: &ChatEventInternal, is_thread_event: bool, now: TimestampMillis) -> Option<TimestampMillis> {
        if is_thread_event {
            None
        } else {
            let events_reader = self.main_events_reader(now);
            let affected_events: Vec<_> = events_reader
                .affected_event_indexes(event)
                .into_iter()
                .filter_map(|e| events_reader.get(e.into()))
                .collect();

            if affected_events.is_empty() {
                self.events_ttl.value.map(|d| now + d)
            } else {
                // If this event affects existing events, then this event cannot expire until all of
                // the events it affects have first expired. So we need to find the max expiry date
                // of the affected events.
                let mut max_expiry = now;
                for e in affected_events {
                    if let Some(expiry) = e.expires_at {
                        max_expiry = expiry;
                    } else {
                        // If any of the affected events do not expire, then this event cannot
                        // expire
                        return None;
                    }
                }
                Some(max_expiry)
            }
        }
    }
}

#[derive(Serialize, Deserialize)]
enum ChatType {
    Direct,
    Group,
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
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
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

pub struct DeleteUndeleteMessagesArgs {
    pub caller: UserId,
    pub is_admin: bool,
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub struct DeleteUndeleteMessageArgs {
    pub caller: UserId,
    pub is_admin: bool,
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

impl DeleteUndeleteMessagesArgs {
    pub fn iter(&self) -> impl Iterator<Item = DeleteUndeleteMessageArgs> + '_ {
        self.message_ids.iter().map(|m| DeleteUndeleteMessageArgs {
            caller: self.caller,
            is_admin: self.is_admin,
            min_visible_event_index: self.min_visible_event_index,
            thread_root_message_index: self.thread_root_message_index,
            message_id: *m,
            correlation_id: self.correlation_id,
            now: self.now,
        })
    }
}

pub enum UndeleteMessageResult {
    Success,
    NotDeleted,
    HardDeleted,
    InvalidMessageType,
    NotAuthorized,
    NotFound,
}

pub struct RegisterPollVoteArgs {
    pub user_id: UserId,
    pub min_visible_event_index: EventIndex,
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

pub struct AddRemoveReactionArgs {
    pub user_id: UserId,
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub enum AddRemoveReactionResult {
    Success(PushEventResult),
    NoChange,
    MessageNotFound,
}

pub enum ReservePrizeResult {
    Success(Cryptocurrency, Tokens),
    MessageNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
}

pub enum ClaimPrizeResult {
    Success(MessageIndex),
    MessageNotFound,
    ReservationNotFound,
}

pub enum UnreservePrizeResult {
    Success,
    MessageNotFound,
    ReservationNotFound,
}

#[derive(Copy, Clone)]
pub enum EventKey {
    EventIndex(EventIndex),
    MessageIndex(MessageIndex),
    MessageId(MessageId),
}

impl From<EventIndex> for EventKey {
    fn from(value: EventIndex) -> Self {
        EventKey::EventIndex(value)
    }
}

impl From<MessageIndex> for EventKey {
    fn from(value: MessageIndex) -> Self {
        EventKey::MessageIndex(value)
    }
}

impl From<MessageId> for EventKey {
    fn from(value: MessageId) -> Self {
        EventKey::MessageId(value)
    }
}
