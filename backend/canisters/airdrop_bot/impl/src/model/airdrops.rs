use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChannelId, CommunityId, TimestampMillis, UserId};
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
pub struct Airdrops {
    past: Vec<Airdrop>,
    next: Option<AirdropConfig>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Airdrop {
    pub config: AirdropConfig,
    pub outcome: AirdropOutcome,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AirdropConfig {
    pub community_id: CommunityId,
    pub channel_id: ChannelId,
    pub start: TimestampMillis,
    pub main_chat_fund: u128,
    pub main_chit_band: u32,
    pub lottery_prizes: Vec<u128>,
    pub lottery_chit_band: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AirdropOutcome {
    pub participants: HashMap<UserId, Participant>,
    pub lottery_winners: Vec<(UserId, Prize)>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Participant {
    pub chit: u32,
    pub shares: u32,
    pub prize: Option<Prize>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Prize {
    pub chat_won: u128,
    pub block_index: Option<u64>,
}

pub enum SetNextResult {
    Success,
    ChannelUsed,
    InThePast,
    ClashesWithPrevious,
}

#[derive(Serialize, Debug)]
pub struct AirdropsMetrics {
    past: Vec<AirdropMetrics>,
    next: Option<AirdropConfig>,
}

#[derive(Serialize, Debug)]
pub struct AirdropMetrics {
    pub config: AirdropConfig,
    pub outcome: AirdropOutcomeMetrics,
}

#[derive(Serialize, Debug)]
pub struct AirdropOutcomeMetrics {
    pub participants: u32,
    pub lottery_winners: Vec<(UserId, Prize)>,
}

impl Airdrops {
    pub fn set_next(&mut self, config: AirdropConfig, now: TimestampMillis) -> SetNextResult {
        if config.start < now {
            return SetNextResult::InThePast;
        }

        if self
            .past
            .iter()
            .any(|a| a.config.community_id == config.community_id && a.config.channel_id == config.channel_id)
        {
            return SetNextResult::ChannelUsed;
        }

        if let Some(previous) = self.past.last() {
            if MonthKey::from_timestamp(previous.config.start) == MonthKey::from_timestamp(config.start) {
                return SetNextResult::ClashesWithPrevious;
            }
        }

        self.next = Some(config);

        SetNextResult::Success
    }

    pub fn cancel(&mut self) -> Option<AirdropConfig> {
        self.next.take()
    }

    pub fn execute<R: RngCore>(&mut self, users: Vec<(UserId, i32)>, rng: &mut R) -> Option<&Airdrop> {
        let config = self.next.take()?;

        let mut total_shares: u32 = 0;
        let mut user_shares: Vec<(UserId, u32, u32)> = Vec::new();
        let mut ticket_holders: Vec<UserId> = Vec::new();

        for (user_id, chit) in users {
            let chit = chit as u32;
            let shares = chit / config.main_chit_band;
            let tickets = chit / config.lottery_chit_band;

            total_shares += shares;

            user_shares.push((user_id, chit, shares));

            for _n in 0..tickets {
                ticket_holders.push(user_id);
            }
        }

        if ticket_holders.is_empty() || total_shares == 0 {
            return None;
        }

        let fund = config.main_chat_fund;
        let prizes = config.lottery_prizes.len();

        let participants = user_shares
            .into_iter()
            .map(|(u, chit, shares)| {
                (
                    u,
                    Participant {
                        chit,
                        shares,
                        prize: if shares > 0 {
                            Some(Prize {
                                chat_won: (fund * shares as u128) / total_shares as u128,
                                block_index: None,
                            })
                        } else {
                            None
                        },
                    },
                )
            })
            .collect();

        let mut lottery_winners = Vec::new();

        for i in 0..prizes {
            let winning_ticket = (rng.next_u32() % ticket_holders.len() as u32) as usize;

            let winner = ticket_holders.remove(winning_ticket);

            lottery_winners.push((
                winner,
                Prize {
                    chat_won: config.lottery_prizes[i],
                    block_index: None,
                },
            ));

            if ticket_holders.is_empty() {
                break;
            }
        }

        let airdrop = Airdrop {
            config,
            outcome: AirdropOutcome {
                participants,
                lottery_winners,
            },
        };

        self.past.push(airdrop);

        Some(self.past.last().as_ref().unwrap())
    }

    pub fn set_main_transaction(&mut self, user_id: &UserId, block_index: u64) -> bool {
        if let Some(last) = self.past.last_mut() {
            if let Some(participant) = last.outcome.participants.get_mut(user_id) {
                if let Some(prize) = &mut participant.prize {
                    if prize.block_index.is_none() {
                        prize.block_index = Some(block_index);
                        return true;
                    }
                }
            }
        }

        false
    }

    pub fn set_lottery_transaction(&mut self, winning_index: usize, block_index: u64) -> bool {
        if let Some(last) = self.past.last_mut() {
            if let Some((_, prize)) = last.outcome.lottery_winners.get_mut(winning_index) {
                if prize.block_index.is_none() {
                    prize.block_index = Some(block_index);
                    return true;
                }
            }
        }

        false
    }

    pub fn current(&self, now: TimestampMillis) -> Option<&AirdropConfig> {
        if let Some(last) = self.past.last() {
            if MonthKey::from_timestamp(now) == MonthKey::from_timestamp(last.config.start) {
                return Some(&last.config);
            }
        }

        None
    }

    pub fn metrics(&self) -> AirdropsMetrics {
        AirdropsMetrics {
            past: self
                .past
                .iter()
                .map(|a| AirdropMetrics {
                    config: a.config.clone(),
                    outcome: AirdropOutcomeMetrics {
                        participants: a.outcome.participants.len() as u32,
                        lottery_winners: a.outcome.lottery_winners.clone(),
                    },
                })
                .collect(),
            next: self.next.clone(),
        }
    }

    pub fn next(&self) -> Option<&AirdropConfig> {
        self.next.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use testing::rng::random_principal;
    use utils::env::{test::TestEnv, Environment};

    use super::*;

    #[test]
    fn execute_airdrop_expected() {
        let mut env = TestEnv::default();
        let mut airdrops = setup(env.now);
        let users = generate_random_users();

        let airdrop = airdrops.execute(users, env.rng()).expect("Expected some airdrop");

        println!("{:#?}", airdrop.outcome);

        assert_eq!(airdrop.outcome.lottery_winners.len(), 3);
        assert_eq!(
            airdrop
                .outcome
                .lottery_winners
                .iter()
                .map(|(_, p)| p.chat_won)
                .collect::<Vec<u128>>(),
            vec![12000_u128, 5000_u128, 3000_u128]
        )
    }

    fn setup(now: TimestampMillis) -> Airdrops {
        let mut airdrops = Airdrops::default();

        airdrops.set_next(
            AirdropConfig {
                community_id: random_principal().into(),
                channel_id: 1,
                start: now + 1_000,
                main_chat_fund: 80_000,
                main_chit_band: 10_000,
                lottery_prizes: vec![12_000, 5_000, 3_000],
                lottery_chit_band: 50_000,
            },
            now,
        );

        airdrops
    }

    fn generate_random_users() -> Vec<(UserId, i32)> {
        (0..1000)
            .map(|_| (random_principal().into(), (rand::thread_rng().next_u32() % 110_000) as i32))
            .collect()
    }
}
