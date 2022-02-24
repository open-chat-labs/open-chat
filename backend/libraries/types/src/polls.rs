use crate::{TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollConfig {
    pub text: Option<String>,
    pub options: Vec<String>,
    pub end_date: Option<TimestampMillis>,
    pub anonymous: bool,
    pub show_votes_before_end_date: bool,
    pub allow_multiple_votes_per_user: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PollVotes {
    pub total: TotalVotes,
    pub user: Vec<u32>,
}

impl PollConfig {
    pub fn validate(&self, now: TimestampMillis) -> Result<(), InvalidPollReason> {
        let options = self.options.len();
        if options < MIN_POLL_OPTIONS {
            Err(InvalidPollReason::TooFewOptions(MIN_POLL_OPTIONS as u32))
        } else if options > MAX_POLL_OPTIONS {
            Err(InvalidPollReason::TooManyOptions(MAX_POLL_OPTIONS as u32))
        } else if self.options.iter().any(|o| o.len() > MAX_POLL_OPTION_LENGTH) {
            Err(InvalidPollReason::OptionTooLong(MAX_POLL_OPTION_LENGTH as u32))
        } else if self.contains_duplicate_options() {
            Err(InvalidPollReason::DuplicateOptions)
        } else if self.end_date.unwrap_or(u64::MAX) < now {
            Err(InvalidPollReason::EndDateInThePast)
        } else {
            Ok(())
        }
    }

    fn contains_duplicate_options(&self) -> bool {
        let mut set = HashSet::new();
        self.options.iter().any(|o| !set.insert(o))
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum TotalVotes {
    Visible(HashMap<u32, Vec<UserId>>),
    Anonymous(HashMap<u32, u32>),
    Hidden(u32),
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum VoteOperation {
    RegisterVote,
    DeleteVote,
}

const MIN_POLL_OPTIONS: usize = 2;
const MAX_POLL_OPTIONS: usize = 10;
const MAX_POLL_OPTION_LENGTH: usize = 100;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum InvalidPollReason {
    TooFewOptions(u32),
    TooManyOptions(u32),
    OptionTooLong(u32),
    DuplicateOptions,
    EndDateInThePast,
}
