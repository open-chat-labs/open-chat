import user_mgmt from 'ic:canisters/user_mgmt';

user_mgmt.set_username(window.prompt("Enter your name:")).then(result => {
  user_mgmt.get_username().then(username => window.alert(username));
  });