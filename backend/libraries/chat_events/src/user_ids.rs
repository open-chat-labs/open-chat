use crate::{ChatEventInternal, ChatInternal, MessageContentInternal, MessageInternal, PollContentInternal};
use candid::Principal;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use types::{BotCommand, BotCommandArgValue, Chat, ChatId, ModerationReportStatus, P2PSwapStatus, SenderContext, UserId};

// How a user is mentioned in text, eg. `@UserId(rrkah-fqaaa-aaaaa-aaaaq-cai)`
pub(crate) const MENTION_PREFIX: &str = "@UserId(";

impl ChatEventInternal {
    // Passes every user id in the event through `f`, replacing each with the id returned, and
    // returns whether any were replaced. Used to move the ids users had before being migrated to a
    // MultiUser canister onto their latest ids. Where that leaves a user listed twice, only one
    // entry is kept (see `UserIdUpdater`).
    pub fn update_user_ids(&mut self, f: &mut dyn FnMut(UserId) -> UserId) -> bool {
        let mut updater = UserIdUpdater::new(f);
        let u = &mut updater;
        match self {
            ChatEventInternal::Message(m) => m.update_user_ids(u),
            ChatEventInternal::GroupChatCreated(e) => u.id(&mut e.created_by),
            ChatEventInternal::GroupNameChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::GroupDescriptionChanged(e) => {
                u.id(&mut e.changed_by);
                u.mentions(&mut e.new_description);
                u.mentions(&mut e.previous_description);
            }
            ChatEventInternal::GroupRulesChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::AvatarChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::ParticipantsAdded(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.added_by);
                u.vec(&mut e.unblocked);
            }
            ChatEventInternal::ParticipantsRemoved(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.removed_by);
            }
            ChatEventInternal::ParticipantJoined(e) => {
                u.id(&mut e.user_id);
                if let Some(invited_by) = &mut e.invited_by {
                    u.id(invited_by);
                }
            }
            ChatEventInternal::ParticipantLeft(e) => u.id(&mut e.user_id),
            ChatEventInternal::RoleChanged(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.changed_by);
            }
            ChatEventInternal::UsersBlocked(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.blocked_by);
            }
            ChatEventInternal::UsersUnblocked(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.unblocked_by);
            }
            ChatEventInternal::MessagePinned(e) => u.id(&mut e.pinned_by),
            ChatEventInternal::MessageUnpinned(e) => u.id(&mut e.unpinned_by),
            ChatEventInternal::PermissionsChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::GroupVisibilityChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::GroupInviteCodeChanged(e) => u.id(&mut e.changed_by),
            ChatEventInternal::ChatFrozen(e) => u.id(&mut e.frozen_by),
            ChatEventInternal::ChatUnfrozen(e) => u.id(&mut e.unfrozen_by),
            ChatEventInternal::EventsTimeToLiveUpdated(e) => u.id(&mut e.updated_by),
            ChatEventInternal::GroupGateUpdated(e) => u.id(&mut e.updated_by),
            ChatEventInternal::UsersInvited(e) => {
                u.vec(&mut e.user_ids);
                u.id(&mut e.invited_by);
            }
            ChatEventInternal::ExternalUrlUpdated(e) => u.id(&mut e.updated_by),
            ChatEventInternal::BotAdded(e) => {
                u.id(&mut e.user_id);
                u.id(&mut e.added_by);
            }
            ChatEventInternal::BotRemoved(e) => {
                u.id(&mut e.user_id);
                u.id(&mut e.removed_by);
            }
            ChatEventInternal::BotUpdated(e) => {
                u.id(&mut e.user_id);
                u.id(&mut e.updated_by);
            }
            ChatEventInternal::HistoryDeleted(e) => u.id(&mut e.deleted_by),
            ChatEventInternal::DirectChatCreated(_)
            | ChatEventInternal::MembersAddedToPublicChannel(_)
            | ChatEventInternal::Empty
            | ChatEventInternal::FailedToDeserialize => {}
        }
        updater.changed()
    }
}

