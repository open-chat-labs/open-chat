use crate::expiring_events::ExpiringEvents;
use crate::last_updated_timestamps::LastUpdatedTimestamps;
use crate::*;
use candid::Principal;
use event_sink_client::{EventBuilder, EventSinkClient, Runtime};
use ic_ledger_types::Tokens;
use itertools::Itertools;
use rand::rngs::StdRng;
use rand::Rng;
use search::{Document, Query};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::cmp::{max, Reverse};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{
    AcceptP2PSwapResult, CallParticipant, CancelP2PSwapResult, CanisterId, Chat, CompleteP2PSwapResult,
    CompletedCryptoTransaction, Cryptocurrency, DirectChatCreated, EventIndex, EventWrapper, EventWrapperInternal,
    EventsTimeToLiveUpdated, GroupCanisterThreadDetails, GroupCreated, GroupFrozen, GroupUnfrozen, Hash, HydratedMention,
    Mention, Message, MessageContentInitial, MessageEventPayload, MessageId, MessageIndex, MessageMatch, MessageReport,
    MessageTippedEventPayload, Milliseconds, MultiUserChat, P2PSwapAccepted, P2PSwapCompletedEventPayload, P2PSwapContent,
    P2PSwapStatus, PendingCryptoTransaction, PollVotes, ProposalUpdate, PushEventResult, Reaction, RegisterVoteResult,
    ReserveP2PSwapResult, ReserveP2PSwapSuccess, TimestampMillis, TimestampNanos, Timestamped, Tips, UserId, VideoCall,
    VoteOperation,
};

pub const OPENCHAT_BOT_USER_ID: UserId = UserId::new(Principal::from_slice(&[228, 104, 142, 9, 133, 211, 135, 217, 129, 1]));

#[derive(Serialize, Deserialize)]
pub struct ChatEvents {
    chat: Chat,
    main: ChatEventsList,
    threads: HashMap<MessageIndex, ChatEventsList>,
    metrics: ChatMetricsInternal,
    per_user_metrics: HashMap<UserId, ChatMetricsInternal>,
    frozen: bool,
    events_ttl: Timestamped<Option<Milliseconds>>,
    expiring_events: ExpiringEvents,
    last_updated_timestamps: LastUpdatedTimestamps,
    pub video_call_in_progress: Timestamped<Option<VideoCall>>,
    anonymized_id: String,
}

