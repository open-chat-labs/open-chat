use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use translations_canister::{
    proposed::{CandidateTranslation, Record},
    reject::RejectReason,
};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Translations {
    translations: Vec<Translation>,
    records: HashMap<(String, String), Vec<usize>>,
}

impl Translations {
    pub fn propose(&mut self, args: ProposeArgs) -> Option<u64> {
        let tuple = (args.locale.clone(), args.key.clone());

        // Loop backwards through translations until we reach the most recently deployed.
        // If any of these translations matches the proposed value, including the deployed transaction,
        // then don't add the translation.
        for translation in self.record_iter(&tuple).rev() {
            if translation.value == args.value {
                return None;
            }

            if matches!(translation.status, TranslationStatus::Deployed(_)) {
                break;
            }
        }

        // If this user has a previous proposed translation for this record then mark it as `overidden`
        if let Some(indexes) = self.records.get(&tuple) {
            for index in indexes.iter().rev() {
                if let Some(translation) = self.translations.get_mut(*index)
                    && translation.proposed.who == args.user_id
                    && matches!(translation.status, TranslationStatus::Proposed)
                {
                    translation.status = TranslationStatus::Overidden;
                    break;
                }
            }
        }

        let new_index = self.translations.len();

        self.records.entry(tuple.clone()).or_default().push(new_index);

        self.translations.push(Translation {
            id: new_index as u64,
            locale: args.locale,
            key: args.key,
            value: args.value,
            proposed: Attribution {
                who: args.user_id,
                when: args.when,
            },
            status: TranslationStatus::Proposed,
        });

        Some(new_index as u64)
    }

    // Who proposed the translation
    pub fn proposed_by(&self, id: u64) -> Option<UserId> {
        self.translations.get(id as usize).map(|t| t.proposed.who)
    }

    pub fn approve(&mut self, id: u64, user_id: UserId, now: TimestampMillis) -> ApproveResponse {
        let Some(translation) = self.translations.get(id as usize) else {
            return ApproveResponse::NotFound;
        };

        if !matches!(translation.status, TranslationStatus::Proposed) {
            return ApproveResponse::NotProposed;
        }

        let proposed_by = translation.proposed.who;
        let tuple = (translation.locale.clone(), translation.key.clone());

        let previously_approved = self
            .record_iter(&tuple)
            .any(|t| t.id != id && t.proposed.who == proposed_by && matches!(t.status, TranslationStatus::Approved(_)));

        let attribution = Attribution { who: user_id, when: now };

        self.translations.get_mut(id as usize).unwrap().status = TranslationStatus::Approved(ApprovedStatus {
            attribution,
            previously_approved,
        });

        ApproveResponse::Success(ApproveSuccess { previously_approved })
    }

    pub fn reject(&mut self, id: u64, reason: RejectReason, user_id: UserId, now: TimestampMillis) -> RejectResponse {
        if let Some(translation) = self.translations.get_mut(id as usize) {
            if !matches!(translation.status, TranslationStatus::Proposed) {
                RejectResponse::NotProposed
            } else {
                let attribution = Attribution { who: user_id, when: now };
                translation.status = TranslationStatus::Rejected(RejectedStatus { attribution, reason });
                RejectResponse::Success
            }
        } else {
            RejectResponse::NotFound
        }
    }

    pub fn mark_deployed(&mut self, latest_approval: TimestampMillis, now: TimestampMillis) {
        for indexes in self.records.values() {
            if let Some(t) = self.find_most_recent_approved_or_deployed(indexes)
                && let TranslationStatus::Approved(approved) = &t.status
                && approved.attribution.when <= latest_approval
            {
                let index = t.id as usize;
                let approved = approved.clone();
                if let Some(translation) = self.translations.get_mut(index) {
                    translation.status = TranslationStatus::Deployed(DeployedStatus { approved, deployed: now })
                }
            }
        }
    }