impl MessageInternal {
    fn update_user_ids(&mut self, u: &mut UserIdUpdater) {
        let sender = self.sender;
        u.id(&mut self.sender);
        if let MessageContentInternal::Prize(p) = &mut self.content
            && self.sender != sender
            && p.principal == Principal::anonymous()
            && sender.is_canister()
        {
            // A prize sent before its sender's principal was recorded is refunded to the wallet of
            // the canister it was sent from, whose id was the sender's id. Now that the sender has
            // a new id, which doesn't give that wallet, the canister is recorded as the principal.
            p.principal = sender.as_principal();
        }
        self.content.update_user_ids(u);
        if let Some(SenderContext::Bot(context)) = &mut self.sender_context
            && let Some(command) = &mut context.command
        {
            u.bot_command(command);
        }
        for (_, users) in self.reactions.iter_mut() {
            u.set(users);
        }
        for (_, tips) in self.tips.iter_mut() {
            u.tips(tips);
        }
        if let Some(deleted_by) = &mut self.deleted_by {
            u.id(&mut deleted_by.deleted_by);
        }
        if let Some(thread_summary) = &mut self.thread_summary {
            u.vec(&mut thread_summary.participants);
            u.set(&mut thread_summary.followers);
        }
        if let Some(replies_to) = &mut self.replies_to
            && let Some((ChatInternal::Direct(chat_id), _)) = &mut replies_to.chat_if_other
        {
            u.chat_id(chat_id);
        }
    }
}

impl MessageContentInternal {
    fn update_user_ids(&mut self, u: &mut UserIdUpdater) {
        match self {
            MessageContentInternal::Text(t) => u.mentions(&mut t.text),
            MessageContentInternal::Image(i) => u.optional_mentions(&mut i.caption),
            MessageContentInternal::Video(v) => u.optional_mentions(&mut v.caption),
            MessageContentInternal::Audio(a) => u.optional_mentions(&mut a.caption),
            MessageContentInternal::File(f) => u.optional_mentions(&mut f.caption),
            MessageContentInternal::Giphy(g) => u.optional_mentions(&mut g.caption),
            MessageContentInternal::MessageReminderCreated(r) => u.optional_mentions(&mut r.notes),
            MessageContentInternal::MessageReminder(r) => u.optional_mentions(&mut r.notes),
            MessageContentInternal::Poll(p) => {
                p.update_user_ids(u);
                u.optional_mentions(&mut p.config.text);
                for option in p.config.options.iter_mut() {
                    u.mentions(option);
                }
            }
            MessageContentInternal::Crypto(c) => {
                u.id(&mut c.recipient);
                u.optional_mentions(&mut c.caption);
            }
            MessageContentInternal::Deleted(d) => u.id(&mut d.deleted_by),
            MessageContentInternal::GovernanceProposal(p) => u.keys(&mut p.votes),
            MessageContentInternal::Prize(p) => {
                u.set(&mut p.reservations);
                u.set(&mut p.winners);
                u.optional_mentions(&mut p.caption);
            }
            MessageContentInternal::PrizeWinner(p) => u.id(&mut p.winner),
            MessageContentInternal::ReportedMessage(r) => {
                for report in r.reports.iter_mut() {
                    u.id(&mut report.reported_by);
                }
            }
            MessageContentInternal::ModerationReport(r) => {
                u.id(&mut r.sender);
                u.vec(&mut r.reporters);
                if let Chat::Direct(chat_id) = &mut r.chat_id {
                    u.chat_id(chat_id);
                }
                u.optional_mentions(&mut r.content_excerpt);
                if let ModerationReportStatus::Upheld(resolution)
                | ModerationReportStatus::UpheldAsCsam(resolution)
                | ModerationReportStatus::Dismissed(resolution) = &mut r.status
                {
                    u.id(&mut resolution.moderator);
                }
            }
            MessageContentInternal::P2PSwap(s) => {
                match &mut s.status {
                    P2PSwapStatus::Reserved(r) => u.id(&mut r.reserved_by),
                    P2PSwapStatus::Accepted(a) => u.id(&mut a.accepted_by),
                    P2PSwapStatus::Completed(c) => u.id(&mut c.accepted_by),
                    P2PSwapStatus::Open | P2PSwapStatus::Cancelled(_) | P2PSwapStatus::Expired(_) => {}
                }
                u.optional_mentions(&mut s.caption);
            }
            MessageContentInternal::VideoCall(v) => u.keys(&mut v.participants),
            MessageContentInternal::Encrypted(_) | MessageContentInternal::Custom(_) => {}
        }
    }
}

