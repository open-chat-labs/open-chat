website -> user -> group -> local_user_index -> user_index

Notes:

Website before group because of `gate` having been added to `update_group_v2`
User before group because of `affected_events` having been removed
Website before user_index because we've removed the CAPTCHA
User before local_user_index before user_index because of the updated DiamondMembershipPaymentReceived event
