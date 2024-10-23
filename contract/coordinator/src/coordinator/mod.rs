use std::collections::HashMap;
use std::mem::size_of_val;

use near_sdk::{AccountId, Balance, env, log, near_bindgen, Promise, require};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, UnorderedSet};
use near_sdk::env::{
    attached_deposit, block_timestamp, current_account_id, log_str, random_seed, signer_account_id,
    storage_byte_cost,
};
use near_sdk::serde::{Deserialize, Serialize};
use near_units::parse_near;

use crate::bounty::{
    Bounty, BountyStatus, NodeResponse, NodeResponseStatus, SupportedDownloadProtocols,
};
use crate::events::{BountyCompletedLog, BountyCreatedLog, BountyRetryLog, EventLog, EventLogVariant};
use crate::node::Node;

pub const MIN_STORAGE: Balance = parse_near!("0.1 N");
pub const MIN_REWARD: Balance = parse_near!("0.1 N");
pub const EVENT_STANDARD_NAME: &str = "NEP-297";
pub const EVENT_STANDARD_SPEC: &str = "1.0.0";
pub const BOUNTY_CREATED_EVENT_NAME: &str = "BountyCreated";
pub const BOUNTY_COMPLETED_EVENT_NAME: &str = "BountyCompleted";
//How many extra nodes to elect for each bounty to allow for node failures
pub const NODE_PADDING: f64 = 1.25;
#[derive(BorshDeserialize, BorshSerialize, Deserialize, Serialize, Eq, PartialEq, Debug, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum PayoutStrategy {
    SuccessfulNodes,
    //If min_nodes+ succeeds, only successful nodes should get paid
    FailedNodes,
    //If min_nodes+ fails, only failed nodes should get paid
    AllAnsweredNodes, //If a bounty is cancelled, all nodes should get paid
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct Coordinator {
    pub nodes: UnorderedMap<AccountId, Node>,
    pub node_queue: Vec<AccountId>,
    //TODO not sure why this isn't pub
    bounties: UnorderedMap<AccountId, Bounty>,
    pub active_bounties: UnorderedSet<AccountId>,
    pub offline_nodes: UnorderedMap<AccountId, Node>,
    //used to avoid name collisions for bounties
    pub universal_bounty_index: u64,
    pub total_completed_bounties: u64,
    pub total_payouts: Balance,
    pub node_by_owner: UnorderedMap<AccountId, Vec<AccountId>>,
    pub bounty_by_owner: UnorderedMap<AccountId, Vec<AccountId>>,
    // pub gpu_nodes: UnorderedSet<AccountId>,
    // pub network_nodes: UnorderedSet<AccountId>,
    // pub gpu_and_network_nodes: UnorderedSet<AccountId>,
}

// Define the default, which automatically initializes the contract
impl Default for Coordinator {
    fn default() -> Self {
        Self {
            nodes: UnorderedMap::new("coordinator.nodes".as_bytes()),
            node_queue: Vec::new(),
            bounties: UnorderedMap::new("coordinator.bounties".as_bytes()),
            active_bounties: UnorderedSet::new("coordinator.active_bounties".as_bytes()),
            offline_nodes: UnorderedMap::new("coordinator.offline_nodes".as_bytes()),
            universal_bounty_index: 0,
            total_completed_bounties: 0,
            total_payouts: 0,
            node_by_owner: UnorderedMap::new("coordinator.node_by_owner".as_bytes()),
            bounty_by_owner: UnorderedMap::new("coordinator.bounty_by_owner".as_bytes()),
        }
    }
}

