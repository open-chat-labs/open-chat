use crate::chat_events_list::Reader;
use crate::expiring_events::ExpiringEvents;
use crate::last_updated_timestamps::LastUpdatedTimestamps;
use crate::metrics::{ChatMetricsInternal, MetricKey};
use crate::search_index::SearchIndex;
use crate::*;
use constants::{ONE_MB, OPENCHAT_BOT_USER_ID};
use event_store_producer::{EventBuilder, EventStoreClient, Runtime};
use rand::rngs::StdRng;
use rand::Rng;
use search::simple::{Document, Query};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use sha2::{Digest, Sha256};
use std::cmp::max;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{BTreeMap, HashSet};
use std::mem;
use std::ops::DerefMut;
use tracing::{error, info};
use types::{
    AcceptP2PSwapResult, BlobReference, BotMessageContext, CallParticipant, CancelP2PSwapResult, CanisterId, Chat,
    ChatEventType, ChatType, CompleteP2PSwapResult, CompletedCryptoTransaction, Cryptocurrency, DirectChatCreated,
    EventContext, EventIndex, EventMetaData, EventWrapper, EventWrapperInternal, EventsTimeToLiveUpdated,
    GroupCanisterThreadDetails, GroupCreated, GroupFrozen, GroupUnfrozen, Hash, HydratedMention, Mention, Message,
    MessageEditedEventPayload, MessageEventPayload, MessageId, MessageIndex, MessageMatch, MessageReport,
    MessageTippedEventPayload, Milliseconds, MultiUserChat, P2PSwapAccepted, P2PSwapCompleted, P2PSwapCompletedEventPayload,
    P2PSwapContent, P2PSwapStatus, PendingCryptoTransaction, PollVotes, ProposalUpdate, PushEventResult, Reaction,
    ReactionAddedEventPayload, RegisterVoteResult, ReserveP2PSwapResult, ReserveP2PSwapSuccess, TimestampMillis,
    TimestampNanos, Timestamped, Tips, UserId, VideoCall, VideoCallEndedEventPayload, VideoCallParticipants, VideoCallPresence,
    VoteOperation,
};

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat: Chat,
    main: ChatEventsList,
    threads: BTreeMap<MessageIndex, ChatEventsList>,
    metrics: ChatMetricsInternal,
    per_user_metrics: BTreeMap<UserId, ChatMetricsInternal>,
    frozen: bool,
    events_ttl: Timestamped<Option<Milliseconds>>,
    expiring_events: ExpiringEvents,
    last_updated_timestamps: LastUpdatedTimestamps,
    video_call_in_progress: Timestamped<Option<VideoCall>>,
    anonymized_id: String,
    search_index: SearchIndex,
    #[serde(default)]
    message_ids_deduped: bool,
}

impl ChatEvents {
    pub fn fix_duplicate_message_ids(&mut self, rng: &mut StdRng) -> Option<bool> {
        if self.message_ids_deduped {
            return Some(true);
        }
        if !self.main.fix_duplicate_message_ids(rng)? {
            return Some(false);
        }
        for thread in self.threads.values_mut() {
            thread.fix_duplicate_message_ids(rng)?;
        }
        info!(chat = ?self.chat, "Finished deduping messageIds");
        self.message_ids_deduped = true;
        Some(true)
    }

    pub fn prune_updated_events(&mut self, now: TimestampMillis) -> u32 {
        self.last_updated_timestamps.prune(now)
    }

    pub fn import_events(chat: Chat, events: Vec<(EventContext, ByteBuf)>) {
        stable_memory::write_events_as_bytes(chat, events);
    }

    pub fn new_direct_chat(
        them: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_id: u128,
        now: TimestampMillis,
    ) -> ChatEvents {
        let chat = Chat::Direct(them.into());
        let mut events = ChatEvents {
            chat,
            main: ChatEventsList::new(chat, None),
            threads: BTreeMap::new(),
            metrics: ChatMetricsInternal::default(),
            per_user_metrics: BTreeMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
            last_updated_timestamps: LastUpdatedTimestamps::default(),
            video_call_in_progress: Timestamped::default(),
            anonymized_id: hex::encode(anonymized_id.to_be_bytes()),
            search_index: SearchIndex::default(),
            message_ids_deduped: true,
        };

        events.push_event(None, ChatEventInternal::DirectChatCreated(DirectChatCreated {}), 0, now);

        events
    }

    pub fn new_group_chat(
        chat: MultiUserChat,
        name: String,
        description: String,
        created_by: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_id: u128,
        now: TimestampMillis,
    ) -> ChatEvents {
        let chat = chat.into();
        let mut events = ChatEvents {
            chat,
            main: ChatEventsList::new(chat, None),
            threads: BTreeMap::new(),
            metrics: ChatMetricsInternal::default(),
            per_user_metrics: BTreeMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
            last_updated_timestamps: LastUpdatedTimestamps::default(),
            video_call_in_progress: Timestamped::default(),
            anonymized_id: hex::encode(anonymized_id.to_be_bytes()),
            search_index: SearchIndex::default(),
            message_ids_deduped: true,
        };

        events.push_event(
            None,
            ChatEventInternal::GroupChatCreated(Box::new(GroupCreated {
                name,
                description,
                created_by,
            })),
            0,
            now,
        );

        events
    }

    pub fn set_chat(&mut self, chat: Chat) {
        self.chat = chat;
        self.main.set_stable_memory_prefix(chat, None);
        for (message_index, events_list) in self.threads.iter_mut() {
            events_list.set_stable_memory_prefix(chat, Some(*message_index));
        }
    }

    pub fn read_events_as_bytes_from_stable_memory(&self, after: Option<EventContext>) -> Vec<(EventContext, ByteBuf)> {
        stable_memory::read_events_as_bytes(self.chat, after, ONE_MB as usize)
    }

