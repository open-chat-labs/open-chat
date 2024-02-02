use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use translations_canister::proposed::{CandidateTranslation, Record};
use types::{TimestampMillis, UserId};
use user_index_canister::c2c_send_openchat_bot_messages::Message;

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
                if let Some(translation) = self.translations.get_mut(*index) {
                    if translation.proposed.who == args.user_id && matches!(translation.status, TranslationStatus::Proposed) {
                        translation.status = TranslationStatus::Overidden;
                        break;
                    }
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
                when: args.now,
            },
            status: TranslationStatus::Proposed,
        });

        Some(new_index as u64)
    }

    pub fn approve(&mut self, id: u64, user_id: UserId, now: TimestampMillis) -> ApproveResponse {
        let translation = if let Some(translation) = self.translations.get(id as usize) {
            if !matches!(translation.status, TranslationStatus::Proposed) {
                return ApproveResponse::NotProposed;
            } else {
                translation
            }
        } else {
            return ApproveResponse::NotFound;
        };

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

        ApproveResponse::Success(ApproveSuccess {
            proposed_by,
            previously_approved,
        })
    }

    pub fn reject(&mut self, id: u64, user_id: UserId, now: TimestampMillis) -> RejectResponse {
        if let Some(translation) = self.translations.get_mut(id as usize) {
            if !matches!(translation.status, TranslationStatus::Proposed) {
                RejectResponse::NotProposed
            } else {
                let attribution = Attribution { who: user_id, when: now };
                translation.status = TranslationStatus::Rejected(RejectedStatus { attribution });
                RejectResponse::Success
            }
        } else {
            RejectResponse::NotFound
        }
    }

    pub fn mark_deployed(&mut self, latest_approval: TimestampMillis, now: TimestampMillis) {
        for indexes in self.records.values() {
            if let Some(t) = self.find_most_recent_approved_or_deployed(indexes) {
                if let TranslationStatus::Approved(approved) = &t.status {
                    if approved.attribution.when <= latest_approval {
                        let index = t.id as usize;
                        let approved = approved.clone();
                        if let Some(translation) = self.translations.get_mut(index) {
                            translation.status = TranslationStatus::Deployed(DeployedStatus { approved, deployed: now })
                        }
                    }
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

    pub fn build_notifications(&self, since: TimestampMillis) -> Vec<Message> {
        self.translations
            .iter()
            .filter(|t| match &t.status {
                TranslationStatus::Approved(s) => s.attribution.when > since,
                TranslationStatus::Rejected(s) => s.attribution.when > since,
                TranslationStatus::Deployed(s) => s.deployed > since,
                _ => false,
            })
            .group_by(|t| t.proposed.who)
            .into_iter()
            .map(|(recipient, group)| Message {
                recipient,
                text: Translations::build_notification(group.collect()),
            })
            .collect()
    }

    fn build_notification(translations: Vec<&Translation>) -> String {
        let mut approved = 0_u32;
        let mut rejected = 0_u32;
        let mut deployed = 0_u32;
        let mut paid = 0_u32;

        for transaction in translations {
            match &transaction.status {
                TranslationStatus::Approved(s) => {
                    approved += 1;
                    if !s.previously_approved {
                        paid += 1;
                    }
                }
                TranslationStatus::Rejected(_) => rejected += 1,
                TranslationStatus::Deployed(s) => {
                    deployed += 1;
                    approved += 1;
                    if !s.approved.previously_approved {
                        paid += 1;
                    }
                }
                _ => (),
            }
        }

        format!(
            "Round-up of recent translation decisions:
Approved: {approved}
Rejected: {rejected}
Applied: {deployed}
CHAT earned: {paid}"
        )
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
    pub now: TimestampMillis,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct ApprovedStatus {
    pub attribution: Attribution,
    pub previously_approved: bool,
}

#[derive(Serialize, Deserialize)]
pub struct RejectedStatus {
    pub attribution: Attribution,
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
    pub proposed_by: UserId,
    pub previously_approved: bool,
}

pub enum RejectResponse {
    Success,
    NotProposed,
    NotFound,
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
        translations.approve(0, user_id(USER3), 2);

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
        translations.approve(0, user_id(USER3), 2);
        translations.reject(1, user_id(USER3), 3);

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
        translations.reject(0, user_id(USER3), 2);

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

    fn user_id(text: &str) -> UserId {
        Principal::from_text(text).unwrap().into()
    }

    fn test_proposal_1() -> ProposeArgs {
        ProposeArgs {
            locale: "en".to_string(),
            key: "abc.def".to_string(),
            value: "xyz".to_string(),
            user_id: user_id(USER1),
            now: 0,
        }
    }

    fn test_proposal_2() -> ProposeArgs {
        ProposeArgs {
            locale: "en".to_string(),
            key: "abc.def".to_string(),
            value: "ghi".to_string(),
            user_id: user_id(USER2),
            now: 1,
        }
    }
}