// Implement the contract structure
#[near_bindgen]
impl Coordinator {
    #[init]
    #[private] // Public - but only callable by env::current_account_id()
    pub fn init() -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            nodes: UnorderedMap::new("coordinator.nodes".as_bytes()),
            node_queue: Vec::new(),
            bounties: UnorderedMap::new("coordinator.bounties".as_bytes()),
            active_bounties: UnorderedSet::new("coordinator.active_bounties".as_bytes()),
            offline_nodes: UnorderedMap::new("coordinator.bounties".as_bytes()),
            universal_bounty_index: 0,
            total_completed_bounties: 0,
            total_payouts: 0,
            node_by_owner: UnorderedMap::new("coordinator.node_by_owner".as_bytes()),
            bounty_by_owner: UnorderedMap::new("coordinator.bounty_by_owner".as_bytes()),
        }
    }

    pub fn get_node_count(&self) -> u64 {
        return self.nodes.len();
    }

    pub fn get_bounty_count(&self) -> u64 {
        return self.bounties.len();
    }
    pub fn get_offline_node_count(&self) -> u64 {
        return self.offline_nodes.len();
    }

    pub fn get_total_completed_bounties(&self) -> u64 {
        return self.total_completed_bounties;
    }

    pub fn get_nodes_for_owner_count(&self, owner_id: AccountId) -> usize {
        return self.node_by_owner.get(&owner_id).unwrap_or(vec![]).len();
    }
    pub fn get_lifetime_earnings_for_owner(&self, owner_id: AccountId) -> Balance {
        let mut total = 0;
        for node_id in self.node_by_owner.get(&owner_id).unwrap_or(vec![]) {
            total += self.nodes.get(&node_id).unwrap().lifetime_earnings;
        }
        return total;
    }
    pub fn get_bounties_for_owner_count(&self, owner_id: AccountId) -> usize {
        return self.bounty_by_owner.get(&owner_id).unwrap_or(vec![]).len();

    }
    pub fn get_total_payouts(&self) -> Balance {
        return self.total_payouts;
    }

    pub fn get_node(&self, node_id: AccountId) -> Node {
        log!("get_node {}", node_id);
        return self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} is not registered", node_id));
    }

    pub fn get_bounty(&self, bounty_id: AccountId) -> Bounty {
        let bounty = self.bounties.get(&bounty_id).unwrap();
        log!("get_bounty {}", bounty_id);
        return bounty;
    }

    pub fn get_nodes(&self) -> Vec<Node> {
        log!("Fetching all {} nodes", self.nodes.len());
        let mut vec: Vec<Node> = vec![];
        for item in self.nodes.values() {
            vec.push(item);
        }
        return vec;
    }
    // Function I'm testing on the side
    pub fn get_nodes2(&self) -> Vec<(AccountId, Node)> {
        log!("Fetching all {} nodes", self.nodes.len());
        return self.nodes.to_vec();
    }

    pub fn get_nodes_for_owner(&self, owner_id: AccountId) -> Vec<Node> {
        let node_ids = self.node_by_owner.get(&owner_id);
        if node_ids.is_none() {
            return vec![];
        }
        log!(
            "Fetching all {} nodes for owner {}",
            self.nodes.len(),
            owner_id
        );

        let mut nodes: Vec<Node> = vec![];
        for node_id in node_ids.unwrap() {
            let node = self.nodes.get(&node_id);
            if node.is_none() {
                log!(
                    "Node {} not found for owner {}, should clean up later",
                    node_id,
                    owner_id
                );
                continue;
            }
            nodes.push(node.unwrap());
        }
        return nodes;
    }

    pub fn get_bounties(&self) -> Vec<Bounty> {
        log!("Fetching all {} bounties", self.bounties.len());
        let mut vec: Vec<Bounty> = vec![];
        for item in self.bounties.values() {
            vec.push(item);
        }
        return vec;
    }

    pub fn get_bounty_elected_nodes(&self, bounty_id: AccountId) -> Vec<AccountId> {
        let bounty = self.get_bounty_or_panic(bounty_id);
        return bounty.elected_nodes.to_vec();
    }
    pub fn get_unanswered_nodes(&self, bounty_id: AccountId) -> Vec<AccountId> {
        let bounty = self.get_bounty_or_panic(bounty_id);
        return bounty.unanswered_nodes.to_vec();
    }
    pub fn get_successful_nodes(&self, bounty_id: AccountId) -> Vec<AccountId> {
        let bounty = self.get_bounty_or_panic(bounty_id);
        return bounty.successful_nodes.to_vec();
    }
    pub fn get_failed_nodes(&self, bounty_id: AccountId) -> Vec<AccountId> {
        let bounty = self.get_bounty_or_panic(bounty_id);
        return bounty.failed_nodes.to_vec();
    }

    pub fn get_bounty_or_panic(&self, bounty_id: AccountId) -> Bounty {
        return self.bounties.get(&bounty_id).unwrap_or_else(|| {
            panic!(
                "Bounty {} does not exist, cannot get elected nodes",
                bounty_id
            )
        });
    }


    pub fn get_bounties_for_owner(&self, owner_id: AccountId) -> Vec<Bounty> {
        let bounty_ids = self
            .bounty_by_owner
            .get(&owner_id)
            .unwrap_or_else(|| {
                return vec![];
            });
        log!(
            "Fetching all {} bounties for owner {}",
            self.bounties.len(),
            owner_id
        );
        let mut bounties: Vec<Bounty> = vec![];
        for bounty_id in bounty_ids {
            let bounty = self.bounties.get(&bounty_id);
            if bounty.is_none() {
                log!(
                    "Bounty {} not found for owner {}, should clean up later",
                    bounty_id,
                    owner_id
                );
                continue;
            }
            bounties.push(bounty.unwrap());
        }
        return bounties;
    }

    #[payable]
    pub fn register_node(&mut self, name: String, absolute_timeout: u64, allow_network: bool, allow_gpu: bool) -> Node {
        require!(
            env::attached_deposit() >= parse_near!("1N"),
            "Must include a refundable deposit of 1 NEAR to register a node"
        );
        let node_id: AccountId = format!("{}.node.{}", name, signer_account_id())
            .parse()
            .unwrap();
        log!(
            "Registering new node, {}. Owned by: {}",
            node_id,
            signer_account_id()
        );
        require!(
            self.nodes.get(&node_id).is_none(),
            format!("Node already registered: {}", node_id.clone())
        );
        let metadata = Node::new_node(node_id.clone(), absolute_timeout, allow_network, allow_gpu);
        self.nodes.insert(&node_id, &metadata);
        self.node_queue.push(node_id.clone());
        let mut owner_nodes = self
            .node_by_owner
            .get(&signer_account_id())
            .unwrap_or_else(|| vec![]);
        owner_nodes.push(node_id.clone());
        self.node_by_owner
            .insert(&signer_account_id(), &owner_nodes);
        log!("finished adding node to coordinator, data: {}", metadata);

        return self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Failed to get freshly registered node: {}", node_id));
    }

    pub fn update_node(
        &mut self,
        node_id: AccountId,
        allow_network: bool,
        allow_gpu: bool,
        absolute_timeout: u64,
    ) -> Node {
        let mut node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} is not registered", node_id));
        require!(
            &node.owner_id == &signer_account_id() || signer_account_id() == current_account_id(),
            "Only the owner or the coordinator can update a node"
        );
        log!(
            "Updating node, {} with values: allow_network={} allow_gpu={}",
            node_id,
            allow_network,
            allow_gpu
        );
        node.allow_network = allow_network;
        node.allow_gpu = allow_gpu;
        node.absolute_timeout = absolute_timeout;
        self.nodes.insert(&node_id, &node);
        return node;
    }

    pub fn remove_node(&mut self, node_id: AccountId) -> Promise {
        println!("attempting to remove node with id {}", node_id);
        let node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} is not registered", node_id));
        require!(
            signer_account_id() == node.owner_id || signer_account_id() == current_account_id(),
            "Only the owner of the node or the coordinator can remove it"
        );
        self.node_queue.retain(|x| x != &node_id);
        let mut owner_nodes = self
            .node_by_owner
            .get(&node.owner_id)
            .unwrap_or_else(|| vec![]);
        owner_nodes.retain(|x| x != &node_id);
        if owner_nodes.len() == 0 {
            log!("owner has no more registered nodes, removing them from owner list");
            self.node_by_owner.remove(&node.owner_id);
        } else {
            self.node_by_owner.insert(&node.owner_id, &owner_nodes);
        }

        //We do not remove the nodes from self.nodes, since this has data we need.
        log!(
            "removed node with id {}, refunding deposit of {}",
            node_id,
            node.deposit
        );
        return Promise::new(node.owner_id).transfer(node.deposit);
    }

    // Only intended for developmment, should be removed before deploying to production
    //TODO untested
    pub fn remove_all_nodes(&mut self) {
        self.nodes.clear();
    }

    //TODO untested
    pub fn set_node_offline(&mut self, node_id: AccountId, offline: bool) -> Node {
        let removed: Node;
        if offline {
            log!("Moving node {account_id} to offline");
            let node = self
                .nodes
                .get(&node_id)
                .unwrap_or_else(|| panic!("Could not find node to set offline"));
            require!(
                node.owner_id == signer_account_id() || signer_account_id() == current_account_id(),
                "Only the owner of the node or the coordinator can set it offline"
            );
            removed = self.nodes.remove(&node_id).unwrap();
            self.offline_nodes.insert(&node_id, &removed);
        } else {
            log!("Bringing node {account_id} online");
            let node = self
                .offline_nodes
                .get(&node_id)
                .unwrap_or_else(|| panic!("Could not find node to set online"));
            require!(
                node.owner_id == signer_account_id() || signer_account_id() == current_account_id(),
                "Only the owner of the node or the coordinator can set it offline"
            );
            removed = self.offline_nodes.remove(&node_id).unwrap();
            self.nodes.insert(&node_id, &removed);
        }
        return removed;
    }


    #[private]
    pub(crate) fn rand_u64() -> u64 {
        //TODO Random seed may have security vulnerabilities. This is a risk we will likely have to take, but should read docs
        let seeds = random_seed();
        let mut seed: u64 = seeds[0] as u64;
        for i in 1..(64 / 8) {
            seed = seed * seeds[i] as u64;
        }
        return seed;
    }

    #[private]
    pub(crate) fn node_qualified(node: &Node, bounty: &Bounty) -> bool {
        if !node.allow_network && bounty.network_required {
            log!("Node {} does not allow network, but bounty requires it, rejecting election", node.id);
            return false;
        }
        if !node.allow_gpu && bounty.gpu_required {
            log!("Node {} does not allow gpu, but bounty requires it, rejecting election", node.id);
            return false;
        }
        //TODO This conversion from seconds to milli is sloppy
        if node.absolute_timeout < bounty.timeout_seconds * 1000 {
            log!("Node {} has a timeout of {} which is less than the required timeout of {}", node.id, node.absolute_timeout, bounty.timeout_seconds);
            return false;
        }
        return true;
    }

    pub fn get_bounty_answer_counts(&self, bounty_id: AccountId) -> HashMap<String, u64> {
        let bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        let mut map: HashMap<String, u64> = HashMap::new();

        map.insert("answers".to_string(), bounty.answers.len());
        map.insert("failed_nodes".to_string(), bounty.failed_nodes.len());
        map.insert("successful_nodes".to_string(), bounty.successful_nodes.len());
        map.insert("rejected_nodes".to_string(), bounty.rejected_nodes.len());
        map.insert("unanswered_nodes".to_string(), bounty.unanswered_nodes.len());
        return map;
    }
    #[private]
    pub fn get_node_padding(&self, min_nodes: u64) -> u64 {
           return (min_nodes as f64 * NODE_PADDING).ceil() as u64;
    }
    #[payable]
    pub fn create_bounty(
        &mut self,
        file_location: String,
        file_download_protocol: SupportedDownloadProtocols,
        min_nodes: u64,
        timeout_seconds: u64,
        network_required: bool,
        gpu_required: bool,
        amt_storage: String,
        amt_node_reward: String,
    ) -> Bounty {
        let amt_storage: u128 = amt_storage.parse().unwrap();
        let amt_node_reward: u128 = amt_node_reward.parse().unwrap();
        let total_nodes = self.get_node_padding(min_nodes);
        require!(
            attached_deposit() == amt_storage + amt_node_reward,
            "Attached deposit must be equal to the sum of the storage and node reward amounts"
        );
        require!(
            amt_storage >= MIN_STORAGE,
            "Refundable storage deposit must be at least 0.1N"
        );
        //0.1N ~10KB, should be more than enough for most
        require!(
            amt_node_reward >= MIN_REWARD,
            "Node reward must be at least 0.1N"
        );
        require!(
            self.get_node_count() >= total_nodes,
            "Not enough nodes registered for bounty"
        );
        require!(
            total_nodes.clone() <= self.nodes.len(),
            "Total nodes cannot be greater than the number of nodes available in the coordinator"
        );
        // Truncate the block timestamp to reduce the overall length of the bounty id
        let bounty_key: AccountId = format!(
            "{}-{}.bounty.{}",
            self.universal_bounty_index,
            (block_timestamp() % 1000000000),
            signer_account_id()
        )
            .parse()
            .unwrap();
        log!("Bounty id is: {}", bounty_key);
        require!(
            self.bounties.get(&bounty_key).is_none(),
            "Bounty already exists"
        );
        let mut bounty = Bounty::new_bounty(
            bounty_key.clone(),
            file_location,
            file_download_protocol,
            min_nodes,
            timeout_seconds,
            network_required,
            gpu_required,
            amt_storage,
            amt_node_reward,
        );
        require!(
            bounty.owner_id == signer_account_id(),
            "The bounty's owner id must be the signer"
        ); //Cautionary check. We don't want to risk preventing the creator from cancelling the bounty to withdraw their funds


        bounty.elected_nodes = self.elect_nodes(&bounty, total_nodes as usize);
        let mut owner_bounties = self
            .bounty_by_owner
            .get(&signer_account_id())
            .unwrap_or_else(|| vec![]);
        owner_bounties.push(bounty.id.clone());
        self.universal_bounty_index += 1;
        self.bounty_by_owner
            .insert(&signer_account_id(), &owner_bounties);
        self.bounties.insert(&bounty_key, &bounty);
        self.active_bounties.insert(&bounty_key);

        let bounty_created_log: EventLog = EventLog {
            standard: EVENT_STANDARD_NAME.to_string(),
            version: EVENT_STANDARD_SPEC.to_string(),
            event: EventLogVariant::BountyCreated(BountyCreatedLog {
                coordinator_id: current_account_id(),
                bounty_id: bounty_key.clone(),
                node_ids: bounty.elected_nodes.clone(),
                message: None,
            }),
        };

        log_str(&bounty_created_log.to_string());
        return bounty;
    }

    #[private]
    pub fn elect_nodes(&mut self, bounty: &Bounty, total_elections: usize) -> Vec<AccountId>{
        let mut unelected_nodes: Vec<AccountId> = vec![];
        let mut elected_nodes: Vec<AccountId> = vec![];
        while elected_nodes.len() < total_elections {
            let key: AccountId;
            if self.node_queue.len() == 1 {
                key = self.node_queue.pop().unwrap();
                if !Coordinator::node_qualified(&self.nodes.get(&key).unwrap(), &bounty) {
                    log!("Node {} is not qualified for bounty {}. Since this is the only node left to elect, panic", key, bounty.id);
                    panic!("Not enough qualified nodes to fill bounty");
                }
                log!("elected {} (only node in queue)", key);
            } else {
                let seed = Coordinator::rand_u64();
                let random_node = seed as usize % self.node_queue.len();
                log!(
                    "electing node at: {}, (seed: {}, index: {}, node_queue_len: {}, supposed_node: {})",
                    random_node,
                    seed as usize,
                    random_node,
                    self.node_queue.len() as u64,
                    seed as usize % self.node_queue.len()
                );
                // let key = self.node_queue.swap_remove(random_node); // O(1) by replacing removed with last element
                // Remove node to eliminate possibility of collisions
                key = self.node_queue.swap_remove(random_node as usize);
                if !Coordinator::node_qualified(&self.nodes.get(&key).unwrap(), &bounty) {
                    log!("Node {} is not qualified for bounty {}. Skipping", key, bounty.id);
                    unelected_nodes.push(key);
                    continue;
                }
            }
            require!(!bounty.elected_nodes.contains(&key), "Node already elected");
            elected_nodes.push(key.clone());
        }

        for node in &elected_nodes {
            self.node_queue.push(node.clone());
            log!("Elected node: {}", node);
        }
        for node in unelected_nodes {
            log!("Restoring unelected node: {}", node);
            self.node_queue.push(node.clone());
        }
        return elected_nodes;
    }
    #[private]
    pub fn send_retry_event(&self, bounty_id: &AccountId, nodes: &Vec<AccountId>) {
        require!(self.bounties.get(&bounty_id).is_some(), "Bounty does not exist");
        let bounty_request_retry_log: EventLog = EventLog {
            standard: EVENT_STANDARD_NAME.to_string(),
            version: EVENT_STANDARD_SPEC.to_string(),
            event: EventLogVariant::BountyRetry(BountyRetryLog {
                coordinator_id: current_account_id(),
                bounty_id: bounty_id.clone(),
                node_ids: nodes.clone(),
                message: Some("".to_string()),
            }),
        };
        log_str(&bounty_request_retry_log.to_string());
    }

    //View function to fetch an answer that can only be run after the bounty has been completed
    pub fn get_answer(&self, bounty_id: AccountId, node_id: AccountId) -> NodeResponse {
        let bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(bounty.status != BountyStatus::Pending, "You can only view answers of bounties that are complete or cancelled. Use call_get_answer if you need to get the answer for an inflight bounty.");
        let _node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} does not exist", node_id));
        let answer = bounty.answers.get(&node_id).unwrap_or_else(|| {
            panic!(
                "Node {} has not submitted an answer for bounty {}",
                node_id, bounty_id
            )
        });
        return answer;
    }

    // Paid version of get_answer that requires gas to run (due to signer_account_id())
    // Currently this is only used in tests
    pub fn call_get_answer(&self, bounty_id: AccountId, node_id: AccountId) -> NodeResponse {
        log!("Getting answer for bounty {bounty_id} from node {node_id}");
        let bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(bounty.status == BountyStatus::Pending, "This function can only be used on pending bounties. Since this bounty is closed, use 'get_answer' instead");
        require!(
            bounty.elected_nodes.contains(&node_id),
            "Node is not elected for this bounty"
        );
        let node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} does not exist", node_id));
        log!("Checking whether signer is either the owner of the node, or the coordinator");
        require!(signer_account_id() == current_account_id() //Coordinator contract
            || signer_account_id() == node.owner_id, "Only the node owner or the coordinator contract can retrieve a node's answer from a pending bounty");
        log!("node is either the owner or the coordinator, checking elected nodes");
        let answer = bounty.answers.get(&node_id).unwrap_or_else(|| {
            panic!(
                "Node {} has not submitted an answer for bounty {}",
                node_id, bounty_id
            )
        });
        return answer;
    }

    pub fn cancel_bounty(&mut self, bounty_id: AccountId) {
        let mut bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(
            bounty.status == BountyStatus::Pending,
            "Bounty must be pending to be cancelled"
        );
        require!(
            bounty.owner_id == signer_account_id() || signer_account_id() == current_account_id(),
            "Only the bounty owner or the coordinator contract can cancel a bounty"
        );
        self.close_bounty(&mut bounty, true);
        self.bounties.insert(&bounty_id, &bounty);
    }

    pub fn cancel_all_my_bounties(&mut self) {
        let owner_bounties = self
            .bounty_by_owner
            .get(&signer_account_id())
            .unwrap_or_else(|| vec![]);
        for bounty_id in owner_bounties {
            self.cancel_bounty(bounty_id.clone());
        }
    }

    pub fn should_post_answer(&self, bounty_id: AccountId, node_id: AccountId) -> bool {
        log!(
            "Checking if node {} should post answer for bounty {}",
            node_id,
            bounty_id
        );
        let bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        self.nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} does not exist", node_id));

        //TODO Check if bounty has enough storage!!
        if bounty.status != BountyStatus::Pending {
            log!("Should not publish, bounty is complete ({})", bounty.status);
            return false;
        } else if !bounty.elected_nodes.contains(&node_id) {
            log!("Should not publish, {} is not an elected node", &node_id);
            return false; // You aren't an elected node
        } else if bounty.answers.get(&node_id).is_some() {
            log!(
                "Should not publish, {} has already submitted an answer",
                &node_id
            );
            return false; // You have already posted an answer
        } else if bounty.successful_nodes.len() >= bounty.min_nodes {
            log!("Should not publish, we have enough successful nodes to close the bounty");
            return false;
        } else if bounty.failed_nodes.len() >= bounty.min_nodes {
            log!("Should not publish, we have enough failed nodes to close the bounty");
            return false;
        }
        //TODO Should check if we have enough successful answers and return no if we're evaluating them
        log!("Should publish, {} is elected, has not submitted an answer, and the bounty isn't complete", node_id);
        return true;
    }

    pub fn reject_bounty(
        &mut self,
        bounty_id: AccountId,
        node_id: AccountId,
        message: String,
    ) -> NodeResponse {
        let mut bounty = self
            .bounties
            .get(&bounty_id.clone())
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        let mut node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} does not exist", bounty_id));
        require!(
            signer_account_id() == node.owner_id,
            "Only the node owner can reject a bounty"
        );
        let response =
            NodeResponse::new_node_response(node_id.clone(), "".to_string(), message, NodeResponseStatus::REJECT);
        bounty.rejected_nodes.insert(&node_id);
        bounty.answers.insert(&node_id, &response);
        node.rejected_runs = node.rejected_runs + 1;
        node.last_reject = block_timestamp();
        self.nodes.insert(&node_id, &node);
        self.bounties.insert(&bounty_id, &bounty);
        return response;
    }

    // Post your answer, and then if the bounty is complete, close the bounty
    // Closing the bounty should be separate from posting the answer in the final product, but bounty creators
    // aren't necessarily running nodes, so we need to figure out a way to delegate it to someone in the pool
    pub fn post_answer(
        &mut self,
        bounty_id: AccountId,
        node_id: AccountId,
        answer: String,
        message: String,
        status: NodeResponseStatus,
    ) -> NodeResponse {
        let mut bounty = self
            .bounties
            .get(&bounty_id.clone())
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        let mut node = self
            .nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("Node {} does not exist", bounty_id));
        require!(signer_account_id() == node.owner_id,"Only the node owner can post an answer");
        require!(bounty.status == BountyStatus::Pending, "Bounty is complete, no more answers can be published");
        require!(bounty.elected_nodes.contains(&node_id), "You are not an elected node");
        require!(bounty.answers.get(&node_id).is_none(),"You have already submitted an answer");
        log!(
            "Publishing answer to {} from {} (owner: {}). Answer: {}, Timestamp: {}, Status: {}",
            &bounty_id,
            &node_id,
            signer_account_id(),
            answer,
            block_timestamp(),
            status
        );
        //
        let node_response = NodeResponse::new_node_response(node_id.clone(), answer.clone(), message.clone(), status.clone());
        let estimated_storage = storage_byte_cost() * size_of_val(&node_response) as u128;
        let used_storage = storage_byte_cost() * size_of_val(&bounty) as u128;

        log!("Estimated storage cost for answer {}, bounty has used {}, has {} left",
            estimated_storage,
            used_storage,
            bounty.amt_storage - used_storage
        );
        require!(estimated_storage < (bounty.amt_storage),
            "Not enough storage left to store answer");

        bounty.answers.insert(&node_id, &node_response.clone());
        bounty.unanswered_nodes.remove(&node_id);
        if status == NodeResponseStatus::SUCCESS {
            node.successful_runs += 1;
            node.last_success = block_timestamp();
            bounty.successful_nodes.insert(&node_id);
        } else if status == NodeResponseStatus::FAILURE {
            node.failed_runs += 1;
            node.last_failure = block_timestamp();
            bounty.failed_nodes.insert(&node_id);
        } else if status == NodeResponseStatus::REJECT {
            node.rejected_runs += 1;
            node.last_reject = block_timestamp();
            bounty.rejected_nodes.insert(&node_id);
        } else {
            panic!(
                "Encountered unexpected node status {}, can't determine the state of the bounty",
                status
            );
        }


        if bounty.successful_nodes.len() == bounty.min_nodes || bounty.failed_nodes.len() == bounty.min_nodes {
            self.close_bounty(&mut bounty, false);
        }

        // After changing the nested vec (bounty.bounties) we MUST reinsert it into the map (self.bounties) to register the change in storage.
        self.nodes.insert(&node_id, &node); // Node had failure or success ticked, so update it now.
        self.bounties.insert(&bounty_id, &bounty);
        return node_response;
    }

    pub fn should_collect_reward(&self, node_id: AccountId, bounty_id: AccountId) -> bool {
        let bounty = self.bounties.get(&bounty_id).unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        let node_response = bounty.answers.get(&node_id).unwrap_or_else(|| panic!("Node {} has not submitted an answer to bounty {}", node_id, bounty_id));
        let payout_strategy = bounty.get_payout_strategy();
        require!(self.nodes.get(&node_id).is_some(), "Node does not exist");
        require!(bounty.elected_nodes.contains(&node_id), "You are not elected for this bounty");
        require!(bounty.status != BountyStatus::Pending, "Cannot collect rewards for pending bounties");
        require!(node_response.payout_claimed == false, "You have already claimed your payout");

        return match payout_strategy {
            PayoutStrategy::AllAnsweredNodes => true,
            PayoutStrategy::FailedNodes => node_response.status == NodeResponseStatus::FAILURE,
            PayoutStrategy::SuccessfulNodes => node_response.status == NodeResponseStatus::SUCCESS,
        };
    }

    pub fn collect_reward(&mut self, node_id: AccountId, bounty_id: AccountId) -> Promise {
        //Should collect reward has most preflight checks for this function
        require!(self.should_collect_reward(node_id.clone(), bounty_id.clone()), "You are not eligible to collect a reward");
        let mut node = self.nodes.get(&node_id).unwrap_or_else(|| panic!("Node {} does not exist", node_id));
        let mut bounty = self.bounties.get(&bounty_id).unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        let mut node_response = bounty.answers.get(&node_id).unwrap_or_else(|| panic!("Node {} has not submitted an answer to bounty {}", node_id, bounty_id));

        let payout = bounty.get_amt_reward_per_node();
        log!("Collecting reward of {} for bounty {} for node {}", payout, bounty_id, node_id);

        node_response.payout_claimed = true;
        bounty.answers.insert(&node_id, &node_response);
        self.bounties.insert(&bounty_id, &bounty);

        node.lifetime_earnings += payout;
        self.nodes.insert(&node_id, &node);
        self.total_payouts += payout;
        return Promise::new(node.owner_id).transfer(payout);
    }


    #[private]
    pub fn close_bounty(&mut self, bounty: &mut Bounty, cancel: bool) -> Promise {
        require!(bounty.status == BountyStatus::Pending, "Bounty is already closed");
        if !cancel {
            require!(bounty.successful_nodes.len() >= bounty.min_nodes || bounty.failed_nodes.len() >= bounty.min_nodes, "Bounty does not have enough answers to be closed. If you are the owner, you may cancel the bounty instead.");
        }
        log!("Closing bounty {}", bounty.id);

        if cancel {
            bounty.status = BountyStatus::Cancelled;
        } else if bounty.successful_nodes.len() >= bounty.min_nodes {
            log!("Bounty is complete, at least {} nodes have responded successfully. Closing bounty now.", bounty.min_nodes);
            bounty.status = BountyStatus::Success;
        } else if bounty.failed_nodes.len() >= bounty.min_nodes {
            log!("Bounty is complete but failed because the number of failed nodes ({}) has exceeded the min number of nodes required for success ({})", bounty.failed_nodes.len(), bounty.min_nodes);
            bounty.status = BountyStatus::Failed;
        } else {
            panic!("Cannot find the bounty status upon closing. Has the enum been updated?");
        }

        // Don't check the signer. Anyone can attempt to close the bounty once we've received min nodes
        if !cancel {
            log!("Marking unanswered nodes");
            for node_id in bounty.unanswered_nodes.iter() {
                log!("Node {} did not respond to bounty {}", node_id, bounty.id);
                let node_option = self.nodes.get(&node_id);
                if node_option.is_none() {
                    log!("Node {} does not exist, can't mark unanswered", node_id);
                    continue;
                }
                let mut node = node_option.unwrap();
                node.last_unanswered = block_timestamp();
                node.unanswered_runs += 1;
                self.nodes.insert(&node_id, &node);
            }
        } else {
            log!("Bounty was cancelled, will not mark unanswered nodes");
        }

        let bounty_completed_log: EventLog = EventLog {
            standard: EVENT_STANDARD_NAME.to_string(),
            version: EVENT_STANDARD_SPEC.to_string(),
            event: EventLogVariant::BountyCompleted(BountyCompletedLog {
                coordinator_id: current_account_id(),
                bounty_id: bounty.id.clone(),
                node_ids: bounty.elected_nodes.clone(),
                reward_recipients: bounty.get_payout_recipient_ids(),
                outcome: bounty.status.clone(),
                payout_strategy: bounty.get_payout_strategy(),
                message: None,
            }),
        };

        log_str(&bounty_completed_log.to_string());

        // Update coordinator stats
        self.total_completed_bounties += if cancel { 0 } else { 1 };
        self.active_bounties.remove(&bounty.id);
        //Since this function mutates, insert the bounty back into the map
        self.bounties.insert(&bounty.id, &bounty);
        //Return unused storage deposit to bounty owner
        let storage_used = storage_byte_cost() * size_of_val(&bounty) as u128;
        return Promise::new(bounty.owner_id.clone()).transfer(bounty.amt_storage - storage_used);
    }

    //TODO below can be optimized with bounty.get_unpaid_nodes()/similarly named
    //If an answered node is deleted from an in-flight bounty, attempt to refund the reward to the bounty owner AFTER 1 week has passed
    pub fn reclaim_reward_from_dropped_nodes(&self, bounty_id: &AccountId) -> Promise {
        let bounty = self.bounties.get(&bounty_id).unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(bounty.bounty_created + 604800000000000 < block_timestamp(), "Bounty is not old enough to reclaim rewards from dropped nodes");

        let mut additional_bounty_refund: Balance = 0;
        for (node_id, answer) in bounty.answers.iter() {
            let node_option = self.nodes.get(&node_id);
            if node_option.is_some() {
                log!("Node {} is not deleted, cannot attempt to reclaim reward", node_id);
                continue;
            }
            if answer.payout_claimed {
                log!("Node {} is deleted, but has already been paid for this bounty", node_id);
                continue;
            }
            let payout = bounty.get_amt_reward_per_node();
            log!("Node {} is deleted and hasn't reclaimed reward in a week, refunding {} to {}", node_id, bounty.owner_id, payout);
            additional_bounty_refund += payout;
        }

        return Promise::new(bounty.owner_id.clone()).transfer(additional_bounty_refund);
    }


    // Returns a map of {Solution: Number of nodes with solution}
    // Probably not the most optimal way to render the result
    pub fn get_bounty_result(&self, bounty_id: AccountId) -> HashMap<String, u8> {
        let bounty = self
            .bounties
            .get(&bounty_id)
            .unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(
            bounty.status != BountyStatus::Pending,
            "Bounty must be complete or cancelled to get result"
        );
        return bounty.get_result();
    }


    #[payable]
    pub fn add_storage_deposit(&mut self, bounty_id: AccountId) -> Promise {
        require!(
            self.bounties.get(&bounty_id).is_some(),
            "Bounty does not exist"
        );
        let mut bounty = self.bounties.get(&bounty_id).unwrap();
        require!(
            bounty.owner_id == signer_account_id() || bounty.coordinator_id == current_account_id(),
            "Only the owner of the bounty or the coordinator can add to the deposit"
        );
        bounty.amt_storage += attached_deposit();
        self.send_retry_event(&bounty_id, &bounty.elected_nodes);
        self.bounties.insert(&bounty_id, &bounty);

        return Promise::new(current_account_id()).transfer(attached_deposit());
    }


    #[payable]
    pub fn add_node_reward_deposit(&mut self, bounty_id: AccountId) -> Promise {
        require!(
            self.bounties.get(&bounty_id).is_some(),
            "Bounty does not exist"
        );
        let mut bounty = self.bounties.get(&bounty_id).unwrap();
        require!(
            bounty.owner_id == signer_account_id() || bounty.coordinator_id == current_account_id(),
            "Only the owner of the bounty or the coordinator can add to the deposit"
        );
        bounty.amt_node_reward += attached_deposit();
        self.send_retry_event(&bounty_id, &bounty.elected_nodes);
        self.bounties.insert(&bounty_id, &bounty);
        return Promise::new(current_account_id()).transfer(attached_deposit());
    }

    // When a bounty is stalled due to offline nodes, this can redo the in-flight elections to try it against a new set of nodes
    pub fn reelect_unanswered_nodes(&mut self, bounty_id: AccountId){
        let mut bounty = self.bounties.get(&bounty_id).unwrap_or_else(|| panic!("Bounty {} does not exist", bounty_id));
        require!(bounty.status == BountyStatus::Pending, "Bounty must be in-flight to reelect nodes");

        //TODO Do a compare of bounty created to block timestamp to ensure reelection can only happen after timeout

        let mut existing_elections: Vec<AccountId> = vec![];
        let mut timed_out_nodes: Vec<AccountId> = vec![];
        for node_id in bounty.elected_nodes.iter() {
            if bounty.answers.get(&node_id).is_some() {
                existing_elections.push(node_id.clone());
            } else {
                timed_out_nodes.push(node_id.clone());
            }
        }
        bounty.elected_nodes.retain(|node_id| bounty.answers.get(&node_id).is_some());
        let mut new_elections = self.elect_nodes(&bounty, timed_out_nodes.len());
        existing_elections.append(&mut new_elections);

        bounty.elected_nodes = existing_elections;

        for node_id in timed_out_nodes.iter() {
            bounty.unanswered_nodes.remove(&node_id);
        }
        for node_id in new_elections.iter() {
            bounty.unanswered_nodes.insert(&node_id);
        }
        self.bounties.insert(&bounty_id, &bounty);

        //We only need newly elected nodes in the retry event, including all elections would waste compute on nodes that have already answered
        self.send_retry_event(&bounty_id, &new_elections);
    }
}

