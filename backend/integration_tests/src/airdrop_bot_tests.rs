// use crate::env::ENV;
// use crate::{client, CanisterIds, TestEnv, User};
// use candid::Principal;
// use pocket_ic::PocketIc;
// use std::ops::Deref;
// use testing::rng::random_string;
// use types::{ChatId, GroupRole};

// #[test]
// fn airdrop_end_to_end() {
//     let mut wrapper = ENV.deref().get();
//     let TestEnv {
//         env,
//         canister_ids,
//         controller,
//         ..
//     } = wrapper.env();

//     // - Mint CHAT tokens
//     // - Transfer them to Airdrop bot
//     // - Create 3 users
//     // - Claim daily chit for each user
//     // - Create community
//     // - Create public channel
//     // - Promote airdrop bot to channel owner
//     // - Call set_airdrop
//     // - Check the channel now has AccessGate::Locked
//     // - Check the channel now has exactly 3 prize messages
//     // - Check a user has a DM with expected prize
// }
