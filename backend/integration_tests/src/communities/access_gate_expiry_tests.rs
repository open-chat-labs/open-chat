use crate::env::ENV;
use crate::{client, CanisterIds, TestEnv, User};
use candid::Principal;
use itertools::Itertools;
use pocket_ic::PocketIc;
use std::ops::Deref;
use testing::rng::random_string;
use types::CommunityId;

#[test]
fn diamond_member_lapses_and_rejoins_successfully() {}