/*
* #[cfg(not(target_arch = "wasm32"))]
* pub mod test_utils;
*/

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 */
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn can_register_node() {
        let mut coordinator = Coordinator::default();
        let name = "test".to_string();
        let account_id: AccountId = format!("{}.node.{}", name, signer_account_id())
            .parse()
            .unwrap();
        let node = coordinator.register_node(name, 60000, true, true);

        assert_eq!(
            node.owner_id,
            signer_account_id(),
            "Owner id should be current account id"
        );
        assert_eq!(coordinator.get_node_count(), 1, "Node count should be 1");
        assert!(
            coordinator.nodes.get(&account_id).is_some(),
            "Should be able to retrieve node"
        );
        assert!(
            coordinator.get_nodes().contains(&node),
            "Should be able to retrieve node from full listing"
        );
    }

    #[test]
    fn can_mark_node_offline() {
        let mut coordinator = Coordinator::default();
        let name = "test".to_string();
        let _account_id: AccountId = format!("{}.node.{}", name, current_account_id().to_string())
            .parse()
            .unwrap();
        let _node = coordinator.register_node(name, 60000, true, true);
        //TODO
    }

    // #[test]
    // fn can_register_bounty() {
    //     let mut coordinator = Coordinator::default();
    //     for x in 0..3 {
    //         coordinator.register_node(format!("test{}", x));
    //     }
    //     assert_eq!(coordinator.get_node_count(), 3, "Node count should be 3");
    //     let name = "test-bounty".to_string();
    //     let bounty = coordinator.create_bounty(
    //         name.clone(),
    //         "https://github.com/ad0ll/docker-hello-world".to_string(),
    //         SupportedDownloadProtocols::GIT,
    //         3,
    //         3,
    //         true,
    //         true,
    //         parse_near!("0.5N").to_string(),
    //         parse_near!("2N").to_string(),
    //     );
    //     assert_eq!(coordinator.get_bounty_count(), 1, "Bounty count should be 1");
    //     let bounty_key: AccountId = format!("{}.bounty.{}", name, current_account_id().to_string()).parse().unwrap();
    //     require!(coordinator.bounties.get(&bounty_key).is_some(), "Bounty should be retrievable");
    //     require!(coordinator.get_bounties().contains(&bounty), "Bounty should be retrievable from full listing");
    // }
    // #[test]
    // fn can_increase_storage_and_reward_amt() {
    //     //TODO Reduce copying and pasting by making these standalone
    //     let mut coordinator = Coordinator::default();
    //     for x in 0..3 {
    //         coordinator.register_node(format!("test{}", x));
    //     }
    //     assert_eq!(coordinator.get_node_count(), 3, "Node count should be 3");
    //     let name = "test-bounty".to_string();
    //     let bounty = coordinator.create_bounty(
    //         name.clone(),
    //         "https://github.com/ad0ll/docker-hello-world".to_string(),
    //         SupportedDownloadProtocols::GIT,
    //         3,
    //         3,
    //         true,
    //         true,
    //         parse_near!("0.5N").to_string(),
    //         parse_near!("2N").to_string(),
    //     );
    //     assert_eq!(coordinator.get_bounty_count(), 1, "Bounty count should be 1");
    //     let bounty_key: AccountId = format!("{}.bounty.{}", name, current_account_id().to_string()).parse().unwrap();
    //     require!(coordinator.bounties.get(&bounty_key).is_some(), "Bounty should be retrievable");
    //     require!(coordinator.get_bounties().contains(&bounty), "Bounty should be retrievable from full listing");
    // }
}