    pub fn proposed(&self) -> Vec<Record> {
        self.records
            .iter()
            .filter_map(|((locale, key), indexes)| {
                let mut deployment_count: u32 = 0;
                let mut candidates: Vec<CandidateTranslation> = Vec::new();

                for index in indexes {
                    if let Some(translation) = self.translations.get(*index) {
                        match translation.status {
                            TranslationStatus::Proposed => candidates.push(CandidateTranslation {
                                id: *index as u64,
                                value: translation.value.clone(),
                                proposed_by: translation.proposed.who,
                                proposed_at: translation.proposed.when,
                            }),
                            TranslationStatus::Deployed(_) => deployment_count += 1,
                            _ => (),
                        }
                    }
                }

                if candidates.is_empty() {
                    None
                } else {
                    Some(Record {
                        locale: locale.clone(),
                        key: key.clone(),
                        candidates,
                        deployment_count,
                    })
                }
            })
            .collect()
    }

    pub fn pending_deployment(&self) -> Vec<&Translation> {
        self.records
            .values()
            .filter_map(|indexes| match self.find_most_recent_approved_or_deployed(indexes) {
                Some(t) if matches!(t.status, TranslationStatus::Approved(_)) => Some(t),
                _ => None,
            })
            .collect()
    }

    pub fn collate_decision_summaries(&self, since: TimestampMillis) -> HashMap<UserId, DecisionSummary> {
        self.translations
            .iter()
            .filter(|t| match &t.status {
                TranslationStatus::Approved(s) => s.attribution.when > since,
                TranslationStatus::Rejected(s) => s.attribution.when > since,
                TranslationStatus::Deployed(s) => s.deployed > since,
                _ => false,
            })
            .map(|t| (t.proposed.who, t))
            .into_group_map()
            .into_iter()
            .map(|(recipient, group)| (recipient, Translations::collate_decision_summary(group)))
            .collect()
    }

    fn collate_decision_summary(translations: Vec<&Translation>) -> DecisionSummary {
        let mut summary = DecisionSummary::default();

        for transaction in translations {
            match &transaction.status {
                TranslationStatus::Approved(s) => {
                    summary.approved += 1;
                    if !s.previously_approved {
                        summary.newly_approved += 1;
                    }
                }
                TranslationStatus::Rejected(_) => summary.rejected += 1,
                TranslationStatus::Deployed(s) => {
                    summary.deployed += 1;
                    summary.approved += 1;
                    if !s.approved.previously_approved {
                        summary.newly_approved += 1;
                    }
                }
                _ => (),
            }
        }

        summary
    }

    // One-off: the distinct ids, of proposers and of those who decided on translations, which carry no
    // index. Among them are the old ids of users who did so before being migrated to a MultiUser
    // canister, but also ids which are current, eg. legacy ids or those of bots.
    pub fn user_ids_without_index(&self) -> Vec<UserId> {
        self.translations
            .iter()
            .flat_map(|t| [Some(&t.proposed), t.status.attribution()])
            .flatten()
            .map(|a| a.who)
            .filter(|user_id| !user_id.is_indexed())
            .unique()
            .collect()
    }

    // One-off: rewrites each id found in `latest_user_ids` to the id it maps to, which is the latest id
    // of the user it belongs to. Returns the number of ids rewritten.
    pub fn rewrite_user_ids(&mut self, latest_user_ids: &HashMap<UserId, UserId>) -> usize {
        let mut rewritten = 0;
        for translation in self.translations.iter_mut() {
            for attribution in [Some(&mut translation.proposed), translation.status.attribution_mut()]
                .into_iter()
                .flatten()
            {
                if let Some(latest_user_id) = latest_user_ids.get(&attribution.who) {
                    attribution.who = *latest_user_id;
                    rewritten += 1;
                }
            }
        }
        rewritten
    }