impl ChatEvents {
    pub fn new_direct_chat(
        them: UserId,
        events_ttl: Option<Milliseconds>,
        anonymized_id: u128,
        now: TimestampMillis,
    ) -> ChatEvents {
        let mut events = ChatEvents {
            chat: Chat::Direct(them.into()),
            main: ChatEventsList::default(),
            threads: HashMap::new(),
            metrics: ChatMetricsInternal::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
            last_updated_timestamps: LastUpdatedTimestamps::default(),
            video_call_in_progress: Timestamped::default(),
            anonymized_id: hex::encode(anonymized_id.to_be_bytes()),
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
        let mut events = ChatEvents {
            chat: chat.into(),
            main: ChatEventsList::default(),
            threads: HashMap::new(),
            metrics: ChatMetricsInternal::default(),
            per_user_metrics: HashMap::new(),
            frozen: false,
            events_ttl: Timestamped::new(events_ttl, now),
            expiring_events: ExpiringEvents::default(),
            last_updated_timestamps: LastUpdatedTimestamps::default(),
            video_call_in_progress: Timestamped::default(),
            anonymized_id: hex::encode(anonymized_id.to_be_bytes()),
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
    }

    pub fn iter_recently_updated_events(
        &self,
    ) -> impl Iterator<Item = (Option<MessageIndex>, EventIndex, TimestampMillis)> + '_ {
        self.last_updated_timestamps.iter()
    }

    pub fn iter_all_events(&self) -> impl Iterator<Item = (&EventWrapperInternal<ChatEventInternal>, bool)> {
        self.main
            .iter(None, true, EventIndex::default())
            .map(|e| (e, false))
            .chain(
                self.threads
                    .values()
                    .flat_map(|t| t.iter(None, true, EventIndex::default()))
                    .map(|e| (e, true)),
            )
            .filter_map(|(e, t)| if let EventOrExpiredRangeInternal::Event(ev) = e { Some((ev, t)) } else { None })
    }

    pub fn push_message<R: Runtime + Send + 'static>(
        &mut self,
        args: PushMessageArgs,
        event_sink_client: Option<&mut EventSinkClient<R>>,
    ) -> EventWrapper<Message> {
        let events_list = if let Some(root_message_index) = args.thread_root_message_index {
            self.threads.entry(root_message_index).or_default()
        } else {
            &mut self.main
        };

        let is_video_call = matches!(args.content, MessageContentInternal::VideoCall(_));

        if let Some(client) = event_sink_client {
            let event_payload = MessageEventPayload {
                message_type: args.content.message_type(),
                chat_type: self.chat.chat_type().to_string(),
                chat_id: self.anonymized_id.clone(),
                thread: args.thread_root_message_index.is_some(),
                sender_is_bot: args.sender_is_bot,
                content_specific_payload: args.content.event_payload(),
            };
            let sender_name = if let Some(name) = args.sender_name_override {
                name
            } else if args.sender == OPENCHAT_BOT_USER_ID {
                "OpenChatBot".to_string()
            } else {
                args.sender.to_string()
            };

            client.push(
                EventBuilder::new("message_sent", args.now)
                    .with_user(sender_name)
                    .with_source(self.chat.canister_id().to_string())
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
            replies_to: args.replies_to,
            reactions: Vec::new(),
            tips: Tips::default(),
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
                |t| {
                    t.mark_message_added(args.sender, &args.mentioned, push_event_result.index, args.now);
                    true
                },
                EventIndex::default(),
                true,
                args.now,
            );
        }

        if is_video_call {
            if let Some(vc) = &self.video_call_in_progress.value {
                self.end_video_call(vc.message_index.into(), args.now);
            }

            self.video_call_in_progress = Timestamped::new(Some(VideoCall { message_index }), args.now);
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
        ) {
            if message.sender == args.sender {
                if !matches!(message.content, MessageContentInternal::Deleted(_)) {
                    let existing_text = message.content.text();
                    let new_text = args.content.text();

                    if new_text != existing_text {
                        let edited = new_text.map(|t| t.replace("#LINK_REMOVED", ""))
                            != existing_text.map(|t| t.replace("#LINK_REMOVED", ""));

                        message.content = args.content.into();
                        message.last_updated = Some(args.now);

                        if edited {
                            message.last_edited = Some(args.now);
                            add_to_metrics(
                                &mut self.metrics,
                                &mut self.per_user_metrics,
                                args.sender,
                                |m| incr(&mut m.edits),
                                args.now,
                            );
                        }

                        self.last_updated_timestamps
                            .mark_updated(args.thread_root_message_index, event_index, args.now);
                    }

                    return EditMessageResult::Success;
                }
            } else {
                return EditMessageResult::NotAuthorized;
            }
        }

        EditMessageResult::NotFound
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
        if let Some((message, event_index)) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
        ) {
            if message.sender == args.caller || args.is_admin {
                if message.deleted_by.is_some() || matches!(message.content, MessageContentInternal::Deleted(_)) {
                    DeleteMessageResult::AlreadyDeleted
                } else {
                    let sender = message.sender;
                    message.last_updated = Some(args.now);
                    message.deleted_by = Some(DeletedByInternal {
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

    // The UserId returned is the message sender
    pub fn remove_deleted_message_content(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> Option<(MessageContentInternal, UserId)> {
        let (message, _) = self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())?;

        let deleted_by = message.deleted_by.clone()?;

        let content = std::mem::replace(&mut message.content, MessageContentInternal::Deleted(deleted_by));

        Some((content, message.sender))
    }

    pub fn register_poll_vote(&mut self, args: RegisterPollVoteArgs) -> RegisterPollVoteResult {
        if let Some((message, event_index)) = self.message_internal_mut(
            args.min_visible_event_index,
            args.thread_root_message_index,
            args.message_index.into(),
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
                    RegisterVoteResult::UserCannotChangeVote => RegisterPollVoteResult::UserCannotChangeVote,
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
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_index.into())
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

    pub fn prize_refund(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        message_index: MessageIndex,
        memo: &[u8],
        now_nanos: TimestampNanos,
    ) -> Option<PendingCryptoTransaction> {
        if let Some((message, _)) =
            self.message_internal(EventIndex::default(), thread_root_message_index, message_index.into())
        {
            if let MessageContentInternal::Prize(p) = &message.content {
                return p.prize_refund(message.sender, memo, now_nanos);
            }
        }

        None
    }

    pub fn record_proposal_vote(
        &mut self,
        user_id: UserId,
        min_visible_event_index: EventIndex,
        message_index: MessageIndex,
        adopt: bool,
    ) -> RecordProposalVoteResult {
        if let Some(proposal) = self
            .message_internal_mut(min_visible_event_index, None, message_index.into())
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

    pub fn update_proposals(&mut self, user_id: UserId, updates: Vec<ProposalUpdate>, now: TimestampMillis) {
        for update in updates {
            if let Some((message, event_index)) =
                self.message_internal_mut(EventIndex::default(), None, update.message_id.into())
            {
                if message.sender == user_id {
                    if let MessageContentInternal::GovernanceProposal(p) = &mut message.content {
                        p.proposal.update_status(update.into(), now);
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

    pub fn tip_message<R: Runtime + Send + 'static>(
        &mut self,
        args: TipMessageArgs,
        min_visible_event_index: EventIndex,
        event_sink_client: Option<&mut EventSinkClient<R>>,
    ) -> TipMessageResult {
        use TipMessageResult::*;

        if let Some((message, event_index)) = self.message_internal_mut(
            min_visible_event_index,
            args.thread_root_message_index,
            args.message_id.into(),
        ) {
            if message.sender == args.user_id {
                return CannotTipSelf;
            }
            if message.sender != args.recipient {
                return RecipientMismatch;
            }

            message.tips.push(args.ledger, args.user_id, args.amount);
            message.last_updated = Some(args.now);

            if let Some(client) = event_sink_client {
                let message_type = message.content.message_type();

                client.push(
                    EventBuilder::new("message_tipped", args.now)
                        .with_user(args.user_id.to_string())
                        .with_source(self.chat.canister_id().to_string())
                        .with_json_payload(&MessageTippedEventPayload {
                            message_type,
                            chat_type: self.chat.chat_type().to_string(),
                            chat_id: self.anonymized_id.clone(),
                            thread: args.thread_root_message_index.is_some(),
                            token: args.token.token_symbol().to_string(),
                            amount: args.amount,
                        })
                        .build(),
                );
            }

            add_to_metrics(
                &mut self.metrics,
                &mut self.per_user_metrics,
                args.user_id,
                |m| incr(&mut m.tips),
                args.now,
            );

            self.last_updated_timestamps
                .mark_updated(args.thread_root_message_index, event_index, args.now);

            Success
        } else {
            MessageNotFound
        }
    }

    pub fn reserve_prize(
        &mut self,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        user_id: UserId,
        now: TimestampMillis,
    ) -> ReservePrizeResult {
        if let Some((message, event_index)) = self.message_internal_mut(min_visible_event_index, None, message_id.into()) {
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
                let ledger_canister_id = content.transaction.ledger_canister_id();
                let fee = content.transaction.fee();

                content.reservations.insert(user_id);
                message.last_updated = Some(now);
                self.last_updated_timestamps.mark_updated(None, event_index, now);

                return ReservePrizeResult::Success(token, ledger_canister_id, amount.e8s() as u128, fee);
            }
        }

        ReservePrizeResult::MessageNotFound
    }

    pub fn claim_prize<R: Runtime + Send + 'static>(
        &mut self,
        message_id: MessageId,
        winner: UserId,
        transaction: CompletedCryptoTransaction,
        rng: &mut StdRng,
        event_sink_client: &mut EventSinkClient<R>,
        now: TimestampMillis,
    ) -> ClaimPrizeResult {
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into()) {
            if let MessageContentInternal::Prize(content) = &mut message.content {
                // Remove the reservation
                return if content.reservations.remove(&winner) {
                    // Add the user to winners list
                    content.winners.insert(winner);
                    message.last_updated = Some(now);
                    let message_index = message.message_index;
                    self.last_updated_timestamps.mark_updated(None, event_index, now);

                    // Push a PrizeWinnerContent message to the group from the OpenChatBot
                    self.push_message(
                        PushMessageArgs {
                            sender: OPENCHAT_BOT_USER_ID,
                            thread_root_message_index: Some(message_index),
                            message_id: rng.gen(),
                            content: MessageContentInternal::PrizeWinner(PrizeWinnerContentInternal {
                                winner,
                                transaction,
                                prize_message: message_index,
                            }),
                            mentioned: Vec::new(),
                            replies_to: None,
                            forwarded: false,
                            sender_is_bot: true,
                            sender_name_override: None,
                            correlation_id: 0,
                            now,
                        },
                        Some(event_sink_client),
                    );

                    ClaimPrizeResult::Success
                } else {
                    ClaimPrizeResult::ReservationNotFound
                };
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
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into()) {
            if let MessageContentInternal::Prize(content) = &mut message.content {
                // Remove the reservation
                return if content.reservations.remove(&user_id) {
                    // Put the prize back
                    content.prizes_remaining.push(amount);
                    message.last_updated = Some(now);
                    self.last_updated_timestamps.mark_updated(None, event_index, now);

                    UnreservePrizeResult::Success
                } else {
                    UnreservePrizeResult::ReservationNotFound
                };
            }
        }

        UnreservePrizeResult::MessageNotFound
    }

    pub fn pending_prize_messages(&self, date_cutoff: TimestampMillis) -> Vec<(MessageId, PrizeContentInternal)> {
        self.main
            .iter(None, false, EventIndex::default())
            .filter_map(|e| e.as_event())
            .take_while(|e| e.timestamp > date_cutoff)
            .filter_map(|e| e.event.as_message())
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
        if let Some(prize_content) = self
            .main
            .get_event_mut(message_id.into(), EventIndex::default())
            .and_then(|e| e.event.as_message_mut())
            .and_then(|m| if let MessageContentInternal::Prize(p) = &mut m.content { Some(p) } else { None })
        {
            if !prize_content.prizes_remaining.is_empty() {
                let last = prize_content.prizes_remaining.remove(0);
                prize_content.prizes_remaining.insert(
                    0,
                    Tokens::from_e8s(last.e8s().saturating_sub(prize_content.transaction.fee() as u64)),
                );
                return true;
            }
        }
        false
    }

    pub fn get_p2p_swap(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
    ) -> Option<&P2PSwapContent> {
        self.message_internal(min_visible_event_index, thread_root_message_index, message_id.into())
            .and_then(|(m, _)| if let MessageContentInternal::P2PSwap(p) = &m.content { Some(p) } else { None })
    }

    pub fn reserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> ReserveP2PSwapResult {
        if let Some(event) = self
            .events_list_mut(min_visible_event_index, thread_root_message_index)
            .and_then(|l| l.get_event_mut(message_id.into(), min_visible_event_index))
        {
            if let Some(message) = event.event.as_message_mut() {
                if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                    return if content.reserve(user_id, now) {
                        ReserveP2PSwapResult::Success(ReserveP2PSwapSuccess {
                            content: content.clone(),
                            created: event.timestamp,
                            created_by: message.sender,
                        })
                    } else {
                        ReserveP2PSwapResult::Failure(content.status.clone())
                    };
                }
            }
        }
        ReserveP2PSwapResult::SwapNotFound
    }

    pub fn accept_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        token1_txn_in: u64,
        now: TimestampMillis,
    ) -> AcceptP2PSwapResult {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                return if content.accept(user_id, token1_txn_in) {
                    self.last_updated_timestamps
                        .mark_updated(thread_root_message_index, event_index, now);
                    AcceptP2PSwapResult::Success(P2PSwapAccepted {
                        accepted_by: user_id,
                        token1_txn_in,
                    })
                } else {
                    AcceptP2PSwapResult::Failure(content.status.clone())
                };
            }
        }
        AcceptP2PSwapResult::SwapNotFound
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
        event_sink_client: &mut EventSinkClient<R>,
    ) -> CompleteP2PSwapResult {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                return if let Some(status) = content.complete(user_id, token0_txn_out, token1_txn_out) {
                    let payload = P2PSwapCompletedEventPayload {
                        token0: content.token0.token.token_symbol().to_string(),
                        token0_amount: content.token0_amount,
                        token1: content.token1.token.token_symbol().to_string(),
                        token1_amount: content.token1_amount,
                        chat_type: self.chat.chat_type().to_string(),
                        chat_id: self.anonymized_id.clone(),
                    };

                    event_sink_client.push(
                        EventBuilder::new("p2p_swap_completed", now)
                            .with_user(user_id.to_string())
                            .with_source(self.chat.canister_id().to_string())
                            .with_json_payload(&payload)
                            .build(),
                    );

                    self.last_updated_timestamps
                        .mark_updated(thread_root_message_index, event_index, now);

                    CompleteP2PSwapResult::Success(status)
                } else {
                    CompleteP2PSwapResult::Failure(content.status.clone())
                };
            }
        }
        CompleteP2PSwapResult::SwapNotFound
    }

    pub fn unreserve_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                if content.unreserve(user_id) {
                    self.last_updated_timestamps
                        .mark_updated(thread_root_message_index, event_index, now);
                };
            }
        }
    }

