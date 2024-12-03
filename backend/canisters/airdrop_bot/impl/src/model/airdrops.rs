use airdrop_bot_canister::{AirdropAlgorithm, AirdropConfig, V1Algorithm, V2Algorithm};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Chit, TimestampMillis, UserId};
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

    pub fn execute<R: RngCore>(&mut self, users: Vec<(UserId, Chit)>, rng: &mut R) -> Option<&Airdrop> {
        let config = self.next.take()?;

        let outcome = match &config.algorithm {
            AirdropAlgorithm::V1(c) => Airdrops::execute_v1(c.clone(), users, rng),
            AirdropAlgorithm::V2(c) => Airdrops::execute_v2(c.clone(), users, rng),
        }?;

        self.past.push(Airdrop { config, outcome });

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

    fn execute_v1<R: RngCore>(config: V1Algorithm, users: Vec<(UserId, Chit)>, rng: &mut R) -> Option<AirdropOutcome> {
        let participants = Airdrops::execute_main(config.main_chat_fund, config.main_chit_band, &users);

        if participants.is_empty() {
            return None;
        }

        let mut tickets: Vec<UserId> = Vec::new();

        for (user_id, chit) in users {
            let num_tickets = chit.balance as u32 / config.lottery_chit_band;

            for _n in 0..num_tickets {
                tickets.push(user_id);
            }
        }

        let lottery_winners = Airdrops::execute_lottery(tickets, config.lottery_prizes, rng);

        Some(AirdropOutcome {
            participants,
            lottery_winners,
        })
    }

    fn execute_v2<R: RngCore>(config: V2Algorithm, users: Vec<(UserId, Chit)>, rng: &mut R) -> Option<AirdropOutcome> {
        let participants = Airdrops::execute_main(config.main_chat_fund, config.main_chit_band, &users);

        if participants.is_empty() {
            return None;
        }

        let tickets: Vec<UserId> = users
            .iter()
            .filter(|(_, chit)| chit.balance as u32 >= config.lottery_min_chit || chit.streak >= config.lottery_min_streak)
            .map(|(user_id, _)| *user_id)
            .collect();

        let lottery_winners = Airdrops::execute_lottery(tickets, config.lottery_prizes, rng);

        Some(AirdropOutcome {
            participants,
            lottery_winners,
        })
    }

    fn execute_main(chat_fund: u128, chit_band: u32, users: &Vec<(UserId, Chit)>) -> HashMap<UserId, Participant> {
        let mut total_shares: u32 = 0;
        let mut user_shares: Vec<(UserId, u32, u32)> = Vec::new();

        for (user_id, chit) in users {
            let chit = chit.balance as u32;
            let shares = chit / chit_band;

            total_shares += shares;

            user_shares.push((*user_id, chit, shares));
        }

        if total_shares == 0 {
            return HashMap::default();
        }

        let fund = chat_fund;
        let mut share = fund / total_shares as u128;
        share -= share % 1_000_000;

        user_shares
            .into_iter()
            .map(|(u, chit, shares)| {
                (
                    u,
                    Participant {
                        chit,
                        shares,
                        prize: if shares > 0 {
                            Some(Prize {
                                chat_won: shares as u128 * share,
                                block_index: None,
                            })
                        } else {
                            None
                        },
                    },
                )
            })
            .collect()
    }

    fn execute_lottery<R: RngCore>(mut tickets: Vec<UserId>, prizes: Vec<u128>, rng: &mut R) -> Vec<(UserId, Prize)> {
        let mut lottery_winners = Vec::new();

        for prize in prizes {
            if tickets.is_empty() {
                break;
            }

            let winning_ticket = (rng.next_u32() % tickets.len() as u32) as usize;

            let winner = tickets.remove(winning_ticket);

            // Ensure the same user can't win multiple times
            tickets.retain(|u| *u != winner);

            lottery_winners.push((
                winner,
                Prize {
                    chat_won: prize,
                    block_index: None,
                },
            ));
        }

        lottery_winners
    }
}

#[cfg(test)]
mod tests {
    use testing::rng::random_principal;
    use utils::env::{test::TestEnv, Environment};

    use super::*;

    #[test]
    fn execute_v1_airdrop_expected() {
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
                channel_id: 1u32.into(),
                start: now + 1_000,
                algorithm: AirdropAlgorithm::V1(V1Algorithm {
                    main_chat_fund: 80_000,
                    main_chit_band: 10_000,
                    lottery_prizes: vec![12_000, 5_000, 3_000],
                    lottery_chit_band: 50_000,
                }),
            },
            now,
        );

        airdrops
    }

    fn generate_random_users() -> Vec<(UserId, Chit)> {
        (0..1000)
            .map(|_| {
                (
                    random_principal().into(),
                    Chit {
                        balance: (rand::thread_rng().next_u32() % 110_000) as i32,
                        streak: 0,
                    },
                )
            })
            .collect()
    }
}