    // One-off: a user who proposed a translation of a record under their old id, then another under
    // their latest id, still has the first proposed, since `propose` didn't know the ids were the same
    // user's. Once the ids are rewritten, this overrides each proposal which a later one by the same
    // user supersedes, whatever has since become of the later one, as `propose` would have. Returns the
    // number of proposals overridden.
    pub fn override_superseded_proposals(&mut self) -> usize {
        let mut overridden = 0;
        for indexes in self.records.values() {
            let mut proposers = HashSet::new();
            for index in indexes.iter().rev() {
                if let Some(translation) = self.translations.get_mut(*index)
                    && !proposers.insert(translation.proposed.who)
                    && matches!(translation.status, TranslationStatus::Proposed)
                {
                    translation.status = TranslationStatus::Overidden;
                    overridden += 1;
                }
            }
        }
        overridden
    }

    fn find_most_recent_approved_or_deployed(&self, indexes: &[usize]) -> Option<&Translation> {
        indexes
            .iter()
            .rev()
            .filter_map(|index| self.translations.get(*index))
            .find(|t| matches!(t.status, TranslationStatus::Approved(_)) || matches!(t.status, TranslationStatus::Deployed(_)))
    }

    fn record_iter(&self, tuple_key: &(String, String)) -> impl DoubleEndedIterator<Item = &Translation> + '_ {
        self.records
            .get(tuple_key)
            .map(|indexes| indexes.iter().filter_map(|index| self.translations.get(*index)))
            .into_iter()
            .flatten()
    }
}

#[derive(Clone)]
pub struct ProposeArgs {
    pub locale: String,
    pub key: String,
    pub value: String,
    pub user_id: UserId,
    pub when: TimestampMillis,
}

#[derive(Serialize, Deserialize)]
pub struct Translation {
    pub id: u64,
    pub locale: String,
    pub key: String,
    pub value: String,
    pub proposed: Attribution,
    pub status: TranslationStatus,
}

#[derive(Serialize, Deserialize)]
pub enum TranslationStatus {
    Proposed,
    Overidden,
    Approved(ApprovedStatus),
    Rejected(RejectedStatus),
    Deployed(DeployedStatus),
}

impl TranslationStatus {
    // Who decided on the translation, and when
    fn attribution(&self) -> Option<&Attribution> {
        match self {
            TranslationStatus::Approved(s) => Some(&s.attribution),
            TranslationStatus::Rejected(s) => Some(&s.attribution),
            TranslationStatus::Deployed(s) => Some(&s.approved.attribution),
            TranslationStatus::Proposed | TranslationStatus::Overidden => None,
        }
    }

