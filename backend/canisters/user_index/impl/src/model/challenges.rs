use captcha::filters::Wave;
use rand_core::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{Challenge, ChallengeAttempt, ChallengeKey, TimestampMillis};

const CAPTCHA_CHALLENGE_LIFETIME_MILLIS: u64 = 5 * 60 * 1000; // 5 minutes
const MAX_INFLIGHT_CHALLENGES: u32 = 500;

#[derive(Serialize, Deserialize, Default)]
pub struct Challenges {
    inflight: HashMap<ChallengeKey, ChallengeSolution>,
    test_mode: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChallengeSolution {
    created: TimestampMillis,
    chars: String,
}

struct Base64(String);

impl Challenges {
    pub fn new(test_mode: bool) -> Challenges {
        Challenges {
            inflight: HashMap::default(),
            test_mode,
        }
    }

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
                let (Base64(png_base64), chars) = create_captcha(rng);

                // Remember the solution
                e.insert(ChallengeSolution { created: now, chars });

                // Return the challenge
                return Some(Challenge { png_base64, key });
            }
        }

        ic_cdk::trap(&format!("Could not find a new challenge key after {MAX_TRIES} tries"));
    }

    pub fn check(&mut self, attempt: &ChallengeAttempt, now: TimestampMillis) -> bool {
        if let Some(solution) = self.inflight.remove(&attempt.key) {
            !solution.expired(now) && solution.chars == attempt.chars
        } else if self.test_mode && attempt.key == 0 && attempt.chars == "TEST" {
            return true;
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
        now > (self.created + CAPTCHA_CHALLENGE_LIFETIME_MILLIS)
    }
}

fn create_captcha<R: RngCore>(rng: R) -> (Base64, String) {
    let mut captcha = captcha::RngCaptcha::from_rng(rng);
    let captcha = captcha
        .add_chars(5)
        .apply_filter(Wave::new(2.0, 20.0).horizontal())
        .apply_filter(Wave::new(2.0, 20.0).vertical())
        .view(220, 120);

    let resp = match captcha.as_base64() {
        Some(png_base64) => Base64(png_base64),
        None => ic_cdk::trap("Could not get base64 of captcha"),
    };

    (resp, captcha.chars_as_string())
}