impl PollContentInternal {
    // Where only one vote per user is allowed and a user has votes under more than one of their
    // ids, the same vote is kept as `change_voter_ids` would keep: the one under their latest id if
    // there is one, and otherwise the one under the lowest option index
    fn update_user_ids(&mut self, u: &mut UserIdUpdater) {
        let single_vote = !self.config.allow_multiple_votes_per_user;
        let mut has_vote: HashSet<UserId> =
            if single_vote { self.votes.values().flatten().copied().collect() } else { HashSet::new() };

        let mut option_indexes: Vec<_> = self.votes.keys().copied().collect();
        option_indexes.sort();
        for option_index in option_indexes {
            let votes = self.votes.get_mut(&option_index).unwrap();
            let mut updated = Vec::with_capacity(votes.len());
            for &user_id in votes.iter() {
                let new_user_id = (u.f)(user_id);
                if new_user_id == user_id {
                    updated.push(user_id);
                } else {
                    u.changed = true;
                    if !single_vote || has_vote.insert(new_user_id) {
                        updated.push(new_user_id);
                    }
                }
            }
            let mut seen = HashSet::new();
            updated.retain(|u| seen.insert(*u));
            *votes = updated;
        }
    }
}

// Replaces each user id with the id returned by `f`, recording whether any were replaced. Where a
// user ends up listed twice, the first entry is kept, other than in a map, where an entry already
// under the user's new id is kept.
pub struct UserIdUpdater<'a> {
    f: &'a mut dyn FnMut(UserId) -> UserId,
    changed: bool,
}

impl<'a> UserIdUpdater<'a> {
    pub fn new(f: &'a mut dyn FnMut(UserId) -> UserId) -> Self {
        UserIdUpdater { f, changed: false }
    }

    pub fn changed(&self) -> bool {
        self.changed
    }

    pub fn id(&mut self, user_id: &mut UserId) {
        let new_user_id = (self.f)(*user_id);
        if new_user_id != *user_id {
            *user_id = new_user_id;
            self.changed = true;
        }
    }

    pub fn vec(&mut self, user_ids: &mut Vec<UserId>) {
        let mut changed = false;
        for user_id in user_ids.iter_mut() {
            let new_user_id = (self.f)(*user_id);
            if new_user_id != *user_id {
                *user_id = new_user_id;
                changed = true;
            }
        }
        if changed {
            let mut seen = HashSet::new();
            user_ids.retain(|u| seen.insert(*u));
            self.changed = true;
        }
    }

    pub fn set(&mut self, user_ids: &mut BTreeSet<UserId>) {
        let mut changed = false;
        let updated: BTreeSet<_> = user_ids
            .iter()
            .map(|&user_id| {
                let new_user_id = (self.f)(user_id);
                changed |= new_user_id != user_id;
                new_user_id
            })
            .collect();
        if changed {
            *user_ids = updated;
            self.changed = true;
        }
    }

    pub fn keys<V>(&mut self, map: &mut BTreeMap<UserId, V>) {
        let moved: Vec<_> = map
            .keys()
            .filter_map(|&user_id| {
                let new_user_id = (self.f)(user_id);
                (new_user_id != user_id).then_some((user_id, new_user_id))
            })
            .collect();
        if moved.is_empty() {
            return;
        }
        // Every entry is taken out before any is put back, in case one is moved onto the id of
        // another being moved
        let values: Vec<_> = moved
            .into_iter()
            .filter_map(|(user_id, new_user_id)| map.remove(&user_id).map(|v| (new_user_id, v)))
            .collect();
        for (new_user_id, value) in values {
            map.entry(new_user_id).or_insert(value);
        }
        self.changed = true;
    }

    // Both the users and the users they map to, eg. who each user was referred by
    pub fn user_map(&mut self, map: &mut HashMap<UserId, UserId>) {
        let mut changed = false;
        let entries: Vec<_> = map
            .iter()
            .map(|(&key, &value)| {
                let (new_key, new_value) = ((self.f)(key), (self.f)(value));
                changed |= new_key != key || new_value != value;
                (key, new_key, new_value)
            })
            .collect();
        if changed {
            // An entry already under the user's new id is kept over one moved onto it
            let mut updated: HashMap<_, _> = entries
                .iter()
                .filter(|(key, new_key, _)| key == new_key)
                .map(|(_, new_key, new_value)| (*new_key, *new_value))
                .collect();
            for (key, new_key, new_value) in entries {
                if key != new_key {
                    updated.entry(new_key).or_insert(new_value);
                }
            }
            *map = updated;
            self.changed = true;
        }
    }