    fn attribution_mut(&mut self) -> Option<&mut Attribution> {
        match self {
            TranslationStatus::Approved(s) => Some(&mut s.attribution),
            TranslationStatus::Rejected(s) => Some(&mut s.attribution),
            TranslationStatus::Deployed(s) => Some(&mut s.approved.attribution),
            TranslationStatus::Proposed | TranslationStatus::Overidden => None,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ApprovedStatus {
    pub attribution: Attribution,
    pub previously_approved: bool,
}

#[derive(Serialize, Deserialize)]
pub struct RejectedStatus {
    pub attribution: Attribution,
    pub reason: RejectReason,
}

#[derive(Serialize, Deserialize)]
pub struct DeployedStatus {
    pub approved: ApprovedStatus,
    pub deployed: TimestampMillis,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct Attribution {
    pub who: UserId,
    pub when: TimestampMillis,
}

pub enum ApproveResponse {
    Success(ApproveSuccess),
    NotProposed,
    NotFound,
}

pub struct ApproveSuccess {
    pub previously_approved: bool,
}

pub enum RejectResponse {
    Success,
    NotProposed,
    NotFound,
}

#[derive(Default)]
pub struct DecisionSummary {
    pub approved: u32,
    pub rejected: u32,
    pub deployed: u32,
    pub newly_approved: u32,
}

#[cfg(test)]
mod tests {
    use candid::Principal;

    use super::*;

    const USER1: &str = "27eue-hyaaa-aaaaf-aaa4a-cai";
    const USER2: &str = "3skqk-iqaaa-aaaaf-aaa3q-cai";
    const USER3: &str = "2yfsq-kaaaa-aaaaf-aaa4q-cai";

    #[test]
    fn propose_returns_expected_index() {
        let mut translations = Translations::default();
        let result = translations.propose(test_proposal_1());

        assert_eq!(result, Some(0));
    }

    #[test]
    fn propose_identical_translation_returns_already_proposed() {
        let mut translations = Translations::default();
        let args = test_proposal_1();
        translations.propose(args.clone());

        let result = translations.propose(args);
        assert_eq!(result, None);
    }

    #[test]
    fn proposed_returns_expected() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].candidates.len(), 2);
        assert_eq!(results[0].candidates[0].id, 0);
        assert_eq!(results[0].candidates[1].id, 1);
    }

    #[test]
    fn proposed_returns_expected_2() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 3);

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].candidates.len(), 1);
        assert_eq!(results[0].candidates[0].id, 1);
    }

    #[test]
    fn proposed_returns_expected_3() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 3);
        translations.reject(1, RejectReason::IncorrectMeaning, user_id(USER3), 4);

        let results = translations.proposed();

        assert_eq!(results.len(), 0);
    }

    #[test]
    fn same_user_proposes_twice_then_first_overridden() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());

        let mut p2 = test_proposal_2();
        p2.user_id = user_id(USER1);
        translations.propose(p2);

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].candidates.len(), 1);
        assert_eq!(results[0].candidates[0].id, 1);
    }

    #[test]
    fn pending_deployment_has_one_translation() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);

        let results = translations.pending_deployment();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 0);
    }

    #[test]
    fn when_record_has_multiple_approvals_ignore_all_but_most_recent() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);
        translations.approve(1, user_id(USER3), 3);

        let results = translations.pending_deployment();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }

    #[test]
    fn no_approvals_empty_pending_deployment() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.reject(0, RejectReason::IncorrectMeaning, user_id(USER3), 2);

        let results = translations.pending_deployment();

        assert_eq!(results.len(), 0);
    }

    #[test]
    fn after_mark_deployed_empty_pending_deployment() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);
        translations.mark_deployed(2, 3);

        let results = translations.pending_deployment();

        assert_eq!(results.len(), 0);
    }

    #[test]
    fn approvals_after_deploy_not_marked_as_deployed() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);
        translations.approve(1, user_id(USER3), 3);
        translations.mark_deployed(2, 3);

        let results = translations.pending_deployment();

        assert_eq!(results.len(), 1);
    }

    #[test]
    fn after_mark_deployed_expected_proposed() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);
        translations.mark_deployed(0, 3);

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].candidates.len(), 1);
        assert_eq!(results[0].candidates[0].id, 1);
    }

    #[test]
    fn same_user_approved_twice_return_previously_approved() {
        let mut translations = Translations::default();
        let mut args = test_proposal_1();

        translations.propose(args.clone());
        if let ApproveResponse::Success(result) = translations.approve(0, user_id(USER3), 1) {
            assert!(!result.previously_approved);
        } else {
            panic!("ApproveSuccess expected");
        }

        args.value = "abcdef".to_string();
        translations.propose(args);
        if let ApproveResponse::Success(result) = translations.approve(1, user_id(USER3), 3) {
            assert!(result.previously_approved);
        } else {
            panic!("ApproveSuccess expected");
        }
    }

    #[test]
    fn collate_decision_summaries_expected() {
        let mut translations = Translations::default();

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.approve(0, user_id(USER3), 2);
        translations.reject(1, RejectReason::IncorrectMeaning, user_id(USER3), 3);
        translations.mark_deployed(3, 4);

        let results = translations.collate_decision_summaries(0);

        assert_eq!(results.len(), 2);

        let user_id_1 = user_id(USER1);
        let summary_1 = results.get(&user_id_1).unwrap();
        assert_eq!(summary_1.approved, 1);
        assert_eq!(summary_1.rejected, 0);
        assert_eq!(summary_1.deployed, 1);
        assert_eq!(summary_1.newly_approved, 1);

        let user_id_2 = user_id(USER2);
        let summary_2 = results.get(&user_id_2).unwrap();
        assert_eq!(summary_2.approved, 0);
        assert_eq!(summary_2.rejected, 1);
        assert_eq!(summary_2.deployed, 0);
        assert_eq!(summary_2.newly_approved, 0);
    }

    #[test]
    fn user_ids_without_index_are_each_proposer_and_decider_once() {
        let mut translations = Translations::default();
        let indexed1 = indexed_user_id(1);
        let indexed2 = indexed_user_id(2);

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.propose(ProposeArgs {
            user_id: indexed1,
            ..test_proposal_3()
        });
        translations.approve(0, user_id(USER3), 2);
        translations.reject(1, RejectReason::IncorrectMeaning, user_id(USER3), 3);
        translations.approve(2, indexed2, 4);
        translations.mark_deployed(4, 5);

        let mut user_ids = translations.user_ids_without_index();
        user_ids.sort();

        let mut expected = vec![user_id(USER1), user_id(USER2), user_id(USER3)];
        expected.sort();
        assert_eq!(user_ids, expected);
    }

    #[test]
    fn rewrite_user_ids_rewrites_proposers_and_deciders_found_in_the_map() {
        let mut translations = Translations::default();
        let latest1 = indexed_user_id(1);
        let latest3 = indexed_user_id(3);

        translations.propose(test_proposal_1());
        translations.propose(test_proposal_2());
        translations.propose(test_proposal_3());
        translations.propose(ProposeArgs {
            user_id: user_id(USER2),
            value: "jkl".to_string(),
            ..test_proposal_3()
        });
        translations.approve(0, user_id(USER3), 2);
        translations.reject(1, RejectReason::IncorrectMeaning, user_id(USER3), 3);
        translations.mark_deployed(2, 4);
        translations.approve(2, user_id(USER3), 5);

        // USER2 isn't in the map, eg. because theirs is a legacy id or a bot's, so isn't rewritten
        let latest_user_ids = HashMap::from([(user_id(USER1), latest1), (user_id(USER3), latest3)]);
        assert_eq!(translations.rewrite_user_ids(&latest_user_ids), 5);

        assert!(matches!(translations.translations[0].status, TranslationStatus::Deployed(_)));
        assert_eq!(ids(&translations, 0), (latest1, Some(latest3)));
        assert!(matches!(translations.translations[1].status, TranslationStatus::Rejected(_)));
        assert_eq!(ids(&translations, 1), (user_id(USER2), Some(latest3)));
        assert!(matches!(translations.translations[2].status, TranslationStatus::Approved(_)));
        assert_eq!(ids(&translations, 2), (latest1, Some(latest3)));
        assert!(matches!(translations.translations[3].status, TranslationStatus::Proposed));
        assert_eq!(ids(&translations, 3), (user_id(USER2), None));

        // Every id in the map has now been rewritten, so running it again changes nothing
        assert_eq!(translations.rewrite_user_ids(&latest_user_ids), 0);
    }

    #[test]
    fn proposal_under_old_id_is_overridden_by_one_under_latest_id_once_rewritten() {
        let mut translations = Translations::default();
        let latest1 = indexed_user_id(1);

        translations.propose(test_proposal_1());
        translations.rewrite_user_ids(&HashMap::from([(user_id(USER1), latest1)]));
        translations.propose(ProposeArgs {
            user_id: latest1,
            ..test_proposal_2()
        });

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].candidates.len(), 1);
        assert_eq!(results[0].candidates[0].id, 1);
        assert_eq!(results[0].candidates[0].proposed_by, latest1);
    }

    #[test]
    fn approval_under_old_id_is_previous_approval_once_rewritten() {
        let mut translations = Translations::default();
        let latest1 = indexed_user_id(1);

        translations.propose(test_proposal_1());
        translations.approve(0, user_id(USER3), 2);
        translations.rewrite_user_ids(&HashMap::from([(user_id(USER1), latest1)]));
        translations.propose(ProposeArgs {
            user_id: latest1,
            ..test_proposal_2()
        });

        let ApproveResponse::Success(result) = translations.approve(1, user_id(USER3), 3) else {
            panic!("ApproveSuccess expected");
        };
        assert_eq!(translations.proposed_by(1), Some(latest1));
        assert!(result.previously_approved);
    }

    #[test]
    fn proposals_superseded_under_latest_id_are_overridden() {
        let mut translations = Translations::default();
        let latest1 = indexed_user_id(1);

        // USER1 proposes under their old id, then under their latest id before the ids are known to be
        // the same user's, and USER2 proposes after them
        translations.propose(test_proposal_1());
        translations.propose(ProposeArgs {
            user_id: latest1,
            ..test_proposal_2()
        });
        translations.propose(ProposeArgs {
            value: "jkl".to_string(),
            ..test_proposal_2()
        });
        translations.rewrite_user_ids(&HashMap::from([(user_id(USER1), latest1)]));

        assert_eq!(translations.override_superseded_proposals(), 1);

        let results = translations.proposed();

        assert_eq!(results.len(), 1);
        let candidates: Vec<_> = results[0].candidates.iter().map(|c| c.id).collect();
        assert_eq!(candidates, vec![1, 2]);
        assert!(matches!(translations.translations[0].status, TranslationStatus::Overidden));

        // Each user is now left with one proposal of the record, so running it again changes nothing
        assert_eq!(translations.override_superseded_proposals(), 0);
    }

    #[test]
    fn proposal_superseded_under_latest_id_is_overridden_once_the_later_one_is_decided() {
        let mut translations = Translations::default();
        let latest1 = indexed_user_id(1);

        // USER1 proposes under their old id, then under their latest id, and the later proposal is
        // rejected before the ids are known to be the same user's
        translations.propose(test_proposal_1());
        translations.propose(ProposeArgs {
            user_id: latest1,
            ..test_proposal_2()
        });
        translations.reject(1, RejectReason::IncorrectMeaning, user_id(USER3), 3);
        translations.rewrite_user_ids(&HashMap::from([(user_id(USER1), latest1)]));

        assert_eq!(translations.override_superseded_proposals(), 1);

        assert!(matches!(translations.translations[0].status, TranslationStatus::Overidden));
        assert!(translations.proposed().is_empty());
    }

    fn ids(translations: &Translations, id: usize) -> (UserId, Option<UserId>) {
        let translation = &translations.translations[id];
        (translation.proposed.who, translation.status.attribution().map(|a| a.who))
    }

    fn user_id(text: &str) -> UserId {
        Principal::from_text(text).unwrap().into()
    }

    // The latest id of a user who has been migrated to a MultiUser canister
    fn indexed_user_id(index: u16) -> UserId {
        UserId::new_indexed(Principal::from_text(USER1).unwrap(), index)
    }

    fn test_proposal_1() -> ProposeArgs {
        ProposeArgs {
            locale: "en".to_string(),
            key: "abc.def".to_string(),
            value: "xyz".to_string(),
            user_id: user_id(USER1),
            when: 1,
        }
    }

    fn test_proposal_2() -> ProposeArgs {
        ProposeArgs {
            locale: "en".to_string(),
            key: "abc.def".to_string(),
            value: "ghi".to_string(),
            user_id: user_id(USER2),
            when: 2,
        }
    }

    // A proposal of another record
    fn test_proposal_3() -> ProposeArgs {
        ProposeArgs {
            locale: "en".to_string(),
            key: "abc.xyz".to_string(),
            value: "uvw".to_string(),
            user_id: user_id(USER1),
            when: 3,
        }
    }
}
