use candid::Principal;
use types::UserId;

const START_PATTERN: &str = "UserId(";

pub fn extract_mentioned_users(str: &str) -> Vec<UserId> {
    let mut mentions = Vec::new();
    for start in str.match_indices(START_PATTERN).map(|(i, _)| i + START_PATTERN.len()) {
        if let Some(len) = str[start..].find(")") {
            if let Ok(user_id) = Principal::from_text(&str[start..(start + len)]) {
                mentions.push(user_id.into());
            }
        }
    }
    mentions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn with_no_mentions() {
        let u1 = UserId::from(Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap());

        assert!(extract_mentioned_users("").is_empty());
        assert!(extract_mentioned_users("a").is_empty());
        assert!(extract_mentioned_users("abc 123").is_empty());
        assert!(extract_mentioned_users("123 @UserId(xyz)").is_empty());
        assert!(extract_mentioned_users(&format!("{u1}")).is_empty());
        assert!(extract_mentioned_users(&format!("@UserId({u1}_)")).is_empty());
    }

    #[test]
    fn with_mentions() {
        let u1 = UserId::from(Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap());
        let u2 = UserId::from(Principal::from_text("2fzwl-cu3hl-bawo2-idwrw-7yygk-uccms-cbo3a-c6kqt-lnk3j-mewg3-hae").unwrap());

        assert_eq!(extract_mentioned_users(&format!("@UserId({u1})")), vec![u1]);
        assert_eq!(extract_mentioned_users(&format!("123 @UserId({u1}) xyz")), vec![u1]);
        assert_eq!(
            extract_mentioned_users(&format!("@UserId({u1}) and @UserId({u2})")),
            vec![u1, u2]
        );
        assert_eq!(
            extract_mentioned_users(&format!("123@UserId({u1})___@UserId({u2})___&&&!!!")),
            vec![u1, u2]
        );
    }
}
