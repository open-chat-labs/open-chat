use ic_types::Principal;
use bimap::BiMap;
use shared::StableState;

#[derive(Default)]
pub struct UserData {
    user_map: BiMap<Principal, String>
}

impl UserData {
    pub fn set_username(&mut self, principal: Principal, username: String) -> SetUsernameResponse {
        let previous_username: Option<&String> = self.user_map.get_by_left(&principal);

        if previous_username.is_some() && previous_username.unwrap() == &username {
            return SetUsernameResponse::SuccessNoChange;
        }

        if self.user_map.contains_right(&username) {
            return SetUsernameResponse::UsernameTaken;
        }

        self.user_map.insert(principal, username);
        
        SetUsernameResponse::Success
    }

    pub fn get_username(&self, principal: &Principal) -> Option<String> {
        self.user_map.get_by_left(principal).map(|s| s.clone())
    }

    pub fn get_principal(&self, username: &String) -> Option<Principal> {
        self.user_map.get_by_right(username).map(|p| p.clone())
    }
}

impl StableState for UserData {
    type State = Vec<(Principal, String)>;

    fn drain(self) -> Vec<(Principal, String)> {
        self.user_map.into_iter().collect()
    }
    
    fn fill(vec: Vec<(Principal, String)>) -> UserData {
        let user_map: BiMap<Principal, String> = vec.into_iter().collect();

        UserData {
            user_map
        }
    }
}

pub enum SetUsernameResponse {
    Success,
    SuccessNoChange,
    UsernameTaken
}