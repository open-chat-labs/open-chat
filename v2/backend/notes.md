Canisters
---------
Controller
UserIndex
GroupIndex
Notifications
User
Group
Website

Bootstrap process
-----------------
1. Create/install the "index" canisters by calling the create_canister method
2. Set the WASMs of the "child" canisters by calling the upgrade_canister method
3. Create/install the website canister (passing the canister ids of the index canisters) by calling the create_canister method

Registration process
--------------------
1. Sign-in with II
2. If no account then start registration process
    1. CAPTCHA
    2. Enter phone number - call phone_index.register
    3. Enter 6-digit code - call phone_index.claim

Getting latest messages
-----------------------
1. Over WebRTC
2. By Webpush notification 
  2.1 For direct chats and unmuted private groups send notifications immediately
  2.2 Otherwise send notifications in batches
3. By polling own user canister (every 20 secs)
4. By polling group canisters (depends on how recent was the last message)

Dependencies on IC
------------------
- heartbeat enabled on our subnet
- stable memory abstractions in particular for file data
- access control (for instance "service level")
- ICQC
- how to do logging?
- how to do CAPTCHA?

TODO
----
- Twilio (or the like) for SMS, WebRTC, Webpush notifications
- Metrics (Elastic Stack?)
- Github build pipeline (tag commit with build number and expose in metrics)
- Docker builds
- Integration tests


dfx deploy user_index --argument '(record { service_principals = vec {principal "tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae"}; sms_service_principals = vec {}; test_mode = true; user_wasm_module = blob "" })'

dfx canister install user_index --mode=reinstall --argument '(record { service_principals = vec {principal "tu45y-p4p3d-b4gg4-gmyy3-rgweo-whsrq-fephi-vshrn-cipca-xdkri-pae"}; sms_service_principals = vec {}; test_mode = true; user_wasm_module = blob "" })'
dfx --identity=matt canister call --query user_index current_user '(record { })'
dfx --identity=matt canister call user_index submit_phone_number '(record { phone_number = record { country_code = 44; number = "07778 588510" } })'
dfx --identity=matt canister call user_index confirm_phone_number '(record { confirmation_code = "123456" })'
dfx --identity=matt canister call user_index set_username '(record { username = "Matt" })'

dfx canister call user_index update_wasm '(record { version = "0.1.0"; user_wasm_module = vec {1;2;3} })'

dfx deploy user --argument '(record { owner = principal "czfqq-wsqcp-34akk-p5ax7-rvqwv-6cgwc-kr2rr-4fr3f-mka7k-5haqh-hqe" })'
