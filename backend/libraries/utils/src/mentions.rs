use candid::Principal;
use types::UserId;

const START_PATTERN: &str = "UserId(";

pub fn extract_mentioned_users(str: &str) -> Vec<UserId> {
    let mut mentions = Vec::new();
    for start in str.match_indices(START_PATTERN).map(|(i, _)| i + START_PATTERN.len()) {
        if let Some(len) = str[start..].find(')')
            && let Ok(user_id) = Principal::from_text(&str[start..(start + len)])
        {
            mentions.push(user_id.into());
        }
    }
    mentions
}

// Passes the user id in each mention in `str` (written `@UserId(<id>)`) through `f`, returning the
// text with each replaced by the id returned, or None if none were replaced
pub fn replace_mentioned_users(str: &str, f: &mut dyn FnMut(UserId) -> UserId) -> Option<String> {
    let mut replaced = String::new();
    let mut copied_up_to = 0;
    for start in str.match_indices(START_PATTERN).map(|(i, _)| i + START_PATTERN.len()) {
        if let Some(len) = str[start..].find(')')
            && let Ok(principal) = Principal::from_text(&str[start..(start + len)])
        {
            let user_id = UserId::from(principal);
            let latest = f(user_id);
            if latest != user_id {
                replaced.push_str(&str[copied_up_to..start]);
                replaced.push_str(&latest.to_string());
                copied_up_to = start + len;
            }
        }
    }
    if copied_up_to == 0 {
        None
    } else {
        replaced.push_str(&str[copied_up_to..]);
        Some(replaced)
    }
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

    #[test]
    fn mentions_are_replaced() {
        let u1 = UserId::from(Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap());
        let u2 = UserId::from(Principal::from_text("2fzwl-cu3hl-bawo2-idwrw-7yygk-uccms-cbo3a-c6kqt-lnk3j-mewg3-hae").unwrap());
        let u3 = UserId::from(Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap());
        let mut f = |user_id| if user_id == u1 { u3 } else { user_id };

        assert_eq!(
            replace_mentioned_users(&format!("@UserId({u1}) and @UserId({u2}), then @UserId({u1})!"), &mut f),
            Some(format!("@UserId({u3}) and @UserId({u2}), then @UserId({u3})!"))
        );
        assert_eq!(replace_mentioned_users(&format!("@UserId({u2}) @UserId(xyz"), &mut f), None);
        assert_eq!(replace_mentioned_users("no mentions", &mut f), None);
    }
}