    // The id of a direct chat, which is the other user's id
    pub fn chat_id(&mut self, chat_id: &mut ChatId) {
        let mut user_id = UserId::from(*chat_id);
        self.id(&mut user_id);
        *chat_id = user_id.into();
    }

    // The users mentioned in the text, eg. `@UserId(rrkah-fqaaa-aaaaa-aaaaq-cai)`
    pub fn mentions(&mut self, text: &mut String) {
        if !text.contains(MENTION_PREFIX) {
            return;
        }
        let mut updated = String::with_capacity(text.len());
        let mut rest = text.as_str();
        let mut changed = false;
        while let Some(index) = rest.find(MENTION_PREFIX) {
            let start = index + MENTION_PREFIX.len();
            updated.push_str(&rest[..start]);
            rest = &rest[start..];
            if let Some(len) = rest.find(')')
                && let Ok(principal) = Principal::from_text(&rest[..len])
            {
                let user_id = UserId::from(principal);
                let new_user_id = (self.f)(user_id);
                if new_user_id != user_id {
                    updated.push_str(&new_user_id.to_string());
                    rest = &rest[len..];
                    changed = true;
                }
            }
        }
        if changed {
            updated.push_str(rest);
            *text = updated;
            self.changed = true;
        }
    }

    pub fn optional_mentions(&mut self, text: &mut Option<String>) {
        if let Some(text) = text {
            self.mentions(text);
        }
    }

    pub fn bot_command(&mut self, command: &mut BotCommand) {
        self.id(&mut command.initiator);
        for arg in command.args.iter_mut() {
            if let BotCommandArgValue::User(user_id) = &mut arg.value {
                self.id(user_id);
            }
        }
    }

