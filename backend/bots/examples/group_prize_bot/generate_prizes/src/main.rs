use rand::{rngs::ThreadRng, Rng, RngCore};

const TOKEN: &str = "CKBTC";
const BOT_NAME: &str = "BitcoinBot";
const LEDGER_CANISTER_ID: &str = "mxzaz-hqaaa-aaaar-qaada-cai";
const FEE_E8S: u64 = 10;

// TEST VALUES
// const MIN_CLAIMANTS_PER_PRIZE: u32 = 2;
// const MAX_CLAIMANTS_PER_PRIZE: u32 = 4;
// const PRIZE_FUND_E8S: u64 = 1000;
// const END_DATE: u64 = 1676030400000;
// const E8S_PER_USD: f64 = 20.0;
// const NETWORK = "ic_test";

// PROD VALUES
const MIN_CLAIMANTS_PER_PRIZE: u32 = 20;
const MAX_CLAIMANTS_PER_PRIZE: u32 = 50;
const PRIZE_FUND_E8S: u64 = 99_996_960;
const END_DATE: u64 = 1677240000000;
const E8S_PER_USD: f64 = 2500.0;
const NETWORK = "ic";

fn main() {
    let messages = generate_messages();

    print!("dfx canister --network={{NETWORK}} call group_prize_bot initialize_bot '(record {{ update_existing = false; username = \"{BOT_NAME}\"; token = variant {{ {TOKEN} }}; ledger_canister_id = principal \"{LEDGER_CANISTER_ID}\"; end_date = {END_DATE}:nat64; prizes = vec {{");

    for message in messages {
        print_message(message);
    }

    println!("}}}})'");
}

fn generate_messages() -> Vec<Vec<u64>> {
    let mut rng = rand::thread_rng();
    let mut messages: Vec<Vec<u64>> = Vec::new();
    let mut total: u64 = 0;

    while total < PRIZE_FUND_E8S {
        let mut message: Vec<u64> = Vec::new();
        let num_claimants = generate_claimants(&mut rng);

        total += FEE_E8S;

        for _ in 0..num_claimants {
            let mut prize = generate_prize(&mut rng);
            total += FEE_E8S;

            if total >= PRIZE_FUND_E8S {
                break;
            }

            if total + prize > PRIZE_FUND_E8S {
                prize = PRIZE_FUND_E8S - total;
            }

            total += prize;

            message.push(prize);

            if total >= PRIZE_FUND_E8S {
                break;
            }
        }

        messages.push(message);
    }

    messages
}

fn generate_prize(rng: &mut ThreadRng) -> u64 {
    let x: f64 = rng.gen();

    (E8S_PER_USD * (1.0 + 20.0 * x.powf(4.0) + 80.0 * x.powf(40.0))) as u64
}

fn generate_claimants(rng: &mut ThreadRng) -> u32 {
    let x = rng.next_u32();

    MIN_CLAIMANTS_PER_PRIZE + (x % (MAX_CLAIMANTS_PER_PRIZE - MIN_CLAIMANTS_PER_PRIZE))
}

fn print_message(message: Vec<u64>) {
    // vec { 10:nat64; 7:nat64 };
    print!("vec {{ ");
    for prize in message {
        print_prize(prize);
    }
    print!("}}; ");
}

fn print_prize(prize: u64) {
    print!("{prize}:nat64; ");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_messages_total_matches_fund() {
        let messages = generate_messages();
        let message_count = messages.len() as u64;
        println!("messages {message_count}");
        let message_fees = message_count * FEE_E8S;
        let prizes: Vec<_> = messages.into_iter().flatten().collect();
        let prize_count = prizes.len() as u64;
        println!("prizes {prize_count}");
        let prize_fees = prize_count * FEE_E8S;
        let total_prize_value: u64 = prizes.into_iter().sum();
        let total = total_prize_value + message_fees + prize_fees;
        let mean = (total_prize_value / prize_count) as u64;
        println!("mean prize {mean}");
        assert_eq!(total, PRIZE_FUND_E8S)
    }
}