    pub fn iter_recently_updated_events(
        &self,
    ) -> impl Iterator<Item = (Option<MessageIndex>, EventIndex, TimestampMillis)> + '_ {
        self.last_updated_timestamps.iter()
    }

    pub fn thread_keys(&self) -> impl Iterator<Item = MessageIndex> + '_ {
        self.threads.keys().copied()
    }

    pub fn thread_details(&self, thread_root_message_index: &MessageIndex) -> Option<GroupCanisterThreadDetails> {
        self.threads
            .get(thread_root_message_index)
            .map(|t| GroupCanisterThreadDetails {
                root_message_index: *thread_root_message_index,
                latest_event: t.latest_event_index().unwrap_or_default(),
                latest_message: t.latest_message_index().unwrap_or_default(),
                last_updated: t.latest_event_timestamp().unwrap_or_default(),
            })
    }

    pub fn push_message<R: Runtime + Send + 'static>(
        &mut self,
        args: PushMessageArgs,
        mut event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> EventWrapper<Message> {
        let events_list = if let Some(root_message_index) = args.thread_root_message_index {
            self.threads
                .entry(root_message_index)
                .or_insert_with(|| ChatEventsList::new(self.chat, Some(root_message_index)))
        } else {
            &mut self.main
        };

        let video_call_type = if let MessageContentInternal::VideoCall(vc) = &args.content { Some(vc.call_type) } else { None };

        if let Some(client) = event_store_client.as_mut() {
            let event_payload = MessageEventPayload {
                message_type: args.content.content_type().to_string(),
                chat_type: ChatType::from(&self.chat).to_string(),
                chat_id: self.anonymized_id.clone(),
                thread: args.thread_root_message_index.is_some(),
                sender_is_bot: args.sender_is_bot,
                content_specific_payload: args.content.event_payload(),
            };

            client.push(
                EventBuilder::new("message_sent", args.now)
                    .with_user(args.sender.to_string(), true)
                    .with_source(self.chat.canister_id().to_string(), true)
                    .with_json_payload(&event_payload)
                    .build(),
            );
        }

        let message_index = events_list.next_message_index();
        let message_internal = MessageInternal {
            message_index,
            message_id: args.message_id,
            sender: args.sender,
            content: args.content,
            bot_context: args.bot_context,
            replies_to: args.replies_to,
            reactions: Vec::new(),
            tips: Tips::default(),
            last_edited: None,
            deleted_by: None,
            thread_summary: None,
            forwarded: args.forwarded,
            block_level_markdown: args.block_level_markdown,
        };

        add_to_metrics(
            &mut self.metrics,
            &mut self.per_user_metrics,
            args.sender,
            |m| message_internal.add_to_metrics(m),
            args.now,
        );

        let message = message_internal.clone().hydrate(Some(message_internal.sender));

        let push_event_result = self.push_event(
            args.thread_root_message_index,
            ChatEventInternal::Message(Box::new(message_internal)),
            args.correlation_id,
            args.now,
        );

        if let Some(root_message_index) = args.thread_root_message_index {
            let _ = self.update_thread_summary(
                root_message_index,
                |thread_summary, root_message_sender| {
                    thread_summary.mark_message_added(
                        args.sender,
                        &args.mentioned,
                        root_message_sender,
                        push_event_result.index,
                        args.now,
                    );
                    true
                },
                EventIndex::default(),
                true,
                args.now,
            );
        }

        if let Some(call_type) = video_call_type {
            if let Some(vc) = &self.video_call_in_progress.value {
                self.end_video_call(vc.message_index.into(), args.now, event_store_client);
            }

            self.video_call_in_progress = Timestamped::new(
                Some(VideoCall {
                    message_index,
                    call_type,
                }),
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

    pub fn edit_message<R: Runtime + Send + 'static>(
        &mut self,
        args: EditMessageArgs,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> EditMessageResult {
        let sender = args.sender;
        let thread_root_message_index = args.thread_root_message_index;
        let now = args.now;
        let chat = self.chat;
        let anonymized_id = self.anonymized_id.clone();

        match self.update_message(
            thread_root_message_index,
            args.message_id.into(),
            args.min_visible_event_index,
            Some(now),
            |message, event| Self::edit_message_inner(message, event, args, chat, anonymized_id, event_store_client),
        ) {
            Ok((message_index, event, document)) => {
                if thread_root_message_index.is_none() {
                    self.search_index.push(message_index, sender, document);
                }

                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    sender,
                    |m| m.incr(MetricKey::Edits, 1),
                    now,
                );
                EditMessageResult::Success(message_index, event)
            }
            Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => EditMessageResult::NotFound,
        }
    }

    fn edit_message_inner<R: Runtime + Send + 'static>(
        message: &mut MessageInternal,
        event: EventMetaData,
        args: EditMessageArgs,
        chat: Chat,
        anonymized_id: String,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> Result<(MessageIndex, EventMetaData, Document), UpdateEventError<EditMessageResult>> {
        if message.sender != args.sender || matches!(message.content, MessageContentInternal::Deleted(_)) {
            return Err(UpdateEventError::NoChange(EditMessageResult::NotAuthorized));
        }

        let existing_text = message.content.text();
        let new_text = args.content.text();
        let block_level_markdown_update = args.block_level_markdown.filter(|md| *md != message.block_level_markdown);

        if new_text != existing_text || block_level_markdown_update.is_some() {
            let edited = new_text.map(|t| t.replace("#LINK_REMOVED", ""))
                != existing_text.map(|t| t.replace("#LINK_REMOVED", ""))
                || block_level_markdown_update.is_some();

            let old_length = message.content.text_length();
            message.content = args.content;

            let message_index = message.message_index;
            let document = Document::from(&message.content);

            if edited {
                if let Some(block_level_markdown) = block_level_markdown_update {
                    message.block_level_markdown = block_level_markdown;
                }

                let already_edited = message.last_edited.is_some();
                message.last_edited = Some(args.now);

                if args.finalise_bot_message {
                    if let Some(bot_context) = message.bot_context.as_mut() {
                        bot_context.finalised = true;
                    }
                }

                if let Some(client) = event_store_client {
                    let new_length = message.content.text_length();
                    let payload = MessageEditedEventPayload {
                        message_type: message.content.content_type().to_string(),
                        chat_type: ChatType::from(&chat).to_string(),
                        chat_id: anonymized_id,
                        thread: args.thread_root_message_index.is_some(),
                        already_edited,
                        old_length,
                        new_length,
                    };

                    client.push(
                        EventBuilder::new("message_edited", args.now)
                            .with_user(args.sender.to_string(), true)
                            .with_source(chat.canister_id().to_string(), true)
                            .with_json_payload(&payload)
                            .build(),
                    )
                }
            }
            return Ok((message_index, event, document));
        }

        Err(UpdateEventError::NoChange(EditMessageResult::Success(
            message.message_index,
            event,
        )))
    }

    pub fn last_updated(&self) -> Option<TimestampMillis> {
        max(
            self.main.latest_event_timestamp(),
            self.iter_recently_updated_events().next().map(|(_, _, ts)| ts),
        )
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
        match self.update_message(
            args.thread_root_message_index,
            args.message_id.into(),
            args.min_visible_event_index,
            Some(args.now),
            |message, _| Self::delete_message_inner(message, &args),
        ) {
            Ok((sender, message_index)) => {
                if sender != args.caller {
                    add_to_metrics(
                        &mut self.metrics,
                        &mut self.per_user_metrics,
                        sender,
                        |m| m.incr(MetricKey::ReportedMessages, 1),
                        args.now,
                    );
                }
                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    args.caller,
                    |m| m.incr(MetricKey::DeletedMessages, 1),
                    args.now,
                );
                if args.thread_root_message_index.is_none() {
                    self.search_index.remove(message_index);
                }
                DeleteMessageResult::Success(sender)
            }
            Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => DeleteMessageResult::NotFound,
        }
    }

    fn delete_message_inner(
        message: &mut MessageInternal,
        args: &DeleteUndeleteMessageArgs,
    ) -> Result<(UserId, MessageIndex), UpdateEventError<DeleteMessageResult>> {
        use DeleteMessageResult::*;

        if message.sender == args.caller || args.is_admin {
            if message.deleted_by.is_some() || matches!(message.content, MessageContentInternal::Deleted(_)) {
                Err(UpdateEventError::NoChange(AlreadyDeleted))
            } else if matches!(message.content, MessageContentInternal::VideoCall(ref c) if c.ended.is_none()) {
                Err(UpdateEventError::NoChange(NotAuthorized))
            } else {
                let sender = message.sender;
                message.deleted_by = Some(DeletedByInternal {
                    deleted_by: args.caller,
                    timestamp: args.now,
                });
                Ok((sender, message.message_index))
            }
        } else {
            Err(UpdateEventError::NoChange(NotAuthorized))
        }
    }

    fn undelete_message(&mut self, args: DeleteUndeleteMessageArgs) -> UndeleteMessageResult {
        match self.update_message(
            args.thread_root_message_index,
            args.message_id.into(),
            args.min_visible_event_index,
            Some(args.now),
            |message, _| Self::undelete_message_inner(message, &args),
        ) {
            Ok((sender, message_index, document)) => {
                if sender != args.caller {
                    add_to_metrics(
                        &mut self.metrics,
                        &mut self.per_user_metrics,
                        sender,
                        |m| m.decr(MetricKey::ReportedMessages, 1),
                        args.now,
                    );
                }
                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    args.caller,
                    |m| m.decr(MetricKey::DeletedMessages, 1),
                    args.now,
                );
                if args.thread_root_message_index.is_none() {
                    self.search_index.push(message_index, sender, document);
                }
                UndeleteMessageResult::Success
            }
            Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => UndeleteMessageResult::NotFound,
        }
    }

    fn undelete_message_inner(
        message: &mut MessageInternal,
        args: &DeleteUndeleteMessageArgs,
    ) -> Result<(UserId, MessageIndex, Document), UpdateEventError<UndeleteMessageResult>> {
        use UndeleteMessageResult::*;

        let Some(deleted_by) = message.deleted_by.as_ref().map(|db| db.deleted_by) else {
            return Err(UpdateEventError::NoChange(NotDeleted));
        };

        if deleted_by == args.caller || (args.is_admin && message.sender != deleted_by) {
            match message.content {
                MessageContentInternal::Deleted(_) => Err(UpdateEventError::NoChange(HardDeleted)),
                MessageContentInternal::Crypto(_) => Err(UpdateEventError::NoChange(InvalidMessageType)),
                _ => {
                    let sender = message.sender;
                    message.deleted_by = None;
                    Ok((sender, message.message_index, Document::from(&message.content)))
                }
            }
        } else {
            Err(UpdateEventError::NoChange(NotAuthorized))
        }
    }

    // The UserId returned is the message sender
    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<(MessageContentInternal, UserId)> {
        if let Ok((content, sender)) = self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            None,
            |message, _| Self::remove_deleted_message_content_inner(message),
        ) {
            Some((content, sender))
        } else {
            None
        }
    }

    fn remove_deleted_message_content_inner(
        message: &mut MessageInternal,
    ) -> Result<(MessageContentInternal, UserId), UpdateEventError> {
        let Some(deleted_by) = message.deleted_by.clone() else {
            return Err(UpdateEventError::NoChange(()));
        };

        let content = std::mem::replace(&mut message.content, MessageContentInternal::Deleted(deleted_by));
        let sender = message.sender;

        Ok((content, sender))
    }

    pub fn register_poll_vote(&mut self, args: RegisterPollVoteArgs) -> RegisterPollVoteResult {
        match self.update_message(
            args.thread_root_message_index,
            args.message_index.into(),
            args.min_visible_event_index,
            Some(args.now),
            |message, _| Self::register_poll_vote_inner(message, &args),
        ) {
            Ok((votes, existing_vote_removed, creator)) => {
                match args.operation {
                    VoteOperation::RegisterVote => {
                        if !existing_vote_removed {
                            add_to_metrics(
                                &mut self.metrics,
                                &mut self.per_user_metrics,
                                args.user_id,
                                |m| m.incr(MetricKey::PollVotes, 1),
                                args.now,
                            );
                        }
                    }
                    VoteOperation::DeleteVote => {
                        add_to_metrics(
                            &mut self.metrics,
                            &mut self.per_user_metrics,
                            args.user_id,
                            |m| m.decr(MetricKey::PollVotes, 1),
                            args.now,
                        );
                    }
                }

                RegisterPollVoteResult::Success(votes, creator)
            }
            Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => RegisterPollVoteResult::PollNotFound,
        }
    }

    fn register_poll_vote_inner(
        message: &mut MessageInternal,
        args: &RegisterPollVoteArgs,
    ) -> Result<(PollVotes, bool, UserId), UpdateEventError<RegisterPollVoteResult>> {
        let MessageContentInternal::Poll(p) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        let result = p.register_vote(args.user_id, args.option_index, args.operation);

        match result {
            RegisterVoteResult::Success(existing_vote_removed) => {
                Ok((p.votes(Some(args.user_id)), existing_vote_removed, message.sender))
            }
            RegisterVoteResult::SuccessNoChange => Err(UpdateEventError::NoChange(RegisterPollVoteResult::SuccessNoChange(
                p.votes(Some(args.user_id)),
            ))),
            RegisterVoteResult::PollEnded => Err(UpdateEventError::NoChange(RegisterPollVoteResult::PollEnded)),
            RegisterVoteResult::OptionIndexOutOfRange => {
                Err(UpdateEventError::NoChange(RegisterPollVoteResult::OptionIndexOutOfRange))
            }
            RegisterVoteResult::UserCannotChangeVote => {
                Err(UpdateEventError::NoChange(RegisterPollVoteResult::UserCannotChangeVote))
            }
        }
    }

    pub fn end_poll(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> EndPollResult {
        use EndPollResult::*;

        match self.update_message(
            thread_root_message_index,
            message_index.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::end_poll_inner(message),
        ) {
            Ok(_) => Success,
            Err(UpdateEventError::NoChange(_)) => UnableToEndPoll,
            Err(UpdateEventError::NotFound) => PollNotFound,
        }
    }

    fn end_poll_inner(message: &mut MessageInternal) -> Result<(), UpdateEventError> {
        let MessageContentInternal::Poll(p) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if !p.ended && p.config.end_date.is_some() {
            p.ended = true;
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn final_payments(&mut self, message_index: MessageIndex, now_nanos: TimestampNanos) -> Vec<PendingCryptoTransaction> {
        self.update_message(None, message_index.into(), EventIndex::default(), None, |message, _| {
            Self::final_payments_inner(message, now_nanos)
        })
        .ok()
        .unwrap_or_default()
    }

    fn final_payments_inner(
        message: &mut MessageInternal,
        now_nanos: TimestampNanos,
    ) -> Result<Vec<PendingCryptoTransaction>, UpdateEventError> {
        let MessageContentInternal::Prize(p) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        Ok(p.final_payments(message.sender, now_nanos))
    }

    pub fn record_proposal_vote(
        &mut self,
        user_id: UserId,
        min_visible_event_index: EventIndex,
        message_index: MessageIndex,
        adopt: bool,
    ) -> RecordProposalVoteResult {
        use RecordProposalVoteResult::*;

        match self.update_message(None, message_index.into(), min_visible_event_index, None, |message, _| {
            Self::record_proposal_vote_inner(message, user_id, adopt)
        }) {
            Ok(_) => Success,
            Err(UpdateEventError::NoChange(vote)) => AlreadyVoted(vote),
            Err(UpdateEventError::NotFound) => ProposalNotFound,
        }
    }

    fn record_proposal_vote_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        adopt: bool,
    ) -> Result<(), UpdateEventError<bool>> {
        let MessageContentInternal::GovernanceProposal(proposal) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        match proposal.votes.entry(user_id) {
            Vacant(e) => {
                // We choose not to update the `last_updated` field on the message here because
                // the update is private, only visible to the current user, and updating the
                // field would cause the message to be returned to all users unnecessarily.
                e.insert(adopt);
                Ok(())
            }
            Occupied(e) => Err(UpdateEventError::NoChange(*e.get())),
        }
    }

    pub fn update_proposals(&mut self, user_id: UserId, updates: Vec<ProposalUpdate>, now: TimestampMillis) {
        for update in updates {
            let _ = self.update_message(
                None,
                update.message_id.into(),
                EventIndex::default(),
                Some(now),
                |message, _| Self::update_proposal_inner(message, user_id, update, now),
            );
        }
    }

    fn update_proposal_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        update: ProposalUpdate,
        now: TimestampMillis,
    ) -> Result<(), UpdateEventError> {
        if message.sender == user_id {
            if let MessageContentInternal::GovernanceProposal(p) = &mut message.content {
                p.proposal.update_status(update.into(), now);
                return Ok(());
            }
        }
        Err(UpdateEventError::NotFound)
    }

    pub fn add_reaction<R: Runtime + Send + 'static>(
        &mut self,
        args: AddRemoveReactionArgs,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> AddRemoveReactionResult {
        use AddRemoveReactionResult::*;

        if !args.reaction.is_valid() {
            // This should never happen because we validate earlier
            panic!("Invalid reaction: {:?}", args.reaction);
        }

        let user_id = args.user_id;
        let now = args.now;
        let chat = self.chat;
        let anonymized_id = self.anonymized_id.clone();

        match self.update_message(
            args.thread_root_message_index,
            args.message_id.into(),
            args.min_visible_event_index,
            Some(now),
            |message, _| Self::add_reaction_inner(message, args, chat, anonymized_id, event_store_client),
        ) {
            Ok(sender) => {
                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    user_id,
                    |m| m.incr(MetricKey::Reactions, 1),
                    now,
                );
                Success(sender)
            }
            Err(UpdateEventError::NoChange(_)) => NoChange,
            Err(UpdateEventError::NotFound) => MessageNotFound,
        }
    }

    fn add_reaction_inner<R: Runtime + Send + 'static>(
        message: &mut MessageInternal,
        args: AddRemoveReactionArgs,
        chat: Chat,
        anonymized_id: String,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> Result<UserId, UpdateEventError> {
        let added = if let Some((_, users)) = message.reactions.iter_mut().find(|(r, _)| *r == args.reaction) {
            users.insert(args.user_id)
        } else {
            message
                .reactions
                .push((args.reaction, vec![args.user_id].into_iter().collect()));
            true
        };

        if !added {
            return Err(UpdateEventError::NoChange(()));
        }

        let sender = message.sender;

        if let Some(client) = event_store_client {
            let payload = ReactionAddedEventPayload {
                message_type: message.content.content_type().to_string(),
                chat_type: ChatType::from(&chat).to_string(),
                chat_id: anonymized_id.clone(),
                thread: args.thread_root_message_index.is_some(),
            };

            client.push(
                EventBuilder::new("reaction_added", args.now)
                    .with_user(args.user_id.to_string(), true)
                    .with_source(chat.canister_id().to_string(), true)
                    .with_json_payload(&payload)
                    .build(),
            )
        }

        Ok(sender)
    }

    pub fn remove_reaction(&mut self, args: AddRemoveReactionArgs) -> AddRemoveReactionResult {
        use AddRemoveReactionResult::*;

        match self.update_message(
            args.thread_root_message_index,
            args.message_id.into(),
            args.min_visible_event_index,
            Some(args.now),
            |message, _| Self::remove_reaction_inner(message, &args),
        ) {
            Ok(sender) => {
                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    args.user_id,
                    |m| m.decr(MetricKey::Reactions, 1),
                    args.now,
                );
                Success(sender)
            }
            Err(UpdateEventError::NoChange(_)) => NoChange,
            Err(UpdateEventError::NotFound) => MessageNotFound,
        }
    }

    fn remove_reaction_inner(message: &mut MessageInternal, args: &AddRemoveReactionArgs) -> Result<UserId, UpdateEventError> {
        let (removed, is_empty) = message
            .reactions
            .iter_mut()
            .find(|(r, _)| *r == args.reaction)
            .map(|(_, u)| (u.remove(&args.user_id), u.is_empty()))
            .unwrap_or_default();

        if !removed {
            return Err(UpdateEventError::NoChange(()));
        }

        if is_empty {
            message.reactions.retain(|(_, u)| !u.is_empty());
        }

        Ok(message.sender)
    }

    pub fn tip_message<R: Runtime + Send + 'static>(
        &mut self,
        args: TipMessageArgs,
        min_visible_event_index: EventIndex,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> TipMessageResult {
        use TipMessageResult::*;

        let chat = self.chat;
        let anonymized_id = self.anonymized_id.clone();

        match self.update_message(
            args.thread_root_message_index,
            args.message_id.into(),
            min_visible_event_index,
            Some(args.now),
            |message, _| Self::tip_message_inner(message, &args, chat, anonymized_id, event_store_client),
        ) {
            Ok(_) => {
                add_to_metrics(
                    &mut self.metrics,
                    &mut self.per_user_metrics,
                    args.user_id,
                    |m| m.incr(MetricKey::Tips, 1),
                    args.now,
                );
                Success
            }
            Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => MessageNotFound,
        }
    }

    fn tip_message_inner<R: Runtime + Send + 'static>(
        message: &mut MessageInternal,
        args: &TipMessageArgs,
        chat: Chat,
        anonymized_id: String,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> Result<(), UpdateEventError<TipMessageResult>> {
        use TipMessageResult::*;

        if message.sender == args.user_id {
            return Err(UpdateEventError::NoChange(CannotTipSelf));
        }
        if message.sender != args.recipient {
            error!(
                user = %args.user_id,
                recipient = %args.recipient,
                sender = %message.sender,
                message_index = ?message.message_index,
                message_id = ?message.message_id,
                "Tip failed due to recipient mismatch"
            );
            return Err(UpdateEventError::NoChange(RecipientMismatch));
        }

        message.tips.push(args.ledger, args.user_id, args.amount);

        if let Some(client) = event_store_client {
            let message_type = message.content.content_type().to_string();

            client.push(
                EventBuilder::new("message_tipped", args.now)
                    .with_user(args.user_id.to_string(), true)
                    .with_source(chat.canister_id().to_string(), true)
                    .with_json_payload(&MessageTippedEventPayload {
                        message_type,
                        chat_type: ChatType::from(&chat).to_string(),
                        chat_id: anonymized_id.clone(),
                        thread: args.thread_root_message_index.is_some(),
                        token: args.token.token_symbol().to_string(),
                        amount: args.amount,
                    })
                    .build(),
            );
        }

        Ok(())
    }

    pub fn reserve_prize(
        &mut self,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        user_id: UserId,
        now: TimestampMillis,
    ) -> ReservePrizeResult {
        match self.update_message(None, message_id.into(), min_visible_event_index, Some(now), |message, _| {
            Self::reserve_prize_inner(message, user_id, now)
        }) {
            Ok(result) | Err(UpdateEventError::NoChange(result)) => result,
            Err(UpdateEventError::NotFound) => ReservePrizeResult::MessageNotFound,
        }
    }

    fn reserve_prize_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        now: TimestampMillis,
    ) -> Result<ReservePrizeResult, UpdateEventError<ReservePrizeResult>> {
        let MessageContentInternal::Prize(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if content.end_date < now {
            return Err(UpdateEventError::NoChange(ReservePrizeResult::PrizeEnded));
        }

        if content.prizes_remaining.is_empty() {
            return Err(UpdateEventError::NoChange(ReservePrizeResult::PrizeFullyClaimed));
        }

        if content.winners.contains(&user_id) || content.reservations.contains(&user_id) {
            return Err(UpdateEventError::NoChange(ReservePrizeResult::AlreadyClaimed));
        }

        if content.ledger_error {
            return Err(UpdateEventError::NoChange(ReservePrizeResult::LedgerError));
        }

        // Pop the last prize and reserve it
        let amount = content.prizes_remaining.pop().expect("some prizes_remaining");
        let token = content.transaction.token();
        let ledger_canister_id = content.transaction.ledger_canister_id();
        let fee = content.transaction.fee();

        content.reservations.insert(user_id);

        Ok(ReservePrizeResult::Success(ReservePriceSuccess {
            token,
            ledger_canister_id,
            amount,
            fee,
            message_index: message.message_index,
        }))
    }

    pub fn claim_prize<R: Runtime + Send + 'static>(
        &mut self,
        message_id: MessageId,
        winner: UserId,
        transaction: CompletedCryptoTransaction,
        rng: &mut StdRng,
        event_store_client: &mut EventStoreClient<R>,
        now: TimestampMillis,
    ) -> ClaimPrizeResult {
        use ClaimPrizeResult::*;

        let amount = transaction.units();

        match self.update_message(None, message_id.into(), EventIndex::default(), Some(now), |message, _| {
            Self::claim_prize_inner(message, winner, amount)
        }) {
            Ok(message_index) => {
                // Push a PrizeWinnerContent message to the group from the OpenChatBot
                self.push_message(
                    PushMessageArgs {
                        sender: OPENCHAT_BOT_USER_ID,
                        thread_root_message_index: Some(message_index),
                        message_id: rng.gen(),
                        content: MessageContentInternal::PrizeWinner(PrizeWinnerContentInternal {
                            winner,
                            ledger: transaction.ledger_canister_id(),
                            token_symbol: transaction.token().token_symbol().to_string(),
                            amount,
                            fee: transaction.fee(),
                            block_index: transaction.index(),
                            prize_message: message_index,
                        }),
                        bot_context: None,
                        mentioned: Vec::new(),
                        replies_to: None,
                        forwarded: false,
                        sender_is_bot: true,
                        block_level_markdown: false,
                        correlation_id: 0,
                        now,
                    },
                    Some(event_store_client),
                );
                Success
            }
            Err(UpdateEventError::NoChange(_)) => ReservationNotFound,
            Err(UpdateEventError::NotFound) => MessageNotFound,
        }
    }

    fn claim_prize_inner(
        message: &mut MessageInternal,
        winner: UserId,
        amount: u128,
    ) -> Result<MessageIndex, UpdateEventError> {
        let MessageContentInternal::Prize(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        // Remove the reservation
        if content.reservations.remove(&winner) {
            // Add the user to winners list
            content.winners.insert(winner);
            content.prizes_paid += amount;
            Ok(message.message_index)
        } else {
            Err(UpdateEventError::NotFound)
        }
    }

    pub fn unreserve_prize(
        &mut self,
        message_id: MessageId,
        user_id: UserId,
        amount: u128,
        ledger_error: bool,
        now: TimestampMillis,
    ) -> UnreservePrizeResult {
        match self.update_message(None, message_id.into(), EventIndex::default(), Some(now), |message, _| {
            Self::unreserve_prize_inner(message, user_id, amount, ledger_error)
        }) {
            Ok(_) => UnreservePrizeResult::Success,
            Err(UpdateEventError::NoChange(_)) => UnreservePrizeResult::ReservationNotFound,
            Err(UpdateEventError::NotFound) => UnreservePrizeResult::MessageNotFound,
        }
    }

    fn unreserve_prize_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        amount: u128,
        ledger_error: bool,
    ) -> Result<(), UpdateEventError> {
        let MessageContentInternal::Prize(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if ledger_error {
            content.ledger_error = true;
        }

        // Remove the reservation
        if content.reservations.remove(&user_id) {
            // Put the prize back
            content.prizes_remaining.push(amount);
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn pending_prize_messages(&self, date_cutoff: TimestampMillis) -> Vec<(MessageId, PrizeContentInternal)> {
        self.main
            .iter(None, false, EventIndex::default(), None)
            .filter_map(|e| e.into_event())
            .take_while(|e| e.timestamp > date_cutoff)
            .filter_map(|e| e.event.into_message())
            .filter_map(|m| {
                if let MessageContentInternal::Prize(p) = &m.content {
                    Some((m.message_id, p.clone()))
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn reduce_final_prize_by_transfer_fee(&mut self, message_id: MessageId) -> bool {
        self.update_message(None, message_id.into(), EventIndex::default(), None, |message, _| {
            Self::reduce_final_prize_by_transfer_fee_inner(message)
        })
        .is_ok()
    }

    fn reduce_final_prize_by_transfer_fee_inner(message: &mut MessageInternal) -> Result<(), UpdateEventError> {
        let MessageContentInternal::Prize(p) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if !p.prizes_remaining.is_empty() {
            let last = p.prizes_remaining.remove(0);
            p.prizes_remaining.insert(0, last.saturating_sub(p.transaction.fee()));
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn get_p2p_swap(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
    ) -> Option<P2PSwapContent> {
        self.message_internal(min_visible_event_index, thread_root_message_index, message_id.into())
            .and_then(|(m, _)| if let MessageContentInternal::P2PSwap(p) = m.content { Some(p.into()) } else { None })
    }

    pub fn reserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> ReserveP2PSwapResult {
        match self.update_message(
            thread_root_message_index,
            message_id.into(),
            min_visible_event_index,
            Some(now),
            |message, event| Self::reserve_p2p_swap_inner(message, event.timestamp, user_id, now),
        ) {
            Ok(success) => ReserveP2PSwapResult::Success(success),
            Err(UpdateEventError::NoChange(status)) => ReserveP2PSwapResult::Failure(status),
            Err(UpdateEventError::NotFound) => ReserveP2PSwapResult::SwapNotFound,
        }
    }

    fn reserve_p2p_swap_inner(
        message: &mut MessageInternal,
        message_timestamp: TimestampMillis,
        user_id: UserId,
        now: TimestampMillis,
    ) -> Result<ReserveP2PSwapSuccess, UpdateEventError<P2PSwapStatus>> {
        let MessageContentInternal::P2PSwap(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if content.reserve(user_id, now) {
            Ok(ReserveP2PSwapSuccess {
                content: content.clone().into(),
                created: message_timestamp,
                created_by: message.sender,
            })
        } else {
            Err(UpdateEventError::NoChange(content.status.clone()))
        }
    }

    pub fn accept_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        token1_txn_in: u64,
        now: TimestampMillis,
    ) -> AcceptP2PSwapResult {
        match self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::accept_p2p_swap_inner(message, user_id, token1_txn_in),
        ) {
            Ok(success) => AcceptP2PSwapResult::Success(success),
            Err(UpdateEventError::NoChange(status)) => AcceptP2PSwapResult::Failure(status),
            Err(UpdateEventError::NotFound) => AcceptP2PSwapResult::SwapNotFound,
        }
    }

    fn accept_p2p_swap_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        token1_txn_in: u64,
    ) -> Result<P2PSwapAccepted, UpdateEventError<P2PSwapStatus>> {
        let MessageContentInternal::P2PSwap(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if content.accept(user_id, token1_txn_in) {
            Ok(P2PSwapAccepted {
                accepted_by: user_id,
                token1_txn_in,
            })
        } else {
            Err(UpdateEventError::NoChange(content.status.clone()))
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn complete_p2p_swap<R: Runtime + Send + 'static>(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        token0_txn_out: u64,
        token1_txn_out: u64,
        now: TimestampMillis,
        event_store_client: &mut EventStoreClient<R>,
    ) -> CompleteP2PSwapResult {
        let chat = self.chat;
        let anonymized_id = self.anonymized_id.clone();

        match self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| {
                Self::complete_p2p_swap_inner(
                    message,
                    user_id,
                    token0_txn_out,
                    token1_txn_out,
                    now,
                    chat,
                    anonymized_id,
                    event_store_client,
                )
            },
        ) {
            Ok(status) => CompleteP2PSwapResult::Success(status),
            Err(UpdateEventError::NoChange(status)) => CompleteP2PSwapResult::Failure(status),
            Err(UpdateEventError::NotFound) => CompleteP2PSwapResult::SwapNotFound,
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn complete_p2p_swap_inner<R: Runtime + Send + 'static>(
        message: &mut MessageInternal,
        user_id: UserId,
        token0_txn_out: u64,
        token1_txn_out: u64,
        now: TimestampMillis,
        chat: Chat,
        anonymized_id: String,
        event_store_client: &mut EventStoreClient<R>,
    ) -> Result<P2PSwapCompleted, UpdateEventError<P2PSwapStatus>> {
        let MessageContentInternal::P2PSwap(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if let Some(status) = content.complete(user_id, token0_txn_out, token1_txn_out) {
            let payload = P2PSwapCompletedEventPayload {
                token0: content.token0.token.token_symbol().to_string(),
                token0_amount: content.token0_amount,
                token1: content.token1.token.token_symbol().to_string(),
                token1_amount: content.token1_amount,
                chat_type: ChatType::from(&chat).to_string(),
                chat_id: anonymized_id.clone(),
            };

            event_store_client.push(
                EventBuilder::new("p2p_swap_completed", now)
                    .with_user(user_id.to_string(), true)
                    .with_source(chat.canister_id().to_string(), true)
                    .with_json_payload(&payload)
                    .build(),
            );

            Ok(status)
        } else {
            Err(UpdateEventError::NoChange(content.status.clone()))
        }
    }

    pub fn unreserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        let _ = self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::unreserve_p2p_swap_inner(message, user_id),
        );
    }

    fn unreserve_p2p_swap_inner(message: &mut MessageInternal, user_id: UserId) -> Result<(), UpdateEventError> {
        let MessageContentInternal::P2PSwap(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if content.unreserve(user_id) {
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn cancel_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> CancelP2PSwapResult {
        match self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::cancel_p2p_swap_inner(message, user_id),
        ) {
            Ok(swap_id) => CancelP2PSwapResult::Success(swap_id),
            Err(UpdateEventError::NoChange(status)) => CancelP2PSwapResult::Failure(status),
            Err(UpdateEventError::NotFound) => CancelP2PSwapResult::SwapNotFound,
        }
    }

    fn cancel_p2p_swap_inner(message: &mut MessageInternal, user_id: UserId) -> Result<u32, UpdateEventError<P2PSwapStatus>> {
        if message.sender == user_id {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                return if content.cancel() {
                    let swap_id = content.swap_id;
                    Ok(swap_id)
                } else {
                    Err(UpdateEventError::NoChange(content.status.clone()))
                };
            }
        }
        Err(UpdateEventError::NotFound)
    }

    pub fn mark_p2p_swap_expired(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        let _ = self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::mark_p2p_swap_expired_inner(message),
        );
    }

    fn mark_p2p_swap_expired_inner(message: &mut MessageInternal) -> Result<(), UpdateEventError> {
        let MessageContentInternal::P2PSwap(content) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if content.mark_expired() {
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn set_p2p_swap_status(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        status: P2PSwapStatus,
        now: TimestampMillis,
    ) {
        let _ = self.update_message(
            thread_root_message_index,
            message_id.into(),
            EventIndex::default(),
            Some(now),
            |message, _| Self::set_p2p_swap_status_inner(message, status),
        );
    }

    fn set_p2p_swap_status_inner(message: &mut MessageInternal, status: P2PSwapStatus) -> Result<(), UpdateEventError> {
        if let MessageContentInternal::P2PSwap(content) = &mut message.content {
            content.status = status;
            Ok(())
        } else {
            Err(UpdateEventError::NotFound)
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn report_message<R: Runtime + Send + 'static>(
        &mut self,
        user_id: UserId,
        chat: MultiUserChat,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        reason_code: u32,
        notes: Option<String>,
        event_store_client: &mut EventStoreClient<R>,
        now: TimestampMillis,
    ) {
        // Generate a deterministic MessageId based on the `chat_id`, `thread_root_message_index`,
        // and `event_index`. This allows us to quickly find any existing reports for the same
        // message.
        let mut hasher = Sha256::new();
        match &chat {
            MultiUserChat::Group(chat_id) => {
                let chat_id_bytes = chat_id.as_ref();
                hasher.update([chat_id_bytes.len() as u8]);
                hasher.update(chat_id_bytes);
            }
            MultiUserChat::Channel(community_id, channel_id) => {
                let community_id_bytes = community_id.as_ref();
                hasher.update([community_id_bytes.len() as u8]);
                hasher.update(community_id);
                let channel_id_bytes = channel_id.as_u32().to_be_bytes();
                hasher.update([channel_id_bytes.len() as u8]);
                hasher.update(channel_id_bytes);
            }
        }
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

        if self
            .update_message(None, message_id.into(), EventIndex::default(), Some(now), |message, _| {
                if let MessageContentInternal::ReportedMessage(r) = &mut message.content {
                    r.reports.retain(|x| x.reported_by != user_id);
                    r.reports.push(MessageReport {
                        reported_by: user_id,
                        timestamp: now,
                        reason_code,
                        notes: notes.clone(),
                    });
                    Ok(())
                } else {
                    Err(UpdateEventError::<()>::NotFound)
                }
            })
            .is_err()
        {
            let chat: Chat = chat.into();

            self.push_message(
                PushMessageArgs {
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
                    bot_context: None,
                    mentioned: Vec::new(),
                    replies_to: Some(ReplyContextInternal {
                        chat_if_other: Some((chat.into(), thread_root_message_index)),
                        event_index,
                    }),
                    forwarded: false,
                    sender_is_bot: true,
                    block_level_markdown: false,
                    correlation_id: 0,
                    now,
                },
                Some(event_store_client),
            );
        }
    }

    // Used when a group is imported into a community
    pub fn migrate_reply(&mut self, message_index: MessageIndex, old: ChatInternal, new: ChatInternal, now: TimestampMillis) {
        if self
            .update_message(None, message_index.into(), EventIndex::default(), Some(now), |message, _| {
                if let Some(r) = message.replies_to.as_mut() {
                    if let Some((chat, _)) = r.chat_if_other.as_mut() {
                        if *chat == old {
                            *chat = new;
                            return Ok(());
                        }
                    }
                }
                Err(UpdateEventError::NoChange(()))
            })
            .is_err()
        {
            error!("Failed to migrate reply. This should never happen")
        }
    }

    pub fn follow_thread(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> FollowThreadResult {
        use FollowThreadResult::*;

        match self.update_thread_summary(
            thread_root_message_index,
            |t, _| t.followers.insert(user_id),
            min_visible_event_index,
            false,
            now,
        ) {
            Ok(_) => Success,
            Err(UpdateEventError::NoChange(_)) => AlreadyFollowing,
            Err(UpdateEventError::NotFound) => ThreadNotFound,
        }
    }

    pub fn unfollow_thread(
        &mut self,
        thread_root_message_index: MessageIndex,
        user_id: UserId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> UnfollowThreadResult {
        use UnfollowThreadResult::*;

        match self.update_thread_summary(
            thread_root_message_index,
            |t, _| t.followers.remove(&user_id),
            min_visible_event_index,
            false,
            now,
        ) {
            Ok(_) => Success,
            Err(UpdateEventError::NoChange(_)) => NotFollowing,
            Err(UpdateEventError::NotFound) => ThreadNotFound,
        }
    }

    fn update_thread_summary<F: FnOnce(&mut ThreadSummaryInternal, UserId) -> bool>(
        &mut self,
        thread_root_message_index: MessageIndex,
        update_fn: F,
        min_visible_event_index: EventIndex,
        create_if_not_exists: bool,
        now: TimestampMillis,
    ) -> Result<(), UpdateEventError> {
        self.update_message(
            None,
            thread_root_message_index.into(),
            min_visible_event_index,
            Some(now),
            |message, _| Self::update_thread_summary_inner(message, create_if_not_exists, update_fn),
        )
    }

    fn update_thread_summary_inner<F: FnOnce(&mut ThreadSummaryInternal, UserId) -> bool>(
        root_message: &mut MessageInternal,
        create_if_not_exists: bool,
        update_fn: F,
    ) -> Result<(), UpdateEventError> {
        let summary = if create_if_not_exists {
            root_message.thread_summary.get_or_insert(ThreadSummaryInternal::default())
        } else if let Some(s) = root_message.thread_summary.as_mut() {
            s
        } else {
            return Err(UpdateEventError::NotFound);
        };

        if update_fn(summary, root_message.sender) {
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
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
            match self.chat {
                Chat::Direct(_) => event.is_valid_for_direct_chat(),
                Chat::Group(_) | Chat::Channel(..) => event.is_valid_for_group_chat(),
            }
        };

        if !valid {
            panic!("Event type is not valid: {event:?}");
        }

        let expires_at = self.expiry_date(&event, thread_root_message_index.is_some(), now);

        let events_list = if let Some(root_message_index) = thread_root_message_index {
            self.threads.get_mut(&root_message_index).unwrap()
        } else {
            if let ChatEventInternal::Message(m) = &event {
                self.search_index.push(m.message_index, m.sender, Document::from(&m.content));
            }
            &mut self.main
        };

        let event_index = events_list.push_event(event, correlation_id, expires_at, now);

        if let Some(timestamp) = expires_at {
            self.expiring_events.insert(event_index, timestamp);
        }

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
        min_visible_message_index: MessageIndex,
        query: Query,
        users: HashSet<UserId>,
        max_results: u8,
    ) -> Vec<MessageMatch> {
        self.search_index
            .search_messages(min_visible_message_index, query, users)
            .map(|message_index| MessageMatch { message_index, score: 1 })
            .take(max_results as usize)
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
        let events = self
            .threads
            .entry(thread_root_message_index)
            .or_insert_with(|| ChatEventsList::new(self.chat, Some(thread_root_message_index)));
        events.push_event(event, correlation_id, None, now)
    }

    pub fn mark_message_reminder_created_message_hidden(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        self.update_message(None, message_index.into(), EventIndex::default(), Some(now), |message, _| {
            Self::mark_message_reminder_created_message_hidden_inner(message)
        })
        .is_ok()
    }

    fn mark_message_reminder_created_message_hidden_inner(message: &mut MessageInternal) -> Result<(), UpdateEventError> {
        if let MessageContentInternal::MessageReminderCreated(r) = &mut message.content {
            r.hidden = true;
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn hydrate_mention(&self, min_visible_event_index: EventIndex, mention: &Mention) -> Option<HydratedMention> {
        let events_reader = self.events_reader(min_visible_event_index, mention.thread_root_message_index, None)?;
        events_reader.hydrate_mention(mention)
    }

    pub fn metrics(&self) -> &ChatMetricsInternal {
        &self.metrics
    }

    pub fn user_metrics(&self, user_id: &UserId, if_updated_since: Option<TimestampMillis>) -> Option<&ChatMetricsInternal> {
        self.per_user_metrics
            .get(user_id)
            .filter(|m| if let Some(since) = if_updated_since { m.last_active > since } else { true })
    }

    pub fn event_count_since<F: Fn(&ChatEventInternal) -> bool>(&self, since: TimestampMillis, filter: F) -> usize {
        self.main.event_count_since(since, &filter)
            + self
                .threads
                .values()
                .map(|e| e.event_count_since(since, &filter))
                .sum::<usize>()
    }

    pub fn is_accessible(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> bool {
        if let Some(events_list) = self.events_reader(min_visible_event_index, thread_root_message_index, None) {
            events_list.is_accessible(event_key, min_visible_event_index)
        } else {
            false
        }
    }

    pub fn message_ids(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(EventIndex, MessageIndex, MessageId)> {
        self.message_internal(EventIndex::default(), thread_root_message_index, event_key)
            .map(|(m, e)| (e, m.message_index, m.message_id))
    }

    pub fn message_already_finalised(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        is_v2_bot: bool,
    ) -> bool {
        if let Some((message, _)) = self.message_internal(EventIndex::default(), thread_root_message_index, message_id.into()) {
            !is_v2_bot || message.bot_context.is_none_or(|b| b.finalised)
        } else {
            false
        }
    }

    pub fn freeze(&mut self, user_id: UserId, reason: Option<String>, now: TimestampMillis) -> PushEventResult {
        let push_event_result = self.push_event(
            None,
            ChatEventInternal::ChatFrozen(Box::new(GroupFrozen {
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
            ChatEventInternal::ChatUnfrozen(Box::new(GroupUnfrozen { unfrozen_by: user_id })),
            0,
            now,
        )
    }

    pub fn mark_members_added_to_public_channel(&mut self, mut user_ids: Vec<UserId>, now: TimestampMillis) {
        if user_ids.is_empty() {
            return;
        }

        if let Some(last_event_index) = self.latest_event_index() {
            if self
                .update_event(None, last_event_index.into(), EventIndex::default(), Some(now), |event| {
                    // If the last event is of type `MembersAddedToPublicChannel` then add this user_id to that
                    // event and mark the event as updated, else push a new event
                    if let ChatEventInternal::MembersAddedToPublicChannel(m) = &mut event.event {
                        m.user_ids.extend(mem::take(&mut user_ids));
                        event.timestamp = now;
                        Ok(())
                    } else {
                        Err(UpdateEventError::NoChange(()))
                    }
                })
                .is_ok()
            {
                return;
            };
        }

        self.push_main_event(
            ChatEventInternal::MembersAddedToPublicChannel(Box::new(MembersAddedToPublicChannelInternal { user_ids })),
            0,
            now,
        );
    }

    pub fn next_event_expiry(&self) -> Option<TimestampMillis> {
        self.expiring_events.next_event_expiry()
    }

    pub fn remove_expired_events(&mut self, now: TimestampMillis) -> RemoveExpiredEventsResult {
        let mut result = RemoveExpiredEventsResult::default();

        while let Some(event_index) = self.expiring_events.take_next_expired_event(now) {
            if let Some(event) = self.main.remove(event_index) {
                result.events.push(event_index);
                if let ChatEventInternal::Message(m) = event.event {
                    if let Some(thread) = m.thread_summary {
                        self.threads.remove(&m.message_index);
                        result.threads.push(ExpiredThread {
                            root_message_index: m.message_index,
                            followers: thread.followers,
                        });
                    }
                    result.files.extend(m.content.blob_references());
                    if let MessageContentInternal::Prize(mut p) = m.content {
                        result
                            .final_prize_payments
                            .append(&mut p.final_payments(m.sender, now * 1_000_000));
                    }
                }
            }
        }

        result
    }

    pub fn main_events_reader(&self) -> ChatEventsListReader {
        ChatEventsListReader::new(&self.main, &self.last_updated_timestamps)
    }

    pub fn visible_main_events_reader(&self, min_visible_event_index: EventIndex) -> ChatEventsListReader {
        ChatEventsListReader::with_min_visible_event_index(
            &self.main,
            &self.last_updated_timestamps,
            min_visible_event_index,
            None,
        )
    }

    pub fn events_reader(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        bot_permitted_event_types: Option<HashSet<ChatEventType>>,
    ) -> Option<ChatEventsListReader> {
        let events_list = self.events_list(min_visible_event_index, thread_root_message_index)?;

        if thread_root_message_index.is_some() {
            Some(ChatEventsListReader::new(events_list, &self.last_updated_timestamps))
        } else {
            Some(ChatEventsListReader::with_min_visible_event_index(
                events_list,
                &self.last_updated_timestamps,
                min_visible_event_index,
                bot_permitted_event_types,
            ))
        }
    }

    pub fn latest_event_index(&self) -> Option<EventIndex> {
        self.main.latest_event_index()
    }

    pub fn latest_event_timestamp(&self) -> Option<TimestampMillis> {
        self.main.latest_event_timestamp()
    }

    pub fn convert_to_message_ranges(&self, event_ranges: &[(EventIndex, EventIndex)]) -> Vec<(MessageIndex, MessageIndex)> {
        self.main.convert_to_message_ranges(event_ranges)
    }

    pub fn main_events_list(&self) -> &ChatEventsList {
        &self.main
    }

    pub fn end_video_call<R: Runtime + Send + 'static>(
        &mut self,
        event_key: EventKey,
        now: TimestampMillis,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> EndVideoCallResult {
        let chat = self.chat;
        let anonymized_id = self.anonymized_id.clone();

        match self.update_message(None, event_key, EventIndex::default(), Some(now), |message, event| {
            Self::end_video_call_inner(message, event.timestamp, now, chat, anonymized_id, event_store_client)
        }) {
            Ok(..) => {
                self.video_call_in_progress = Timestamped::new(None, now);
                EndVideoCallResult::Success
            }
            Err(UpdateEventError::NoChange(_)) => EndVideoCallResult::AlreadyEnded,
            Err(UpdateEventError::NotFound) => EndVideoCallResult::MessageNotFound,
        }
    }

    fn end_video_call_inner<R: Runtime + Send + 'static>(
        message: &mut MessageInternal,
        message_timestamp: TimestampMillis,
        now: TimestampMillis,
        chat: Chat,
        anonymized_id: String,
        event_store_client: Option<&mut EventStoreClient<R>>,
    ) -> Result<(), UpdateEventError> {
        let MessageContentInternal::VideoCall(video_call) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if video_call.ended.is_none() {
            let mut participants = 0;
            let mut hidden = 0;
            for p in video_call.participants.values() {
                if matches!(p.presence, VideoCallPresence::Hidden) {
                    hidden += 1;
                } else {
                    participants += 1;
                }
            }
            if let Some(client) = event_store_client {
                client.push(
                    EventBuilder::new("video_call_ended", now)
                        .with_source(chat.canister_id().to_string(), true)
                        .with_json_payload(&VideoCallEndedEventPayload {
                            chat_type: ChatType::from(&chat).to_string(),
                            chat_id: anonymized_id,
                            participants,
                            hidden,
                            duration_secs: (now.saturating_sub(message_timestamp) / 1000) as u32,
                        })
                        .build(),
                );
            }
            video_call.ended = Some(now);
            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn set_video_call_presence(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        presence: VideoCallPresence,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> SetVideoCallPresenceResult {
        match self.update_message(None, message_id.into(), min_visible_event_index, Some(now), |message, _| {
            Self::set_video_presence_inner(message, user_id, presence, now)
        }) {
            Ok(_) => SetVideoCallPresenceResult::Success,
            Err(UpdateEventError::NoChange(_)) => SetVideoCallPresenceResult::AlreadyEnded,
            Err(UpdateEventError::NotFound) => SetVideoCallPresenceResult::MessageNotFound,
        }
    }

    fn set_video_presence_inner(
        message: &mut MessageInternal,
        user_id: UserId,
        presence: VideoCallPresence,
        now: TimestampMillis,
    ) -> Result<(), UpdateEventError> {
        let MessageContentInternal::VideoCall(video_call) = &mut message.content else {
            return Err(UpdateEventError::NotFound);
        };

        if video_call.ended.is_none() {
            video_call
                .participants
                .entry(user_id)
                .and_modify(|e| {
                    e.last_updated = Some(now);
                    e.presence = presence.clone();
                })
                .or_insert(CallParticipantInternal {
                    joined: now,
                    last_updated: None,
                    presence,
                });

            Ok(())
        } else {
            Err(UpdateEventError::NoChange(()))
        }
    }

    pub fn video_call_in_progress(&self) -> &Timestamped<Option<VideoCall>> {
        &self.video_call_in_progress
    }

    pub fn video_call_participants(
        &self,
        message_id: MessageId,
        updated_since: TimestampMillis,
        min_visible_event_index: EventIndex,
    ) -> Option<VideoCallParticipants> {
        let (message, _) = self.message_internal(min_visible_event_index, None, message_id.into())?;

        if let MessageContentInternal::VideoCall(vc) = &message.content {
            let mut participants = Vec::new();
            let mut hidden = Vec::new();
            let mut last_updated = 0;
            for (u, p) in vc.participants.iter() {
                let participant_last_updated = p.last_updated.unwrap_or(p.joined);
                if participant_last_updated < updated_since {
                    continue;
                }

                let participant = CallParticipant {
                    user_id: *u,
                    joined: p.joined,
                };
                if matches!(p.presence, VideoCallPresence::Hidden) {
                    hidden.push(participant);
                } else {
                    participants.push(participant);
                }
                if participant_last_updated > last_updated {
                    last_updated = participant_last_updated;
                }
            }
            Some(VideoCallParticipants {
                participants,
                hidden,
                last_updated,
            })
        } else {
            None
        }
    }

    fn events_list(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
    ) -> Option<&ChatEventsList> {
        if let Some(root_message_index) = thread_root_message_index {
            if self.main.is_accessible(root_message_index.into(), min_visible_event_index) {
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
    ) -> Option<&mut ChatEventsList> {
        if let Some(root_message_index) = thread_root_message_index {
            if self.main.is_accessible(root_message_index.into(), min_visible_event_index) {
                self.threads.get_mut(&root_message_index)
            } else {
                None
            }
        } else {
            Some(&mut self.main)
        }
    }

    pub fn event_wrapper_internal(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<EventWrapperInternal<ChatEventInternal>> {
        self.events_list(min_visible_event_index, thread_root_message_index)
            .and_then(|l| l.get_event(event_key, min_visible_event_index, None))
    }

    pub fn message_internal(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(MessageInternal, EventIndex)> {
        self.event_wrapper_internal(min_visible_event_index, thread_root_message_index, event_key)
            .and_then(|e| e.event.into_message().map(|m| (m, e.index)))
    }

    fn expiry_date(&self, event: &ChatEventInternal, is_thread_event: bool, now: TimestampMillis) -> Option<TimestampMillis> {
        if let Some(ttl) = self.events_ttl.value {
            if is_thread_event
                || matches!(
                    event,
                    ChatEventInternal::DirectChatCreated(_)
                        | ChatEventInternal::GroupChatCreated(_)
                        | ChatEventInternal::GroupNameChanged(_)
                        | ChatEventInternal::GroupDescriptionChanged(_)
                        | ChatEventInternal::GroupRulesChanged(_)
                        | ChatEventInternal::AvatarChanged(_)
                        | ChatEventInternal::GroupVisibilityChanged(_)
                        | ChatEventInternal::GroupGateUpdated(_)
                        | ChatEventInternal::ChatFrozen(_)
                        | ChatEventInternal::ChatUnfrozen(_)
                        | ChatEventInternal::EventsTimeToLiveUpdated(_)
                )
            {
                None
            } else {
                Some(now + ttl)
            }
        } else {
            None
        }
    }

    fn update_event<F: FnOnce(&mut EventWrapperInternal<ChatEventInternal>) -> Result<T, UpdateEventError<E>>, T, E>(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        now_if_should_mark_updated: Option<TimestampMillis>,
        update_event_fn: F,
    ) -> Result<T, UpdateEventError<E>> {
        let Some(event_list) = self.events_list_mut(min_visible_event_index, thread_root_message_index) else {
            return Err(UpdateEventError::NotFound);
        };

        let result = event_list.update_event(event_key, update_event_fn);

        if let Some(now) = now_if_should_mark_updated {
            if let Ok((_, event_index)) = &result {
                self.last_updated_timestamps
                    .mark_updated(thread_root_message_index, *event_index, now);
            }
        }

        result.map(|(r, _)| r)
    }

    fn update_message<F: FnOnce(&mut MessageInternal, EventMetaData) -> Result<T, UpdateEventError<E>>, T, E>(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
        min_visible_event_index: EventIndex,
        now_if_should_mark_updated: Option<TimestampMillis>,
        update_message_fn: F,
    ) -> Result<T, UpdateEventError<E>> {
        self.update_event(
            thread_root_message_index,
            event_key,
            min_visible_event_index,
            now_if_should_mark_updated,
            |event| Self::update_message_inner(event, update_message_fn),
        )
    }

    fn update_message_inner<F: FnOnce(&mut MessageInternal, EventMetaData) -> Result<T, UpdateEventError<E>>, T, E>(
        event: &mut EventWrapperInternal<ChatEventInternal>,
        update_message_fn: F,
    ) -> Result<T, UpdateEventError<E>> {
        if let ChatEventInternal::Message(m) = &mut event.event {
            update_message_fn(
                m.deref_mut(),
                EventMetaData {
                    index: event.index,
                    timestamp: event.timestamp,
                    expires_at: event.expires_at,
                },
            )
        } else {
            Err(UpdateEventError::NotFound)
        }
    }

    pub fn latest_event_update_removed(&self) -> TimestampMillis {
        self.last_updated_timestamps.latest_update_removed()
    }
}

fn add_to_metrics<F: FnMut(&mut ChatMetricsInternal)>(
    metrics: &mut ChatMetricsInternal,
    per_user_metrics: &mut BTreeMap<UserId, ChatMetricsInternal>,
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

pub struct PushMessageArgs {
    pub sender: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub bot_context: Option<BotMessageContext>,
    pub mentioned: Vec<UserId>,
    pub replies_to: Option<ReplyContextInternal>,
    pub forwarded: bool,
    pub sender_is_bot: bool,
    pub block_level_markdown: bool,
    pub correlation_id: u64,
    pub now: TimestampMillis,
}

pub struct EditMessageArgs {
    pub sender: UserId,
    pub min_visible_event_index: EventIndex,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInternal,
    pub block_level_markdown: Option<bool>,
    pub finalise_bot_message: bool,
    pub now: TimestampMillis,
}

pub enum EditMessageResult {
    Success(MessageIndex, EventMetaData),
    NotAuthorized,
    NotFound,
}

pub enum DeleteMessageResult {
    Success(UserId), // UserId is the message sender
    AlreadyDeleted,
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
    Success(PollVotes, UserId),
    SuccessNoChange(PollVotes),
    PollEnded,
    PollNotFound,
    OptionIndexOutOfRange,
    UserCannotChangeVote,
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
    Success(UserId),
    NoChange,
    MessageNotFound,
}

#[derive(Clone)]
pub struct TipMessageArgs {
    pub user_id: UserId,
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub amount: u128,
    pub now: TimestampMillis,
}

pub enum TipMessageResult {
    Success,
    MessageNotFound,
    CannotTipSelf,
    RecipientMismatch,
}

pub enum ReservePrizeResult {
    Success(ReservePriceSuccess),
    MessageNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
    LedgerError,
}

pub struct ReservePriceSuccess {
    pub token: Cryptocurrency,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
    pub fee: u128,
    pub message_index: MessageIndex,
}

#[allow(clippy::large_enum_variant)]
pub enum ClaimPrizeResult {
    Success,
    MessageNotFound,
    ReservationNotFound,
}

pub enum UnreservePrizeResult {
    Success,
    MessageNotFound,
    ReservationNotFound,
}

pub enum FollowThreadResult {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
}

pub enum UnfollowThreadResult {
    Success,
    NotFollowing,
    ThreadNotFound,
}

#[derive(Default)]
pub struct RemoveExpiredEventsResult {
    pub events: Vec<EventIndex>,
    pub threads: Vec<ExpiredThread>,
    pub files: Vec<BlobReference>,
    pub final_prize_payments: Vec<PendingCryptoTransaction>,
}

pub struct ExpiredThread {
    pub root_message_index: MessageIndex,
    pub followers: HashSet<UserId>,
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

pub enum SetVideoCallPresenceResult {
    Success,
    MessageNotFound,
    AlreadyEnded,
}

pub enum EndVideoCallResult {
    Success,
    MessageNotFound,
    AlreadyEnded,
}
