use std::collections::HashMap;
use std::fmt::{Display, Formatter};

use near_sdk::{AccountId, Balance, log, near_bindgen};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, UnorderedSet};
use near_sdk::env::{
    block_timestamp_ms, predecessor_account_id, signer_account_id,
};
use near_sdk::serde::{Deserialize, Deserializer, Serialize, Serializer};
use near_sdk::serde::de::{Error, MapAccess, Visitor};
use near_sdk::serde::ser::SerializeStruct;

use crate::coordinator::PayoutStrategy;

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Eq, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum SupportedDownloadProtocols {
    IPFS,
    HTTPS,
    GIT,
    EMPTY,
}

impl Display for SupportedDownloadProtocols {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            SupportedDownloadProtocols::IPFS => write!(f, "ipfs"),
            SupportedDownloadProtocols::HTTPS => write!(f, "https"),
            SupportedDownloadProtocols::GIT => write!(f, "git"),
            SupportedDownloadProtocols::EMPTY => write!(f, "EMPTY"),
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Eq, PartialEq, Debug, Copy, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum NodeResponseStatus {
    SUCCESS,
    FAILURE,
    REJECT,
    EMPTY,
}

impl Display for NodeResponseStatus {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeResponseStatus::SUCCESS => write!(f, "SUCCESS"),
            NodeResponseStatus::FAILURE => write!(f, "FAILURE"),
            NodeResponseStatus::REJECT => write!(f, "REJECT"),
            NodeResponseStatus::EMPTY => write!(f, "EMPTY"),
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Eq, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum BountyStatus {
    Pending,
    Failed,
    Success,
    Cancelled,
}

impl Display for BountyStatus {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            BountyStatus::Pending => write!(f, "PENDING"),
            BountyStatus::Failed => write!(f, "FAILED"),
            BountyStatus::Success => write!(f, "SUCCESS"),
            BountyStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Eq, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct NodeResponse {
    pub node_id: AccountId,
    pub solution: String,
    pub message: String,
    // pub timestamp: u64,
    pub status: NodeResponseStatus,
    pub payout_claimed: bool,
}

#[near_bindgen]
impl NodeResponse {
    #[init]
    #[private]
    pub fn new_node_response(
        node_id: AccountId,
        solution: String,
        message: String,
        status: NodeResponseStatus,
    ) -> Self {
        Self {
            node_id,
            solution,
            message,
            // timestamp: block_timestamp(),
            status,
            payout_claimed: false,
        }
    }
}

// // impl<K, V> Serialize for UnorderedMap<>
// impl<T> Serialize for UnorderedSet<T>
//  where T: Serialize,
// {
//     fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
//     where
//         S: Serializer,
//     {
//         let mut map = serializer.seq(Some(self.len()))?;
//         for v in self {
//             seq.serialize_element(v)?;
//         }
//         seq.end()
//     }
// }
// TODO Add a timeout to a bounty
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct Bounty {
    pub id: AccountId,
    pub owner_id: AccountId,
    // Signer who created the bounty. Used for auth.
    pub coordinator_id: AccountId,
    // Coordinator who created the bounty. Used for auth and verification.
    pub file_location: String,
    //URL/CID. Support ipfs, git, https initially
    pub file_download_protocol: SupportedDownloadProtocols,
    pub status: BountyStatus,
    // Pending, Failed, Success, Cancelled
    //ipfs, git, https
    pub min_nodes: u64,
    // Min number of nodes that must have consensus to complete the bounty
    pub bounty_created: u64,
    //UTC timestamp for when bounty was created
    pub network_required: bool,
    // True if the bounty's execution requires network access. Does not block downloading files for the bounty.
    pub gpu_required: bool,
    // True if the bounty's execution requires GPU compute
    pub amt_storage: Balance,
    //Unused storage is refunded to the owner once the contract is closed
    pub amt_node_reward: Balance,
    //Total payout to the nodes.
    pub timeout_seconds: u64,
    // Bounty timeout in seconds. If 0, no timeout.
    // pub result: String, //TODO This was going to be the single, definitive result. Need to summarize all the responses to get this.
    pub elected_nodes: Vec<AccountId>,
    //TODO: How can we make this private?
    pub answers: UnorderedMap<AccountId, NodeResponse>,
    pub failed_nodes: UnorderedSet<AccountId>,
    pub successful_nodes: UnorderedSet<AccountId>,
    pub unanswered_nodes: UnorderedSet<AccountId>,
    pub rejected_nodes: UnorderedSet<AccountId>,
}

impl Serialize for Bounty {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
    {
        // 3 is the number of fields in the struct.
        let mut state = serializer.serialize_struct("Bounty", 15)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("owner_id", &self.owner_id)?;
        state.serialize_field("coordinator_id", &self.coordinator_id)?;
        state.serialize_field("file_location", &self.file_location)?;
        state.serialize_field("file_download_protocol", &self.file_download_protocol)?;
        state.serialize_field("status", &self.status)?;
        state.serialize_field("min_nodes", &self.min_nodes)?;
        state.serialize_field("bounty_created", &self.bounty_created)?;
        state.serialize_field("network_required", &self.network_required)?;
        state.serialize_field("gpu_required", &self.gpu_required)?;
        state.serialize_field("amt_storage", &self.amt_storage)?;
        state.serialize_field("amt_node_reward", &self.amt_node_reward)?;
        state.serialize_field("timeout_seconds", &self.timeout_seconds)?;
        state.serialize_field("elected_nodes", &self.elected_nodes)?;
        state.serialize_field("unanswered_nodes", &self.unanswered_nodes.to_vec())?;
        state.serialize_field("successful_nodes", &self.successful_nodes.to_vec())?;
        state.serialize_field("failed_nodes", &self.failed_nodes.to_vec())?;
        state.serialize_field("rejected_nodes", &self.rejected_nodes.to_vec())?;