    // The amounts tipped by a user under more than one of their ids are added together
    fn tips(&mut self, tips: &mut Vec<(UserId, u128)>) {
        let mut changed = false;
        for (user_id, _) in tips.iter_mut() {
            let new_user_id = (self.f)(*user_id);
            if new_user_id != *user_id {
                *user_id = new_user_id;
                changed = true;
            }
        }
        if changed {
            let mut merged: Vec<(UserId, u128)> = Vec::with_capacity(tips.len());
            for (user_id, amount) in tips.drain(..) {
                if let Some((_, total)) = merged.iter_mut().find(|(u, _)| *u == user_id) {
                    *total += amount;
                } else {
                    merged.push((user_id, amount));
                }
            }
            *tips = merged;
            self.changed = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DeletedByInternal, PollConfigInternal, ProposalContentInternal, TextContentInternal, ThreadSummaryInternal};
    use std::collections::HashMap;
    use types::{
        BotCommand, BotCommandArg, BotMessageContext, GroupDescriptionChanged, ModerationReportContent,
        ModerationReportResolution, NnsProposal, Proposal, ProposalDecisionStatus, ProposalRewardStatus, Reaction, Tally, Tips,
        UsersBlocked,
    };

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    // Users 1 and 2 have been migrated to 11 and 12
    fn latest(user_id: UserId) -> UserId {
        match user_id.as_slice() {
            [1] => self::user_id(11),
            [2] => self::user_id(12),
            _ => user_id,
        }
    }

    fn ledger() -> Principal {
        Principal::from_slice(&[100])
    }

    fn message(sender: UserId, content: MessageContentInternal) -> MessageInternal {
        MessageInternal {
            message_index: 1.into(),
            message_id: 1u64.into(),
            sender,
            content,
            sender_context: None,
            replies_to: None,
            reactions: Vec::new(),
            tips: Tips::default(),
            last_edited: None,
            deleted_by: None,
            thread_summary: None,
            forwarded: false,
            block_level_markdown: false,
            og_previews: Vec::new(),
            moderation_flags: 0,
        }
    }

    fn text() -> MessageContentInternal {
        MessageContentInternal::Text(TextContentInternal { text: "hi".to_string() })
    }

    fn update(message: MessageInternal) -> (bool, MessageInternal) {
        let mut event = ChatEventInternal::Message(Box::new(message));
        let changed = event.update_user_ids(&mut latest);
        (changed, event.into_message().unwrap())
    }

    #[test]
    fn every_id_in_a_message_is_replaced() {
        let mut message = message(user_id(1), text());
        message.sender_context = Some(SenderContext::Bot(BotMessageContext {
            command: Some(BotCommand {
                name: "command".to_string(),
                args: vec![BotCommandArg {
                    name: "user".to_string(),
                    value: BotCommandArgValue::User(user_id(1)),
                }],
                initiator: user_id(2),
                meta: None,
            }),
            finalised: true,
        }));
        message.reactions = vec![(Reaction("👍".to_string()), BTreeSet::from([user_id(1), user_id(3)]))];
        message.tips = Tips::new(vec![(ledger(), vec![(user_id(2), 5), (user_id(3), 2)])]);
        message.deleted_by = Some(DeletedByInternal {
            deleted_by: user_id(2),
            timestamp: 1,
        });
        message.thread_summary = Some(ThreadSummaryInternal {
            participants: vec![user_id(3), user_id(1)],
            followers: BTreeSet::from([user_id(1), user_id(2)]),
            ..Default::default()
        });

        let (changed, message) = update(message);

        assert!(changed);
        assert_eq!(message.sender, user_id(11));
        let Some(SenderContext::Bot(context)) = message.sender_context else {
            panic!();
        };
        let command = context.command.unwrap();
        assert_eq!(command.initiator, user_id(12));
        assert!(matches!(command.args[0].value, BotCommandArgValue::User(u) if u == user_id(11)));
        assert_eq!(message.reactions[0].1, BTreeSet::from([user_id(11), user_id(3)]));
        assert_eq!(*message.tips, vec![(ledger(), vec![(user_id(12), 5), (user_id(3), 2)])]);
        assert_eq!(message.deleted_by.unwrap().deleted_by, user_id(12));
        let thread_summary = message.thread_summary.unwrap();
        assert_eq!(thread_summary.participants, vec![user_id(3), user_id(11)]);
        assert_eq!(thread_summary.followers, BTreeSet::from([user_id(11), user_id(12)]));
    }

    #[test]
    fn entries_for_a_user_under_both_of_their_ids_are_merged() {
        let mut message = message(user_id(3), text());
        message.reactions = vec![(Reaction("👍".to_string()), BTreeSet::from([user_id(1), user_id(11)]))];
        message.tips = Tips::new(vec![(ledger(), vec![(user_id(1), 5), (user_id(3), 1), (user_id(11), 3)])]);
        message.thread_summary = Some(ThreadSummaryInternal {
            participants: vec![user_id(11), user_id(3), user_id(1)],
            ..Default::default()
        });

        let (changed, message) = update(message);

        assert!(changed);
        assert_eq!(message.reactions[0].1, BTreeSet::from([user_id(11)]));
        assert_eq!(*message.tips, vec![(ledger(), vec![(user_id(11), 8), (user_id(3), 1)])]);
        assert_eq!(message.thread_summary.unwrap().participants, vec![user_id(11), user_id(3)]);
    }

    #[test]
    fn a_proposal_vote_under_the_latest_id_stands() {
        let proposal = ProposalContentInternal {
            governance_canister_id: Principal::from_slice(&[101]),
            proposal: Proposal::NNS(NnsProposal {
                id: 1,
                topic: 1,
                proposer: 1,
                created: 1,
                title: "title".to_string(),
                summary: "summary".to_string(),
                url: String::new(),
                status: ProposalDecisionStatus::Open,
                reward_status: ProposalRewardStatus::AcceptVotes,
                tally: Tally {
                    yes: 0,
                    no: 0,
                    total: 0,
                    timestamp: 1,
                },
                deadline: 1000,
                payload_text_rendering: None,
                last_updated: 1,
            }),
            votes: BTreeMap::from([(user_id(1), true), (user_id(11), false), (user_id(2), true)]),
        };

        let (changed, message) = update(message(user_id(3), MessageContentInternal::GovernanceProposal(proposal)));

        assert!(changed);
        let MessageContentInternal::GovernanceProposal(proposal) = message.content else {
            panic!();
        };
        assert_eq!(proposal.votes, BTreeMap::from([(user_id(11), false), (user_id(12), true)]));
    }

    fn poll(allow_multiple_votes_per_user: bool, votes: Vec<(u32, Vec<UserId>)>) -> MessageContentInternal {
        MessageContentInternal::Poll(PollContentInternal {
            config: PollConfigInternal {
                text: None,
                options: vec!["a".to_string(), "b".to_string(), "c".to_string()],
                end_date: None,
                anonymous: false,
                show_votes_before_end_date: true,
                allow_multiple_votes_per_user,
                allow_user_to_change_vote: true,
            },
            votes: votes.into_iter().collect(),
            ended: false,
        })
    }

    fn poll_votes(message: MessageInternal) -> HashMap<u32, Vec<UserId>> {
        let MessageContentInternal::Poll(poll) = message.content else {
            panic!();
        };
        poll.votes
    }

    #[test]
    fn a_poll_keeps_one_vote_per_user_where_only_one_is_allowed() {
        // User 1's vote under their latest id stands, and user 2's vote is moved onto theirs
        let content = poll(
            false,
            vec![
                (0, vec![user_id(1), user_id(3)]),
                (1, vec![user_id(11)]),
                (2, vec![user_id(2)]),
            ],
        );

        let (changed, message) = update(message(user_id(3), content));

        assert!(changed);
        assert_eq!(
            poll_votes(message),
            HashMap::from([(0, vec![user_id(3)]), (1, vec![user_id(11)]), (2, vec![user_id(12)])])
        );
    }

    #[test]
    fn a_poll_keeps_each_users_votes_where_several_are_allowed() {
        let content = poll(true, vec![(0, vec![user_id(1), user_id(11)]), (1, vec![user_id(1)])]);

        let (changed, message) = update(message(user_id(3), content));

        assert!(changed);
        assert_eq!(
            poll_votes(message),
            HashMap::from([(0, vec![user_id(11)]), (1, vec![user_id(11)])])
        );
    }

    #[test]
    fn ids_in_membership_events_are_replaced() {
        let mut event = ChatEventInternal::UsersBlocked(Box::new(UsersBlocked {
            user_ids: vec![user_id(1), user_id(3)],
            blocked_by: user_id(2),
        }));

        assert!(event.update_user_ids(&mut latest));

        let ChatEventInternal::UsersBlocked(e) = event else {
            panic!();
        };
        assert_eq!(e.user_ids, vec![user_id(11), user_id(3)]);
        assert_eq!(e.blocked_by, user_id(12));
    }

    #[test]
    fn ids_in_a_moderation_report_are_replaced() {
        let report = ModerationReportContent {
            report_index: None,
            chat_id: Chat::Direct(user_id(1).into()),
            thread_root_message_index: None,
            message_index: 1.into(),
            message_id: 1u64.into(),
            sender: user_id(1),
            reporters: vec![user_id(2), user_id(3)],
            flagged_categories: 0,
            classification_failed: false,
            auto_sanctioned: false,
            content_excerpt: Some(mention(user_id(2))),
            blob_references: Vec::new(),
            media_matches: Vec::new(),
            is_blocked_attempt: false,
            reported_at: 1,
            status: ModerationReportStatus::Dismissed(ModerationReportResolution {
                moderator: user_id(2),
                timestamp: 1,
            }),
            authority_report: None,
        };

        let (changed, message) = update(message(
            user_id(3),
            MessageContentInternal::ModerationReport(Box::new(report)),
        ));

        assert!(changed);
        let MessageContentInternal::ModerationReport(report) = message.content else {
            panic!();
        };
        assert_eq!(report.sender, user_id(11));
        assert_eq!(report.reporters, vec![user_id(12), user_id(3)]);
        assert!(matches!(report.status, ModerationReportStatus::Dismissed(r) if r.moderator == user_id(12)));
        assert_eq!(report.chat_id, Chat::Direct(user_id(11).into()));
        assert_eq!(report.content_excerpt, Some(mention(user_id(12))));
    }

    #[test]
    fn both_sides_of_a_user_map_are_replaced() {
        // Who each user was referred by, with user 1 listed under both of their ids
        let mut map = HashMap::from([(user_id(1), user_id(4)), (user_id(11), user_id(5)), (user_id(3), user_id(2))]);
        let mut f = latest;
        let mut updater = UserIdUpdater::new(&mut f);

        updater.user_map(&mut map);

        assert!(updater.changed());
        assert_eq!(map, HashMap::from([(user_id(11), user_id(5)), (user_id(3), user_id(12))]));
    }

    fn mention(user_id: UserId) -> String {
        format!("@UserId({user_id})")
    }

    #[test]
    fn mentions_in_text_are_replaced() {
        let original = format!(
            "hi {} and {}, {} isn't migrated, @UserId(not-a-principal) and @UserId({} aren't mentions",
            mention(user_id(1)),
            mention(user_id(2)),
            mention(user_id(3)),
            user_id(1)
        );
        let content = MessageContentInternal::Text(TextContentInternal { text: original });

        let (changed, message) = update(message(user_id(3), content));

        assert!(changed);
        let MessageContentInternal::Text(t) = message.content else {
            panic!();
        };
        assert_eq!(
            t.text,
            format!(
                "hi {} and {}, {} isn't migrated, @UserId(not-a-principal) and @UserId({} aren't mentions",
                mention(user_id(11)),
                mention(user_id(12)),
                mention(user_id(3)),
                user_id(1)
            )
        );
    }

    #[test]
    fn mentions_in_captions_and_polls_are_replaced() {
        let content = MessageContentInternal::Crypto(crate::CryptoContentInternal {
            recipient: user_id(3),
            transfer: crate::CompletedCryptoTransactionInternal::ICRC1(crate::icrc1::CompletedCryptoTransactionInternal {
                ledger: ledger(),
                token_symbol: "CHAT".to_string(),
                amount: 1,
                from: crate::icrc1::CryptoAccountInternal::Mint,
                to: crate::icrc1::CryptoAccountInternal::Mint,
                fee: 0,
                memo: None,
                created: 0,
                block_index: 0,
            }),
            caption: Some(mention(user_id(1))),
        });
        let (_, updated) = update(message(user_id(3), content));
        let MessageContentInternal::Crypto(c) = updated.content else {
            panic!();
        };
        assert_eq!(c.caption, Some(mention(user_id(11))));

        let MessageContentInternal::Poll(mut p) = poll(false, Vec::new()) else {
            panic!();
        };
        p.config.text = Some(mention(user_id(1)));
        p.config.options = vec![mention(user_id(2)), "b".to_string()];
        let (_, updated) = update(message(user_id(3), MessageContentInternal::Poll(p)));
        let MessageContentInternal::Poll(p) = updated.content else {
            panic!();
        };
        assert_eq!(p.config.text, Some(mention(user_id(11))));
        assert_eq!(p.config.options, vec![mention(user_id(12)), "b".to_string()]);
    }

    #[test]
    fn mentions_in_a_group_description_are_replaced() {
        let mut event = ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
            new_description: mention(user_id(1)),
            previous_description: mention(user_id(2)),
            changed_by: user_id(3),
        }));

        assert!(event.update_user_ids(&mut latest));

        let ChatEventInternal::GroupDescriptionChanged(e) = event else {
            panic!();
        };
        assert_eq!(e.new_description, mention(user_id(11)));
        assert_eq!(e.previous_description, mention(user_id(12)));
    }

    #[test]
    fn a_direct_chat_replied_to_is_replaced() {
        let mut message = message(user_id(3), text());
        message.replies_to = Some(crate::ReplyContextInternal {
            chat_if_other: Some((ChatInternal::Direct(user_id(1).into()), None)),
            event_index: 1.into(),
        });

        let (changed, message) = update(message);

        assert!(changed);
        assert!(matches!(
            message.replies_to.unwrap().chat_if_other,
            Some((ChatInternal::Direct(chat_id), None)) if chat_id == user_id(11).into()
        ));
    }

    #[test]
    fn every_id_is_passed_through_even_if_none_are_replaced() {
        let mut message = message(
            user_id(3),
            MessageContentInternal::Text(TextContentInternal {
                text: mention(user_id(6)),
            }),
        );
        message.reactions = vec![(Reaction("👍".to_string()), BTreeSet::from([user_id(4)]))];
        message.tips = Tips::new(vec![(ledger(), vec![(user_id(5), 1)])]);
        let mut event = ChatEventInternal::Message(Box::new(message));

        let mut seen = Vec::new();
        let changed = event.update_user_ids(&mut |user_id| {
            seen.push(user_id);
            user_id
        });

        assert!(!changed);
        assert_eq!(seen, vec![user_id(3), user_id(6), user_id(4), user_id(5)]);
    }
}
