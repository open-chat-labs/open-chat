use constants::MINUTE_IN_MS;
use identity_canister::{Challenge, ChallengeAttempt, ChallengeKey};
use rand::{Rng, RngCore};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Milliseconds, TimestampMillis};

const CAPTCHA_CHALLENGE_LIFETIME: Milliseconds = 5 * MINUTE_IN_MS;
const MAX_INFLIGHT_CHALLENGES: u32 = 500;

#[derive(Serialize, Deserialize, Default)]
pub struct Challenges {
    inflight: HashMap<ChallengeKey, ChallengeSolution>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChallengeSolution {
    created: TimestampMillis,
    chars: String,
}

impl Challenges {
    pub fn create<R: RngCore>(&mut self, now: TimestampMillis, mut rng: R) -> Option<Challenge> {
        // Remove any expired challenges
        self.inflight.retain(|_, s| !s.expired(now));

        if self.count() >= MAX_INFLIGHT_CHALLENGES {
            return None;
        }

        // Try generating a unique key or trap after 10 attempts
        const MAX_TRIES: u8 = 10;
        for _ in 0..MAX_TRIES {
            let key = rng.next_u32();

            if let std::collections::hash_map::Entry::Vacant(e) = self.inflight.entry(key) {
                // Create the CAPTCHA
                let builder = ic_captcha::CaptchaBuilder::new();
                let seed: [u8; 32] = rng.gen();
                let captcha = builder.generate(&seed, None);

                // Remember the solution
                e.insert(ChallengeSolution {
                    created: now,
                    chars: captcha.text(),
                });

                // Return the challenge
                return Some(Challenge {
                    png_base64: captcha.to_base64(0),
                    key,
                });
            }
        }

        ic_cdk::trap(&format!("Could not find a new challenge key after {MAX_TRIES} tries"));
    }

    pub fn check(&mut self, attempt: &ChallengeAttempt, now: TimestampMillis) -> bool {
        if let Some(solution) = self.inflight.remove(&attempt.key) {
            !solution.expired(now) && solution.chars == attempt.chars
        } else {
            false
        }
    }

    pub fn count(&self) -> u32 {
        self.inflight.len() as u32
    }
}

impl ChallengeSolution {
    fn expired(&self, now: TimestampMillis) -> bool {
        now > self.created + CAPTCHA_CHALLENGE_LIFETIME
    }
}