        //TODO Figure out how to serialize and add these fields
        // pub answers: UnorderedMap<AccountId, NodeResponse>, //TODO: How can we make this private?
        // state.serialize_seq("failed_nodes", &self.failed_nodes)?;
        // pub successful_nodes: UnorderedSet<AccountId>,
        // pub unanswered_nodes: UnorderedSet<AccountId>,
        state.end()
    }
}

impl<'de> Deserialize<'de> for Bounty {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
        where
            D: Deserializer<'de>,
    {
        struct BountyVisitor;

        impl<'de> Visitor<'de> for BountyVisitor {
            type Value = Bounty;

            fn expecting(&self, formatter: &mut Formatter) -> std::fmt::Result {
                formatter.write_str("struct Bounty")
            }

            fn visit_map<V>(self, mut map: V) -> Result<Bounty, V::Error>
                where
                    V: MapAccess<'de>,
            {
                let mut id = None;
                let mut owner_id = None;
                let mut coordinator_id = None;
                let mut file_location = None;
                let mut file_download_protocol = None;
                let mut status = None;
                let mut min_nodes = None;
                let mut bounty_created = None;
                let mut network_required = None;
                let mut gpu_required = None;
                let mut amt_storage = None;
                let mut amt_node_reward = None;
                let mut timeout_seconds = None;
                let mut elected_nodes = None;

                while let Some(key) = map.next_key()? {
                    match key {
                        "id" => {
                            if id.is_some() {
                                return Err(Error::duplicate_field("id"));
                            }
                            id = Some(map.next_value()?);
                        }
                        "owner_id" => {
                            if owner_id.is_some() {
                                return Err(Error::duplicate_field("owner_id"));
                            }
                            owner_id = Some(map.next_value()?);
                        }
                        "coordinator_id" => {
                            if coordinator_id.is_some() {
                                return Err(Error::duplicate_field("coordinator_id"));
                            }
                            coordinator_id = Some(map.next_value()?);
                        }
                        "file_location" => {
                            if file_location.is_some() {
                                return Err(Error::duplicate_field("file_location"));
                            }
                            file_location = Some(map.next_value()?);
                        }
                        "file_download_protocol" => {
                            if file_download_protocol.is_some() {
                                return Err(Error::duplicate_field("file_download_protocol"));
                            }
                            file_download_protocol = Some(map.next_value()?);
                        }
                        "status" => {
                            if status.is_some() {
                                return Err(Error::duplicate_field("status"));
                            }
                            status = Some(map.next_value()?);
                        }
                        "min_nodes" => {
                            if min_nodes.is_some() {
                                return Err(Error::duplicate_field("min_nodes"));
                            }
                            min_nodes = Some(map.next_value()?);
                        }
                        "bounty_created" => {
                            if bounty_created.is_some() {
                                return Err(Error::duplicate_field("bounty_created"));
                            }
                            bounty_created = Some(map.next_value()?);
                        }
                        "network_required" => {
                            if network_required.is_some() {
                                return Err(Error::duplicate_field("network_required"));
                            }
                            network_required = Some(map.next_value()?);
                        }
                        "gpu_required" => {
                            if gpu_required.is_some() {
                                return Err(Error::duplicate_field("gpu_required"));
                            }
                            gpu_required = Some(map.next_value()?);
                        }
                        "amt_storage" => {
                            if amt_storage.is_some() {
                                return Err(Error::duplicate_field("amt_storage"));
                            }
                            amt_storage = Some(map.next_value()?);
                        }
                        "amt_node_reward" => {
                            if amt_node_reward.is_some() {
                                return Err(Error::duplicate_field("amt_node_reward"));
                            }
                            amt_node_reward = Some(map.next_value()?);
                        }
                        "timeout_seconds" => {
                            if timeout_seconds.is_some() {
                                return Err(Error::duplicate_field("timeout_seconds"));
                            }
                            timeout_seconds = Some(map.next_value()?);
                        }
                        "elected_nodes" => {
                            if elected_nodes.is_some() {
                                return Err(Error::duplicate_field("elected_nodes"));
                            }
                            elected_nodes = Some(map.next_value()?);
                        }

                        _ => {}
                    }
                }
                let id = id.ok_or_else(|| Error::missing_field("id"))?;
                let owner_id = owner_id.ok_or_else(|| Error::missing_field("owner_id"))?;
                let coordinator_id =
                    coordinator_id.ok_or_else(|| Error::missing_field("coordinator_id"))?;
                let file_location =
                    file_location.ok_or_else(|| Error::missing_field("file_location"))?;
                let file_download_protocol = file_download_protocol
                    .ok_or_else(|| Error::missing_field("file_download_protocol"))?;
                let status = status.ok_or_else(|| Error::missing_field("status"))?;
                let min_nodes = min_nodes.ok_or_else(|| Error::missing_field("min_nodes"))?;
                let bounty_created =
                    bounty_created.ok_or_else(|| Error::missing_field("bounty_created"))?;
                let network_required =
                    network_required.ok_or_else(|| Error::missing_field("network_required"))?;
                let gpu_required =
                    gpu_required.ok_or_else(|| Error::missing_field("gpu_required"))?;
                let amt_storage = amt_storage.ok_or_else(|| Error::missing_field("amt_storage"))?;
                let amt_node_reward =
                    amt_node_reward.ok_or_else(|| Error::missing_field("amt_node_reward"))?;
                let timeout_seconds =
                    timeout_seconds.ok_or_else(|| Error::missing_field("timeout_seconds"))?;
                let elected_nodes =
                    elected_nodes.ok_or_else(|| Error::missing_field("elected_nodes"))?;
                return Ok(Bounty {
                    id,
                    owner_id,
                    coordinator_id,
                    file_location,
                    file_download_protocol,
                    status,
                    min_nodes,
                    bounty_created,
                    network_required,
                    gpu_required,
                    amt_storage,
                    amt_node_reward,
                    timeout_seconds,
                    elected_nodes,
                    //TODO The below isn't real deserialization
                    answers: UnorderedMap::new(
                        format!("{}-answers", "test").to_string().as_bytes(),
                    ),
                    failed_nodes: UnorderedSet::new(
                        format!("{}-failed-nodes", "test").to_string().as_bytes(),
                    ),
                    successful_nodes: UnorderedSet::new(
                        format!("{}-successful", "test").to_string().as_bytes(),
                    ),
                    unanswered_nodes: UnorderedSet::new(
                        format!("{}-unanswered", "test").to_string().as_bytes(),
                    ),
                    rejected_nodes: UnorderedSet::new(
                        format!("{}-rejected", "test").to_string().as_bytes(),
                    ),
                });
            }
        }
        const FIELDS: &'static [&'static str] = &[
            "id",
            "owner_id",
            "coordinator_id",
            "file_location",
            "file_download_protocol",
            "status",
            "min_nodes",
            "bounty_created",
            "network_required",
            "gpu_required",
            "amt_storage",
            "amt_node_reward",
            "timeout_seconds",
            "elected_nodes",
        ];
        deserializer.deserialize_struct("Bounty", FIELDS, BountyVisitor)
    }
}



impl PartialEq<Self> for Bounty {
    fn eq(&self, other: &Self) -> bool {
        return self.id == other.id
            && self.owner_id == other.owner_id
            && self.coordinator_id == other.coordinator_id
            && self.file_location == other.file_location
            && self.file_download_protocol == other.file_download_protocol
            && self.status == other.status
            && self.min_nodes == other.min_nodes
            && self.timeout_seconds == other.timeout_seconds
            && self.bounty_created == other.bounty_created
            && self.network_required == other.network_required
            && self.gpu_required == other.gpu_required
            && self.amt_storage == other.amt_storage
            && self.amt_node_reward == other.amt_node_reward
            && self.elected_nodes == other.elected_nodes
            && self.answers.len() == other.answers.len() //TODO: Make this a real comparison
            && self.failed_nodes.len() == other.failed_nodes.len() //TODO: Make this a real comparison
            && self.successful_nodes.len() == other.successful_nodes.len() //TODO: Make this a real comparison
            && self.unanswered_nodes.len() == other.unanswered_nodes.len() //TODO: Make this a real comparison
            && self.rejected_nodes.len() == other.rejected_nodes.len(); //TODO: Make this a real comparison
    }
}

impl Default for Bounty {
    fn default() -> Self {
        Self {
            id: "bounty-id".to_string().parse().unwrap(),
            owner_id: "bounty-owner".to_string().parse().unwrap(),
            coordinator_id: "bounty-coordinator".to_string().parse().unwrap(),
            file_location: "".to_string(),
            file_download_protocol: SupportedDownloadProtocols::EMPTY,
            status: BountyStatus::Pending,
            min_nodes: 0,
            timeout_seconds: 30,
            bounty_created: block_timestamp_ms(),
            network_required: false,
            gpu_required: false,
            amt_storage: 0,
            amt_node_reward: 0,
            elected_nodes: Vec::new(),
            answers: UnorderedMap::new("bounty-answers".as_bytes()),
            failed_nodes: UnorderedSet::new("bounty-failed-nodes".as_bytes()),
            successful_nodes: UnorderedSet::new("bounty-successful-nodes".as_bytes()),
            unanswered_nodes: UnorderedSet::new("bounty-unanswered-nodes".as_bytes()),
            rejected_nodes: UnorderedSet::new("bounty-rejected-nodes".as_bytes()),
        }
    }
}

#[near_bindgen]
impl Bounty {
    #[init]
    #[payable]
    #[private] // Only allow creating bounties through coordinator
    pub fn new_bounty(
        id: AccountId,
        file_location: String,
        file_download_protocol: SupportedDownloadProtocols,
        min_nodes: u64,
        timeout_seconds: u64,
        network_required: bool,
        gpu_required: bool,
        amt_storage: u128,
        amt_node_reward: u128,
    ) -> Self {
        Self {
            id: id.clone(),
            owner_id: signer_account_id(),
            coordinator_id: predecessor_account_id(), //predecessor_account_id OR whatever the user specifies
            file_location,
            file_download_protocol,
            status: BountyStatus::Pending,
            min_nodes,
            timeout_seconds,
            bounty_created: block_timestamp_ms(),
            // result: "".to_string(),
            // elected_nodes: UnorderedSet::new(format!("{}-elected", name).to_string().as_bytes()),
            elected_nodes: Vec::new(),
            answers: UnorderedMap::new(format!("{}-answers", &id.clone()).as_bytes()),
            failed_nodes: UnorderedSet::new(format!("{}-failed", &id.clone()).as_bytes()),
            successful_nodes: UnorderedSet::new(
                format!("{}-successful", &id.clone()).as_bytes(),
            ),
            unanswered_nodes: UnorderedSet::new(
                format!("{}-unanswered", &id.clone()).as_bytes(),
            ),
            rejected_nodes: UnorderedSet::new(
                format!("{}-rejected", &id.clone()).as_bytes(),
            ),
            // storage_used: 0,
            network_required,
            gpu_required,
            amt_storage, // Unused storage is refunded to the creator once the contract is closed
            amt_node_reward, // If the bounty is completed, nodes will be reimbursed for spent gas. If it's completed AND successful, nodes get full reward
        }
    }

