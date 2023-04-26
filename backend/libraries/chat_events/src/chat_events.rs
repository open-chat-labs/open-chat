use crate::expiring_events::ExpiringEvents;
use crate::last_updated_timestamps::LastUpdatedTimestamps;
use crate::*;
use ::types::{
    ChatFrozen, ChatId, ChatMetrics, ChatUnfrozen, Cryptocurrency, DeletedBy, DirectChatCreated, EventIndex, EventWrapper,
    EventsTimeToLiveUpdated, GroupCanisterThreadDetails, GroupChatCreated, Mention, MentionInternal, Message,
    MessageContentInitial, MessageContentInternal, MessageId, MessageIndex, MessageMatch, Milliseconds, PollVotes,
    ProposalStatusUpdate, PushEventResult, PushIfNotContains, RangeSet, Reaction, RegisterVoteResult, ReplyContext,
    ThreadSummary, TimestampMillis, Timestamped, UserId, VoteOperation,
};
use candid::Principal;
use ic_ledger_types::Tokens;
use itertools::Itertools;
use search::{Document, Query};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::cmp::{max, Reverse};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{Hash, MessageReport, ReportedMessageInternal};

pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));

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
    last_updated_timestamps: LastUpdatedTimestamps,
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
            last_updated_timestamps: LastUpdatedTimestamps::default(),
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
            last_updated_timestamps: LastUpdatedTimestamps::default(),
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

    pub fn mark_event_updated(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        now: TimestampMillis,
    ) {
        self.last_updated_timestamps
            .mark_updated(thread_root_message_index, event_index, now);
    }

    pub fn iter_recently_updated_events(
        &self,
    ) -> impl Iterator<Item = (Option<MessageIndex>, EventIndex, TimestampMillis)> + '_ {
        self.last_updated_timestamps.iter()
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

        add_to_metrics(
            &mut self.metrics,
            &mut self.per_user_metrics,
            args.sender,
            |m| message_internal.add_to_metrics(m),
            args.now,
        );

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
        if let Some((message, event_index)) = self.message_internal_mut(
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
                    self.mark_event_updated(args.thread_root_message_index, event_index, args.now);

                    add_to_metrics(
                        &mut self.metrics,
                        &mut self.per_user_metrics,
                        args.sender,
                        |m| incr(&mut m.edits),
                        args.now,
                    );

                    return EditMessageResult::Success;
                }
            } else {
                return EditMessageResult::NotAuthorized;
            }
        }

        EditMessageResult::NotFound
    }

    pub fn delete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, DeleteMessageResult)> {
        args.iter()
            .map(|delete_message_args| (delete_message_args.message_id, self.delete_message(delete_message_args)))
            .collect()
    }

    pub fn undelete_messages(&mut self, args: DeleteUndeleteMessagesArgs) -> Vec<(MessageId, UndeleteMessageResult)> {
        args.iter()
            .map(|undelete_message_args| (undelete_message_args.message_id, self.undelete_message(undelete_message_args)))
            .collect()
    }

    fn delete_message(&mut self, args: DeleteUndeleteMessageArgs) -> DeleteMessageResult {
        if let Some((message, event_index)) = self.message_internal_mut(
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
                        let sender = message.sender;
                        message.last_updated = Some(args.now);
                        message.deleted_by = Some(DeletedBy {
                            deleted_by: args.caller,
                            timestamp: args.now,
                        });
                        self.last_updated_timestamps
                            .mark_updated(args.thread_root_message_index, event_index, args.now);

                        if sender != args.caller {
                            add_to_metrics(
                                &mut self.metrics,
                                &mut self.per_user_metrics,
                                sender,
                                |m| incr(&mut m.reported_messages),
                                args.now,
                            );
                        }
                        add_to_metrics(
                            &mut self.metrics,
                            &mut self.per_user_metrics,
                            args.caller,
                            |m| incr(&mut m.deleted_messages),
                            args.now,
                        );

                        DeleteMessageResult::Success(sender)
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
        if let Some((message, event_index)) = self.message_internal_mut(
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
                            let sender = message.sender;
                            message.last_updated = Some(args.now);
                            message.deleted_by = None;
                            self.last_updated_timestamps
                                .mark_updated(args.thread_root_message_index, event_index, args.now);

                            if sender != args.caller {
                                add_to_metrics(
                                    &mut self.metrics,
                                    &mut self.per_user_metrics,
                                    sender,
                                    |m| decr(&mut m.reported_messages),
                                    args.now,
                                );
                            }
                            add_to_metrics(
                                &mut self.metrics,
                                &mut self.per_user_metrics,
                                args.caller,
                                |m| decr(&mut m.deleted_messages),
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
        let (message, _) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into(), now)?;

        let deleted_by = message.deleted_by.clone()?;

        Some(std::mem::replace(
            &mut message.content,
            MessageContentInternal::Deleted(deleted_by),
        ))
    }

    pub fn register_poll_vote(&mut self, args: RegisterPollVoteArgs) -> RegisterPollVoteResult {
        if let Some((message, event_index)) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_index.into(),
            args.now,
        ) {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return match p.register_vote(args.user_id, args.option_index, args.operation) {
                    RegisterVoteResult::Success(existing_vote_removed) => {
                        message.last_updated = Some(args.now);
                        let votes = p.hydrate(Some(args.user_id)).votes;

                        self.last_updated_timestamps
                            .mark_updated(args.thread_root_message_index, event_index, args.now);

                        match args.operation {
                            VoteOperation::RegisterVote => {
                                if !existing_vote_removed {
                                    add_to_metrics(
                                        &mut self.metrics,
                                        &mut self.per_user_metrics,
                                        args.user_id,
                                        |m| incr(&mut m.poll_votes),
                                        args.now,
                                    );
                                }
                            }
                            VoteOperation::DeleteVote => {
                                add_to_metrics(
                                    &mut self.metrics,
                                    &mut self.per_user_metrics,
                                    args.user_id,
                                    |m| decr(&mut m.poll_votes),
                                    args.now,
                                );
                            }
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
        now: TimestampMillis,
    ) -> EndPollResult {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_index.into(), now)
        {
            if let MessageContentInternal::Poll(p) = &mut message.content {
                return if p.ended || p.config.end_date.is_none() {
                    EndPollResult::UnableToEndPoll
                } else {
                    message.last_updated = Some(now);
                    p.ended = true;
                    self.last_updated_timestamps
                        .mark_updated(thread_root_message_index, event_index, now);

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
                |(m, _)| {
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

    pub fn update_proposals(&mut self, user_id: UserId, updates: Vec<(MessageId, ProposalStatusUpdate)>, now: TimestampMillis) {
        for (message_id, update) in updates {
            if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into(), now)
            {
                if message.sender == user_id {
                    if let MessageContentInternal::GovernanceProposal(p) = &mut message.content {
                        p.proposal.update_status(update, now);
                        message.last_updated = Some(now);
                        self.last_updated_timestamps.mark_updated(None, event_index, now);
                    }
                }
            }
        }
    }

    pub fn add_reaction(&mut self, args: AddRemoveReactionArgs) -> AddRemoveReactionResult {
        if !args.reaction.is_valid() {
            // This should never happen because we validate earlier
            panic!("Invalid reaction: {:?}", args.reaction);
        }

        if let Some((message, event_index)) = self.message_internal_mut(
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
            self.last_updated_timestamps
                .mark_updated(args.thread_root_message_index, event_index, args.now);

            add_to_metrics(
                &mut self.metrics,
                &mut self.per_user_metrics,
                args.user_id,
                |m| incr(&mut m.reactions),
                args.now,
            );

            AddRemoveReactionResult::Success
        } else {
            AddRemoveReactionResult::MessageNotFound
        }
    }

    pub fn remove_reaction(&mut self, args: AddRemoveReactionArgs) -> AddRemoveReactionResult {
        if let Some((message, event_index)) = self.message_internal_mut(
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
            self.last_updated_timestamps
                .mark_updated(args.thread_root_message_index, event_index, args.now);

            add_to_metrics(
                &mut self.metrics,
                &mut self.per_user_metrics,
                args.user_id,
                |m| decr(&mut m.reactions),
                args.now,
            );

            AddRemoveReactionResult::Success
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
        if let Some((message, event_index)) = self.message_internal_mut(min_visible_event_index, None, message_id.into(), now) {
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
                let token = content.transaction.token();

                content.reservations.insert(user_id);
                message.last_updated = Some(now);
                self.last_updated_timestamps.mark_updated(None, event_index, now);

                return ReservePrizeResult::Success(token, amount);
            }
        }

        ReservePrizeResult::MessageNotFound
    }

    pub fn claim_prize(&mut self, message_id: MessageId, winner: UserId, now: TimestampMillis) -> ClaimPrizeResult {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), None, message_id.into(), TimestampMillis::default())
        {
            if let MessageContentInternal::Prize(content) = &mut message.content {
                // Remove the reservation
                if content.reservations.remove(&winner) {
                    // Add the user to winners list
                    content.winners.insert(winner);
                    message.last_updated = Some(now);
                    let message_index = message.message_index;
                    self.last_updated_timestamps.mark_updated(None, event_index, now);
                    return ClaimPrizeResult::Success(message_index);
                } else {
                    return ClaimPrizeResult::ReservationNotFound;
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
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into(), now) {
            if let MessageContentInternal::Prize(content) = &mut message.content {
                // Remove the reservation
                if content.reservations.remove(&user_id) {
                    // Put the prize back
                    content.prizes_remaining.push(amount);
                    message.last_updated = Some(now);
                    self.last_updated_timestamps.mark_updated(None, event_index, now);

                    return UnreservePrizeResult::Success;
                } else {
                    return UnreservePrizeResult::ReservationNotFound;
                }
            }
        }

        UnreservePrizeResult::MessageNotFound
    }

    #[allow(clippy::too_many_arguments)]
    pub fn report_message(
        &mut self,
        user_id: UserId,
        chat_id: ChatId,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        reason_code: u32,
        notes: Option<String>,
        now: TimestampMillis,
    ) {
        // Generate a deterministic MessageId based on the `chat_id`, `thread_root_message_index`,
        // and `event_index`. This allows us to quickly find any existing reports for the same
        // message.
        let mut hasher = Sha256::new();
        let chat_id_bytes = chat_id.as_ref();
        hasher.update([chat_id_bytes.len() as u8]);
        hasher.update(chat_id_bytes);
        if let Some(root_message_index_bytes) = thread_root_message_index.map(u32::from).map(|i| i.to_be_bytes()) {
            hasher.update([root_message_index_bytes.len() as u8]);
            hasher.update(root_message_index_bytes);
        } else {
            hasher.update([0]);
        }
        let event_index_bytes = u32::from(event_index).to_be_bytes();
        hasher.update([event_index_bytes.len() as u8]);
        hasher.update(event_index_bytes);

        let hash: Hash = hasher.finalize().into();
        let message_id_bytes: [u8; 16] = hash[..16].try_into().unwrap();
        let message_id: MessageId = u128::from_be_bytes(message_id_bytes).into();

        if let Some((message, index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into(), now) {
            if let MessageContentInternal::ReportedMessage(r) = &mut message.content {
                r.reports.retain(|x| x.reported_by != user_id);
                r.reports.push(MessageReport {
                    reported_by: user_id,
                    timestamp: now,
                    reason_code,
                    notes,
                });
                self.mark_event_updated(None, index, now);
                return;
            }
        }

        self.push_message(PushMessageArgs {
            sender: OPENCHAT_BOT_USER_ID,
            thread_root_message_index: None,
            message_id,
            content: MessageContentInternal::ReportedMessage(ReportedMessageInternal {
                reports: vec![MessageReport {
                    reported_by: user_id,
                    timestamp: now,
                    reason_code,
                    notes,
                }],
            }),
            replies_to: Some(ReplyContext {
                event_list_if_other: Some((chat_id, thread_root_message_index)),
                chat_id_if_other: Some(chat_id),
                event_index,
            }),
            forwarded: false,
            correlation_id: 0,
            now,
        });
    }

    fn update_thread_summary(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        latest_thread_message_index_if_updated: Option<MessageIndex>,
        latest_event_index: EventIndex,
        now: TimestampMillis,
    ) {
        let (root_message, event_index) = self
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

        self.last_updated_timestamps.mark_updated(None, event_index, now);
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

        let expires_at = self.expiry_date(thread_root_message_index.is_some(), now);

        let events_list = if let Some(root_message_index) = thread_root_message_index {
            self.threads.get_mut(&root_message_index).unwrap()
        } else {
            &mut self.main
        };

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

    pub fn mark_message_reminder_created_message_hidden(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_index.into(), now)
        {
            if let MessageContentInternal::MessageReminderCreated(r) = &mut message.content {
                r.hidden = true;
                message.last_updated = Some(now);
                self.mark_event_updated(None, event_index, now);
                return true;
            }
        }
        false
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
    ) -> Option<(&mut MessageInternal, EventIndex)> {
        let events_list = self.events_list_mut(min_visible_event_index, thread_root_message_index, now)?;

        events_list
            .get_mut(event_key, min_visible_event_index, now)
            .and_then(|e| e.event.as_message_mut().map(|m| (m, e.index)))
    }

    fn expiry_date(&self, is_thread_event: bool, now: TimestampMillis) -> Option<TimestampMillis> {
        if is_thread_event {
            None
        } else {
            self.events_ttl.value.map(|d| now + d)
        }
    }
}

fn add_to_metrics<F: FnMut(&mut ChatMetrics)>(
    metrics: &mut ChatMetrics,
    per_user_metrics: &mut HashMap<UserId, ChatMetrics>,
    user_id: UserId,
    mut action: F,
    timestamp: TimestampMillis,
) {
    action(metrics);
    metrics.last_active = max(metrics.last_active, timestamp);

    let user_metrics = per_user_metrics.entry(user_id).or_default();
    action(user_metrics);
    user_metrics.last_active = max(user_metrics.last_active, timestamp);
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
    pub now: TimestampMillis,
}

pub enum EditMessageResult {
    Success,
    NotAuthorized,
    NotFound,
}

pub enum DeleteMessageResult {
    Success(UserId), // UserId is the message sender
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
    pub now: TimestampMillis,
}

pub struct DeleteUndeleteMessageArgs {
    pub caller: UserId,
    pub is_admin: bool,
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
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
    pub now: TimestampMillis,
}

pub enum AddRemoveReactionResult {
    Success,
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
