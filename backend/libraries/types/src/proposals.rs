use crate::{CanisterId, MessageId, NnsNeuronId, ProposalId, SnsNeuronId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Proposal {
    NNS(NnsProposal),
    SNS(SnsProposal),
}

impl Proposal {
    pub fn is_nns(&self) -> bool {
        matches!(self, Proposal::NNS(_))
    }

    pub fn is_sns(&self) -> bool {
        !self.is_nns()
    }

    pub fn id(&self) -> ProposalId {
        match self {
            Proposal::NNS(p) => p.id,
            Proposal::SNS(p) => p.id,
        }
    }

    pub fn created(&self) -> TimestampMillis {
        match self {
            Proposal::NNS(p) => p.created,
            Proposal::SNS(p) => p.created,
        }
    }

    pub fn title(&self) -> &str {
        match self {
            Proposal::NNS(p) => &p.title,
            Proposal::SNS(p) => &p.title,
        }
    }

    pub fn summary(&self) -> &str {
        match self {
            Proposal::NNS(p) => &p.summary,
            Proposal::SNS(p) => &p.summary,
        }
    }

    pub fn status(&self) -> ProposalDecisionStatus {
        match self {
            Proposal::NNS(p) => p.status,
            Proposal::SNS(p) => p.status,
        }
    }

    pub fn reward_status(&self) -> ProposalRewardStatus {
        match self {
            Proposal::NNS(p) => p.reward_status,
            Proposal::SNS(p) => p.reward_status,
        }
    }

    pub fn tally(&self) -> Tally {
        match self {
            Proposal::NNS(p) => p.tally.clone(),
            Proposal::SNS(p) => p.tally.clone(),
        }
    }

    pub fn deadline(&self) -> TimestampMillis {
        match self {
            Proposal::NNS(p) => p.deadline,
            Proposal::SNS(p) => p.deadline,
        }
    }

    pub fn update_status(&mut self, update: ProposalStatusUpdate, now: TimestampMillis) {
        match self {
            Proposal::NNS(p) => p.update_status(update, now),
            Proposal::SNS(p) => p.update_status(update, now),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NnsProposal {
    pub id: ProposalId,
    pub topic: i32,
    pub proposer: NnsNeuronId,
    pub created: TimestampMillis,
    pub title: String,
    pub summary: String,
    pub url: String,
    pub status: ProposalDecisionStatus,
    pub reward_status: ProposalRewardStatus,
    pub tally: Tally,
    pub deadline: TimestampMillis,
    pub last_updated: TimestampMillis,
}

impl NnsProposal {
    pub fn update_status(&mut self, update: ProposalStatusUpdate, now: TimestampMillis) {
        if let Some(status) = update.status {
            self.status = status;
        }
        if let Some(reward_status) = update.reward_status {
            self.reward_status = reward_status;
        }
        if let Some(latest_tally) = update.latest_tally {
            self.tally = latest_tally;
        }
        self.last_updated = now;
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SnsProposal {
    pub id: ProposalId,
    pub action: u64,
    pub proposer: SnsNeuronId,
    pub created: TimestampMillis,
    pub title: String,
    pub summary: String,
    pub url: String,
    pub status: ProposalDecisionStatus,
    pub reward_status: ProposalRewardStatus,
    pub tally: Tally,
    pub deadline: TimestampMillis,
    pub payload_text_rendering: Option<String>,
    pub last_updated: TimestampMillis,
}

impl SnsProposal {
    pub fn update_status(&mut self, update: ProposalStatusUpdate, now: TimestampMillis) {
        if let Some(status) = update.status {
            self.status = status;
        }
        if let Some(reward_status) = update.reward_status {
            self.reward_status = reward_status;
        }
        if let Some(latest_tally) = update.latest_tally {
            self.tally = latest_tally;
        }
        if let Some(deadline) = update.deadline {
            self.deadline = deadline;
        }
        self.last_updated = now;
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    pub governance_canister_id: CanisterId,
    pub proposal: Proposal,
    pub votes: HashMap<UserId, bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContent {
    pub governance_canister_id: CanisterId,
    pub proposal: Proposal,
    pub my_vote: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct ProposalUpdate {
    pub message_id: MessageId,
    pub status: Option<ProposalDecisionStatus>,
    pub reward_status: Option<ProposalRewardStatus>,
    pub latest_tally: Option<Tally>,
    pub deadline: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ProposalStatusUpdate {
    pub status: Option<ProposalDecisionStatus>,
    pub reward_status: Option<ProposalRewardStatus>,
    pub latest_tally: Option<Tally>,
    pub deadline: Option<TimestampMillis>,
}

impl From<ProposalUpdate> for ProposalStatusUpdate {
    fn from(value: ProposalUpdate) -> Self {
        ProposalStatusUpdate {
            status: value.status,
            reward_status: value.reward_status,
            latest_tally: value.latest_tally,
            deadline: value.deadline,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct Tally {
    pub yes: u64,
    pub no: u64,
    pub total: u64,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum ProposalDecisionStatus {
    Unspecified = 0,
    Open = 1,
    Rejected = 2,
    Adopted = 3,
    Executed = 4,
    Failed = 5,
}

impl TryFrom<i32> for ProposalDecisionStatus {
    type Error = i32;

    fn try_from(value: i32) -> Result<ProposalDecisionStatus, i32> {
        match value {
            0 => Ok(ProposalDecisionStatus::Unspecified),
            1 => Ok(ProposalDecisionStatus::Open),
            2 => Ok(ProposalDecisionStatus::Rejected),
            3 => Ok(ProposalDecisionStatus::Adopted),
            4 => Ok(ProposalDecisionStatus::Executed),
            5 => Ok(ProposalDecisionStatus::Failed),
            _ => Err(value),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum ProposalRewardStatus {
    Unspecified = 0,
    AcceptVotes = 1,
    ReadyToSettle = 2,
    Settled = 3,
}

impl TryFrom<i32> for ProposalRewardStatus {
    type Error = i32;

    fn try_from(value: i32) -> Result<ProposalRewardStatus, i32> {
        match value {
            0 => Ok(ProposalRewardStatus::Unspecified),
            1 => Ok(ProposalRewardStatus::AcceptVotes),
            2 => Ok(ProposalRewardStatus::ReadyToSettle),
            3 => Ok(ProposalRewardStatus::Settled),
            _ => Err(value),
        }
    }
}