    //Dumps the result as {$value: $number_of_nodes_with_value}, requiring the bounty creator to manually verify the result
    #[private]
    pub fn get_result(&self) -> HashMap<String, u8> {
        log!("Getting result for bounty {}", self.id);
        let mut res: HashMap<String, u8> = HashMap::new();
        for (_, value) in self.answers.iter() {
            if res.contains_key(&value.solution.clone()) {
                res.insert(
                    value.solution.clone(),
                    res.get(&value.solution.clone()).unwrap() + 1,
                );
            } else {
                res.insert(value.solution.clone(), 1);
            }
        }
        return res;
    }

    pub fn get_payout_strategy(&self) -> PayoutStrategy {
        if self.successful_nodes.len() >= self.min_nodes {
            return PayoutStrategy::SuccessfulNodes;
        } else if self.failed_nodes.len() >= self.min_nodes {
            return PayoutStrategy::FailedNodes;
        } else if self.status == BountyStatus::Cancelled {
            return PayoutStrategy::AllAnsweredNodes;
        } else {
            panic!("Bounty {} is not complete, can't determine payout strategy", self.id);
        }
    }

    pub fn get_amt_reward_per_node(&self) -> Balance {
        return match self.get_payout_strategy() {
            PayoutStrategy::AllAnsweredNodes => self.amt_node_reward / self.answers.len() as u128,
            PayoutStrategy::FailedNodes => self.amt_node_reward / self.failed_nodes.len() as u128,
            PayoutStrategy::SuccessfulNodes => self.amt_node_reward / self.successful_nodes.len() as u128, //Technically could be amt_node_reward/min_nodes
        };
    }
    pub fn get_payout_recipient_ids(&self) -> Vec<AccountId> {
        return match self.get_payout_strategy() {
            PayoutStrategy::AllAnsweredNodes => self.answers.keys().collect(),
            PayoutStrategy::FailedNodes => self.failed_nodes.iter().collect(),
            PayoutStrategy::SuccessfulNodes => self.successful_nodes.iter().collect(),
        };
    }
    pub fn get_payout_recipients_by_payout_claimed(&self, payout_claimed: bool) -> Vec<AccountId> {
        let mut paid_recipients: Vec<AccountId> = Vec::new();
        for id in self.get_payout_recipient_ids() {
            if self.answers.get(&id).unwrap().payout_claimed == payout_claimed {
                paid_recipients.push(id);
            }
        }
        return paid_recipients;
    }
    pub fn get_paid_recipients(&self) -> Vec<AccountId> {
        return self.get_payout_recipients_by_payout_claimed(true);
    }

    pub fn get_unpaid_recipients(&self) -> Vec<AccountId> {
        return self.get_payout_recipients_by_payout_claimed(false);
    }
}