    pub fn cancel_p2p_swap(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) -> CancelP2PSwapResult {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if message.sender == user_id {
                if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                    return if content.cancel() {
                        let swap_id = content.swap_id;
                        self.last_updated_timestamps
                            .mark_updated(thread_root_message_index, event_index, now);
                        CancelP2PSwapResult::Success(swap_id)
                    } else {
                        CancelP2PSwapResult::Failure(content.status.clone())
                    };
                }
            }
        }
        CancelP2PSwapResult::SwapNotFound
    }

    pub fn mark_p2p_swap_expired(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        now: TimestampMillis,
    ) {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                if content.mark_expired() {
                    self.last_updated_timestamps
                        .mark_updated(thread_root_message_index, event_index, now);
                };
            }
        }
    }

    pub fn set_p2p_swap_status(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        status: P2PSwapStatus,
        now: TimestampMillis,
    ) {
        if let Some((message, event_index)) =
            self.message_internal_mut(EventIndex::default(), thread_root_message_index, message_id.into())
        {
            if let MessageContentInternal::P2PSwap(content) = &mut message.content {
                content.status = status;
                self.last_updated_timestamps
                    .mark_updated(thread_root_message_index, event_index, now);
            }
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
        event_sink_client: &mut EventSinkClient<R>,
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
                let channel_id_bytes = channel_id.to_be_bytes();
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

        if let Some((message, index)) = self.message_internal_mut(EventIndex::default(), None, message_id.into()) {
            if let MessageContentInternal::ReportedMessage(r) = &mut message.content {
                r.reports.retain(|x| x.reported_by != user_id);
                r.reports.push(MessageReport {
                    reported_by: user_id,
                    timestamp: now,
                    reason_code,
                    notes,
                });
                self.last_updated_timestamps.mark_updated(None, index, now);
            }
        } else {
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
                    mentioned: Vec::new(),
                    replies_to: Some(ReplyContextInternal {
                        chat_if_other: Some((chat.into(), thread_root_message_index)),
                        event_index,
                    }),
                    forwarded: false,
                    sender_is_bot: true,
                    sender_name_override: None,
                    correlation_id: 0,
                    now,
                },
                Some(event_sink_client),
            );
        }
    }

    // Used when a group is imported into a community
    pub fn migrate_replies(&mut self, old: ChatInternal, new: ChatInternal, now: TimestampMillis) {
        for (thread_root_message_index, events_list) in [(None, &mut self.main)]
            .into_iter()
            .chain(self.threads.iter_mut().map(|(t, e)| (Some(*t), e)))
        {
            for event_index in events_list.migrate_replies(old, new) {
                self.last_updated_timestamps
                    .mark_updated(thread_root_message_index, event_index, now);
            }
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
            |t| t.set_follow(user_id, now, true),
            min_visible_event_index,
            false,
            now,
        ) {
            Some(true) => Success,
            Some(false) => AlreadyFollowing,
            None => ThreadNotFound,
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
            |t| t.set_follow(user_id, now, false),
            min_visible_event_index,
            false,
            now,
        ) {
            Some(true) => Success,
            Some(false) => NotFollowing,
            None => ThreadNotFound,
        }
    }

    fn update_thread_summary<F: FnOnce(&mut ThreadSummaryInternal) -> bool>(
        &mut self,
        thread_root_message_index: MessageIndex,
        update_fn: F,
        min_visible_event_index: EventIndex,
        create_if_not_exists: bool,
        now: TimestampMillis,
    ) -> Option<bool> {
        let (root_message, event_index) =
            self.message_internal_mut(min_visible_event_index, None, thread_root_message_index.into())?;

        let summary = if create_if_not_exists {
            root_message.thread_summary.get_or_insert(ThreadSummaryInternal::default())
        } else {
            root_message.thread_summary.as_mut()?
        };

        if update_fn(summary) {
            root_message.last_updated = Some(now);
            self.last_updated_timestamps.mark_updated(None, event_index, now);
            Some(true)
        } else {
            Some(false)
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
        now: TimestampMillis,
        min_visible_event_index: EventIndex,
        query: &Query,
        max_results: u8,
        my_user_id: UserId,
    ) -> Vec<MessageMatch> {
        self.visible_main_events_reader(min_visible_event_index)
            .iter(None, true)
            .filter_map(|e| e.as_event())
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
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, message_index.into()) {
            if let MessageContentInternal::MessageReminderCreated(r) = &mut message.content {
                r.hidden = true;
                message.last_updated = Some(now);
                self.last_updated_timestamps.mark_updated(None, event_index, now);
                return true;
            }
        }
        false
    }

    pub fn hydrate_mention(&self, min_visible_event_index: EventIndex, mention: &Mention) -> Option<HydratedMention> {
        let events_reader = self.events_reader(min_visible_event_index, mention.thread_root_message_index)?;
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
        if let Some(events_list) = self.events_reader(min_visible_event_index, thread_root_message_index) {
            events_list.is_accessible(event_key, min_visible_event_index)
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
        my_user_id: UserId,
    ) -> Vec<GroupCanisterThreadDetails> {
        root_message_indexes
            .filter_map(|root_message_index| {
                self.threads.get(root_message_index).and_then(|thread_events| {
                    let mut last_updated = thread_events.latest_event_timestamp()?;
                    let latest_event = thread_events.latest_event_index()?;
                    let follower = self
                        .main
                        .get_event((*root_message_index).into(), min_visible_event_index)?
                        .event
                        .as_message()?
                        .thread_summary
                        .as_ref()?
                        .get_follower(my_user_id);

                    if let Some(follower) = follower {
                        if follower.value {
                            last_updated = last_updated.max(follower.timestamp);
                        }
                    }

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

    pub fn unfollowed_threads_since<'a>(
        &self,
        root_message_indexes: impl DoubleEndedIterator<Item = &'a MessageIndex>,
        updated_since: TimestampMillis,
        my_user_id: UserId,
    ) -> Vec<MessageIndex> {
        let mut unfollowed = Vec::new();

        for message_index in root_message_indexes.rev().copied() {
            if let Some(wrapped_event) = self.main.get_event(message_index.into(), EventIndex::default()) {
                if let Some(message) = wrapped_event.event.as_message() {
                    if let Some(thread_summary) = message.thread_summary.as_ref() {
                        if let Some(follower) = thread_summary.get_follower(my_user_id) {
                            if follower.timestamp <= updated_since {
                                break;
                            }

                            if !follower.value {
                                unfollowed.push(message_index);
                            }
                        }
                    }
                }
            }
        }

        unfollowed
    }

    pub fn message_ids(
        &self,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(EventIndex, MessageIndex, MessageId)> {
        self.message_internal(EventIndex::default(), thread_root_message_index, event_key)
            .map(|(m, e)| (e, m.message_index, m.message_id))
    }

    pub fn contains_message_id(&self, thread_root_message_index: Option<MessageIndex>, message_id: MessageId) -> bool {
        self.events_list(EventIndex::default(), thread_root_message_index)
            .map(|e| e.contains_message_id(message_id))
            .unwrap_or_default()
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

    pub fn mark_member_added_to_public_channel(&mut self, user_id: UserId, now: TimestampMillis) {
        // If the last event is of type `MembersAddedToPublicChannel` then add this user_id to that
        // event and mark the event as updated, else push a new event
        if let Some(e) = self.main.last_mut() {
            if let ChatEventInternal::MembersAddedToPublicChannel(m) = &mut e.event {
                m.user_ids.push(user_id);
                e.timestamp = now;
                self.last_updated_timestamps.mark_updated(None, e.index, now);
                return;
            }
        }

        self.push_main_event(
            ChatEventInternal::MembersAddedToPublicChannel(Box::new(MembersAddedToPublicChannelInternal {
                user_ids: vec![user_id],
            })),
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
                        result
                            .threads
                            .push((m.message_index, thread.participants_and_followers(true)));
                    }
                }
            }
        }

        result
    }

    pub fn main_events_reader(&self) -> ChatEventsListReader {
        ChatEventsListReader::new(&self.main)
    }

    pub fn visible_main_events_reader(&self, min_visible_event_index: EventIndex) -> ChatEventsListReader {
        ChatEventsListReader::with_min_visible_event_index(&self.main, min_visible_event_index)
    }

    pub fn events_reader(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
    ) -> Option<ChatEventsListReader> {
        let events_list = self.events_list(min_visible_event_index, thread_root_message_index)?;

        if thread_root_message_index.is_some() {
            Some(ChatEventsListReader::new(events_list))
        } else {
            Some(ChatEventsListReader::with_min_visible_event_index(
                events_list,
                min_visible_event_index,
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

    pub fn end_video_call(&mut self, event_key: EventKey, now: TimestampMillis) -> EndVideoCallResult {
        if let Some((message, event_index)) = self.message_internal_mut(EventIndex::default(), None, event_key) {
            if let MessageContentInternal::VideoCall(video_call) = &mut message.content {
                return if video_call.ended.is_none() {
                    video_call.ended = Some(now);
                    message.last_updated = Some(now);
                    self.video_call_in_progress = Timestamped::new(None, now);
                    self.last_updated_timestamps.mark_updated(None, event_index, now);
                    EndVideoCallResult::Success
                } else {
                    EndVideoCallResult::AlreadyEnded
                };
            }
        }

        EndVideoCallResult::MessageNotFound
    }

    pub fn join_video_call(
        &mut self,
        user_id: UserId,
        message_id: MessageId,
        min_visible_event_index: EventIndex,
        now: TimestampMillis,
    ) -> JoinVideoCallResult {
        if let Some((message, event_index)) = self.message_internal_mut(min_visible_event_index, None, message_id.into()) {
            if let MessageContentInternal::VideoCall(video_call) = &mut message.content {
                return if video_call.ended.is_none() {
                    if video_call.participants.iter().any(|p| p.user_id == user_id) {
                        JoinVideoCallResult::AlreadyJoined
                    } else {
                        video_call.participants.push(CallParticipant { user_id, joined: now });
                        message.last_updated = Some(now);
                        self.last_updated_timestamps.mark_updated(None, event_index, now);

                        JoinVideoCallResult::Success
                    }
                } else {
                    JoinVideoCallResult::AlreadyEnded
                };
            }
        }

        JoinVideoCallResult::MessageNotFound
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

    fn message_internal_mut(
        &mut self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(&mut MessageInternal, EventIndex)> {
        self.events_list_mut(min_visible_event_index, thread_root_message_index)
            .and_then(|l| l.get_event_mut(event_key, min_visible_event_index))
            .and_then(|e| e.event.as_message_mut().map(|m| (m, e.index)))
    }

    fn message_internal(
        &self,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
        event_key: EventKey,
    ) -> Option<(&MessageInternal, EventIndex)> {
        self.events_list(min_visible_event_index, thread_root_message_index)
            .and_then(|l| l.get_event(event_key, min_visible_event_index))
            .and_then(|e| e.event.as_message().map(|m| (m, e.index)))
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
}

fn add_to_metrics<F: FnMut(&mut ChatMetricsInternal)>(
    metrics: &mut ChatMetricsInternal,
    per_user_metrics: &mut HashMap<UserId, ChatMetricsInternal>,
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
    pub mentioned: Vec<UserId>,
    pub replies_to: Option<ReplyContextInternal>,
    pub forwarded: bool,
    pub sender_is_bot: bool,
    pub sender_name_override: Option<String>,
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
    Success,
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
    Success(Cryptocurrency, CanisterId, u128, u128),
    MessageNotFound,
    AlreadyClaimed,
    PrizeFullyClaimed,
    PrizeEnded,
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
    pub threads: Vec<(MessageIndex, Vec<UserId>)>,
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

pub enum JoinVideoCallResult {
    Success,
    MessageNotFound,
    AlreadyJoined,
    AlreadyEnded,
}

pub enum EndVideoCallResult {
    Success,
    MessageNotFound,
    AlreadyEnded,
}
