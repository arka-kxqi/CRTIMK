use std::fmt;

use near_sdk::{AccountId, env, near_bindgen};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::env::signer_account_id;
use near_sdk::serde::{Deserialize, Serialize};

//TODO This struct should be considered when calculating the storage fee.
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Eq, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Node {
    pub id: AccountId,
    pub owner_id: AccountId,
    pub last_run: u64,
    pub last_success: u64,
    pub last_failure: u64,
    pub last_reject: u64,
    pub last_unanswered: u64,
    pub successful_runs: u64,
    pub failed_runs: u64,
    pub unanswered_runs: u64,
    pub rejected_runs: u64,
    pub allow_network: bool,
    pub allow_gpu: bool,
    pub absolute_timeout: u64,
    pub lifetime_earnings: u128,
    pub deposit: u128,
    pub registration_time: u64,
}

#[near_bindgen]
impl Node {
    #[init]
    #[private]
    #[payable]
    pub fn new_node(id: AccountId, absolute_timeout: u64, allow_network: bool, allow_gpu: bool) -> Self {
        Self {
            id,
            owner_id: signer_account_id(),
            last_run: 0,
            last_success: 0,
            last_failure: 0,
            last_reject: 0,
            last_unanswered: 0,
            successful_runs: 0,
            failed_runs: 0,
            unanswered_runs: 0,
            rejected_runs: 0,
            allow_network,
            allow_gpu,
            lifetime_earnings: 0,
            absolute_timeout,
            deposit: env::attached_deposit(),
            registration_time: env::block_timestamp(),
        }
    }
}

impl Default for Node {
    fn default() -> Self {
        Self {
            id: "test-node".parse().unwrap(),
            owner_id: signer_account_id(),
            last_run: 0,
            last_success: 0,
            last_failure: 0,
            last_reject: 0,
            last_unanswered: 0,
            successful_runs: 0,
            failed_runs: 0,
            unanswered_runs: 0,
            rejected_runs: 0,
            allow_network: true,
            allow_gpu: false,
            absolute_timeout: 60000,
            lifetime_earnings: 0,
            deposit: 0,
            registration_time: env::block_timestamp(),
        }
    }
}

impl fmt::Display for Node {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        //TODO get gpu printing
        write!(f, "Node {{ id: {}, owner_id: {}, last_run: {}, last_success: {}, last_failure: {}, successful_runs: {}, failed_runs: {}, GPUS_LOL}}", self.id, self.owner_id, self.last_run, self.last_success, self.last_failure, self.successful_runs, self.failed_runs)
    }
}

