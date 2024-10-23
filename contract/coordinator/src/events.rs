use std::fmt;

use near_sdk::{AccountId, serde_json};
use near_sdk::serde::{Deserialize, Serialize};
use crate::bounty::BountyStatus;
use crate::coordinator::PayoutStrategy;

// This is heavily influenced by: https://github.com/near-examples/nft-tutorial/blob/7.events/nft-contract/src/events.rs#L1-L79


/// Enum that represents the data type of the EventLog.
/// The enum can either be an NftMint or an NftTransfer.
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
#[serde(crate = "near_sdk::serde")]
#[non_exhaustive]
pub enum EventLogVariant {
    BountyCreated(BountyCreatedLog),
    BountyRetry(BountyRetryLog),
    BountyCompleted(BountyCompletedLog),
}

/// Interface to capture data about an event
///
/// Arguments:
/// * `standard`: name of standard e.g. nep171
/// * `version`: e.g. 1.0.0
/// * `event`: associate event data
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct EventLog {
    pub standard: String,
    pub version: String,
    // `flatten` to not have "event": {<EventLogVariant>} in the JSON, just have the contents of {<EventLogVariant>}.
    #[serde(flatten)]
    pub event: EventLogVariant,
}

impl fmt::Display for EventLog {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_fmt(format_args!(
            "EVENT_JSON:{}",
            &serde_json::to_string(self).map_err(|_| fmt::Error)?
        ))
    }
}

/// An event log for when a bounty is created.
/// Used to let nodes know that there is work to do
///
/// Arguments
/// * `coordinator_id`: the account id of the coordinator firing this event
/// * `bounty_id`: "bounty.id.test.near"
/// * `node_ids`: ["node.id.test.near", "node2.id.test.near"]
/// * `message`: optional message
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct BountyCreatedLog {
    pub coordinator_id: AccountId,
    pub bounty_id: AccountId,
    pub node_ids: Vec<AccountId>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// An event log for when an incomplete bounty should be retried, such as when the storage deposit has been increased.
///
/// Arguments
/// * `coordinator_id`: the account id of the coordinator firing this event
/// * `bounty_id`: "bounty.id.test.near"
/// * `node_ids`: nodes elected for the bounty
/// * `message`: optional message
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct BountyRetryLog {
    pub coordinator_id: AccountId,
    pub bounty_id: AccountId,
    pub node_ids: Vec<AccountId>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}


/// An event log to capture bounty closure
/// Used to let nodes know that they can attempt to collect their payout
///
/// Arguments
/// * `coordinator_id`: the account id of the coordinator firing this event
/// * `bounty_id`: id of the bounty that was closed
/// * `node_ids`: All nodes that were elected for the bounty
/// * `reward_recipients`: Elected nodes that are qualified to receive a reward
/// * `payout_strategy`: The payout strategy used to determine which nodes receive an award
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct BountyCompletedLog {
    pub coordinator_id: AccountId,
    pub bounty_id: AccountId,
    pub node_ids: Vec<AccountId>,
    pub reward_recipients: Vec<AccountId>,
    pub outcome: BountyStatus,
    pub payout_strategy: PayoutStrategy,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
