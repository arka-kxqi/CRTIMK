use std::collections::HashMap;
use std::fs;
use std::future::Future;

use anyhow::Error;
use chrono::Utc;
use near_sdk::env::{block_timestamp, block_timestamp_ms, random_seed};
use near_sdk::serde_json::json;
use near_sdk::{env, AccountId};
use near_units::parse_near;
use near_workspaces::network::Sandbox;
use near_workspaces::{Account, Contract, Worker};

use coordinator::bounty::{Bounty, BountyStatus, NodeResponse, NodeResponseStatus};
use coordinator::node::Node;

pub async fn setup_coordinator(worker: Worker<Sandbox>) -> anyhow::Result<Contract> {
    println!("Deploying coordinator contract");
    let paths = fs::read_dir("./").unwrap();

    for path in paths {
        println!("Name: {}", path.unwrap().path().display())
    }
    let coordinator_wasm_filepath = "../target/wasm32-unknown-unknown/release/coordinator.wasm";
    let coordinator_wasm = std::fs::read(coordinator_wasm_filepath).unwrap();
    let coordinator_contract = worker.dev_deploy(&coordinator_wasm).await?;
    coordinator_contract
        .call("init")
        .max_gas()
        .args_json(json!({}))
        .transact()
        .await?
        .into_result()?;
    println!("coordinator contract initialized");
    return Ok(coordinator_contract);
}

// pub async fn create_nodes(coordinator_contract: Contract, accounts: Vec<Account>, n_per_account: u64) -> Result<HashMap<AccountId, Vec<Node>>, Error> {
pub async fn create_nodes(
    coordinator_contract: &Contract,
    accounts: Vec<Account>,
    n_per_account: u64,
) -> Result<HashMap<AccountId, Node>, Error> {
    println!("Creating {} nodes", accounts.len() * n_per_account as usize);
    let mut res: HashMap<AccountId, Node> = HashMap::new();
    for account in accounts {
        // let mut tx = account.batch(coordinator_contract.id());
        println!("Creating {} nodes for {}", n_per_account, account.id());
        for i in 0..n_per_account {
            println!("bootstrapping node: {}", i);
            let name = format!("test-node{}", i.clone());
            println!("name: {}", name);
            println!(
                "account balance for {}: {}",
                account.id(),
                account.view_account().await?.balance
            );
            let node_id: AccountId = format!("{}.node.{}", name, env::current_account_id())
                .parse()
                .unwrap();
            println!("planned name: {}", node_id);
            let node: Node = account
                .call(coordinator_contract.id(), "register_node")
                .args_json(json!({
                    "name": name,
                }))
                .max_gas()
                .transact()
                .await?
                .json()?;
            println!("finished bootstrapping node: {}", i);
            res.insert(node.id.clone(), node);
        }
        // let _res = tx.transact().await?.into_result()?;
    }

    return Ok(res);
}

pub async fn get_node_count(coordinator_contract: &Contract) -> anyhow::Result<u64> {
    let node_count: u64 = coordinator_contract
        .call("get_node_count")
        .args_json(json!({}))
        .view()
        .await?
        .json()?;
    println!("Checked for node count, received: {}", node_count);
    return Ok(node_count);
}

pub async fn get_bounty_count(coordinator_contract: Contract) -> anyhow::Result<u64> {
    println!("Checking for bounty count");
    // let bounty_count: u64 = coordinator_contract
    let res = coordinator_contract
        .call("get_bounty_count")
        .args_json(json!({}))
        .view()
        .await?
        .json()?;
    println!("Checked for bounty count, received: {:?}", res);
    return Ok(res);
}

pub async fn get_bounty(
    coordinator_contract: &Contract,
    bounty_id: AccountId,
) -> anyhow::Result<Bounty> {
    println!("Checking for bounty {}", bounty_id);
    let bounty: Bounty = coordinator_contract
        .call("get_bounty")
        .args_json(json!({ "bounty_id": bounty_id }))
        .view()
        .await?
        .json()?;
    println!("Checked for bounty, received: {:?}", bounty.id);
    return Ok(bounty);
}

pub async fn get_bounties(coordinator_contract: &Contract) -> anyhow::Result<Vec<Bounty>> {
    println!("Checking for bounties");
    let bounties: Vec<Bounty> = coordinator_contract
        .call("get_bounties")
        .args_json(json!({}))
        .view()
        .await?
        .json()?;
    println!("Checked for bounty count, received: {}", bounties.len());
    return Ok(bounties);
}

pub async fn get_nodes(coordinator_contract: &Contract) -> anyhow::Result<Vec<Node>> {
    println!("Fetching all nodes");
    let nodes: Vec<Node> = coordinator_contract
        .call("get_nodes")
        .args_json(json!({}))
        .view()
        .await?
        .json()?;
    println!("Checked for node count, received: {}", nodes.len());
    return Ok(nodes);
}

pub async fn create_bounties(
    coordinator_contract: &Contract,
    creator: Account,
    n_bounties: u64,
    min_nodes: u64
) -> anyhow::Result<Vec<Bounty>> {
    println!("Creating {} bounties", n_bounties);
    let node_count = get_node_count(coordinator_contract).await?;
    assert!(
        node_count > 0,
        "failed to create bounty, no nodes are registered"
    );

    for i in 0..n_bounties {
        println!("creating bounty {}", i);
        let location: String = "https://github.com/ad0ll/docker-hello-world.git".to_string();
        let bounty: Bounty = creator
            .call(coordinator_contract.id(), "create_bounty")
            .args_json(json!({
                "file_location": location,
                "file_download_protocol": "GIT",
                "min_nodes": min_nodes,
                "timeout_seconds": 30,
                "network_required": true,
                "gpu_required": false,
                "amt_storage": format!("{}", parse_near!("1N")), //Make this a string since javascript doesn't support u128
                "amt_node_reward": format!("{}", parse_near!("1N")),
            }))
            .deposit(parse_near!("2N"))
            .transact()
            .await?
            .json()?;
    }

    //TODO compare against statically created bounties
    let bounties = get_bounties(&coordinator_contract).await?;
    println!("finished creating, then fetching bounties, massaging for return");
    let mut res: Vec<Bounty> = vec![];
    for b in bounties {
        res.push(b);
    }
    return Ok(res);
}

pub async fn create_bounty(
    coordinator_contract: &Contract,
    creator: Account,
    min_nodes: u64,
) -> anyhow::Result<Bounty> {
    let mut bounties =
        create_bounties(coordinator_contract, creator, 1, min_nodes).await?;
    return Ok(bounties.pop().unwrap());
}

pub async fn complete_bounty(
    coordinator_contract: Contract,
    bounty: &Bounty,
    accounts: HashMap<AccountId, Account>,
    nodes: &HashMap<AccountId, Node>,
    n_succeeded: u64,
    n_failed: u64,
) -> anyhow::Result<()> {
    async fn process_node(
        coordinator_contract: &Contract,
        bounty: &Bounty,
        accounts: &HashMap<AccountId, Account>,
        nodes: &HashMap<AccountId, Node>,
        node_id: AccountId,
        solution: String,
        message: String,
        status: NodeResponseStatus,
    ) -> anyhow::Result<NodeResponse> {
        let node = nodes
            .get(&node_id)
            .unwrap_or_else(|| panic!("failed to get node {} from nodes", &node_id));
        let account = accounts
            .get(&node.owner_id)
            .unwrap_or_else(|| panic!("failed to get account {} from accounts", &node.owner_id));
        // println!("checking if we should post answer using {} for bounty {}, node {}", coordinator_contract.id(), bounty.id.clone(), node.id.clone());
        // let should_post = should_post_answer(bounty.id.clone(), node.id.clone()).await?;
        //u println!("should_post_answer {}: {:?}", node.id, should_post);
        // if should_post {
        println!(
            "posting answer for bounty {}, node {}",
            bounty.id.clone(),
            node.id.clone()
        );
        let node_response = post_answer(
            coordinator_contract.clone(),
            account.clone(),
            node.id.clone(),
            bounty.id.clone(),
            solution,
            message,
            status,
        )
        .await?;
        return Ok(node_response);
    }

    let bounty_is_complete = |bounty: &Bounty| -> bool {
        return bounty.status == BountyStatus::Cancelled
            || (bounty.successful_nodes.len() >= bounty.min_nodes
                && bounty.status == BountyStatus::Success)
            || (bounty.failed_nodes.len() >= bounty.min_nodes
                && bounty.status == BountyStatus::Failed);
    };

    let mut curr_idx = 0;
    for i in &bounty.elected_nodes {
        println!("Dumping elected nodes: {}", i)
    }
    while curr_idx < n_succeeded {
        let node_id = bounty.elected_nodes[curr_idx as usize].clone();
        let nr = process_node(
            &coordinator_contract,
            &bounty,
            &accounts,
            &nodes,
            node_id.clone(),
            "42".to_string(),
            format!("SUCCESS node {} idx {}", node_id, curr_idx),
            NodeResponseStatus::SUCCESS,
        )
        .await;
        println!("{}", nr.unwrap().message);
        curr_idx += 1; //Make sure you increment this before you break below, we'll use the same scurr_idx for failed nodes
        if bounty_is_complete(&bounty) {
            break;
        }
    }
    while curr_idx < n_succeeded + n_failed {
        let node_id = bounty.elected_nodes[curr_idx as usize].clone();
        let nr = process_node(
            &coordinator_contract,
            &bounty,
            &accounts,
            &nodes,
            node_id.clone(),
            "244".to_string(),
            format!("FAILED node {} idx {}", node_id, curr_idx),
            NodeResponseStatus::FAILURE,
        )
        .await;
        curr_idx += 1; //Make sure you increment this before you break below, we'll use the same curr_idx for failed nodes
        if bounty_is_complete(&bounty) {
            break;
        }
    }

    /* TODO
        If bounty is cancelled, cancel bounty here
        Check that nodes have been paid by taking the account balances before and comparing to the account balances after
        Assert that the answers posted by each node are retrievable and equal to the posted answer
        Fetch the bounty and assert that the bounty is no longer pending
    */

    // for elected in bounty.elected_nodes {
    //     if curr_idx >= min_nodes {
    //         println!("index above min_nodes, should not post answer");
    //         assert_eq!(should_post_answer, false, "should_post_answer should be false since we have enough nodes to close the bounty");
    //         break;
    //     }
    //
    //     println!("index below min_nodes, should post answer");
    //     println!("posted answer to {} for {}", bounty.id.clone(), node.id.clone());
    //     let answer = call_get_answer(coordinator_contract.clone(), account.clone(), node.id.clone(), bounty.id.clone()).await?;
    //     assert_eq!(answer.solution, "42".to_string(), "answer should be 42");
    //     println!("node: {}, owned by {} posted answer", node.id.clone(), node.owner_id.clone());
    //     curr_idx += 1;
    //     assert!(cancelled || (bounty.min_nodes <= n_succeeded || bounty.min_nodes <= n_failed), "failed to complete bounty, not enough nodes succeeded or failed");
    // }
    return Ok(());
}

async fn create_accounts(worker: Worker<Sandbox>, n: u64) -> HashMap<AccountId, Account> {
    let min_balance = parse_near!("10 N");
    let root = worker.root_account().unwrap();
    assert!(n > 0, "failed to create accounts, n must be greater than 0");
    let mut res: HashMap<AccountId, Account> = HashMap::new();
    for _i in 0..n {
        let account = worker.dev_create_account().await.unwrap();
        let _success = root.transfer_near(account.id(), min_balance).await.unwrap();
        let account_id = account.id().parse().unwrap();
        println!("created account: {}", account_id);
        res.insert(account_id, account);
    }
    return res;
}

// Note this is "call_get_answer", the non-view version of "get_answer" that requires a signer and thus costs gas
async fn call_get_answer(
    coordinator_contract: Contract,
    account: Account,
    node_id: AccountId,
    bounty_id: AccountId,
) -> anyhow::Result<NodeResponse> {
    let answer: NodeResponse = account
        .call(coordinator_contract.id(), "call_get_answer")
        .args_json(json!({
            "bounty_id": bounty_id,
            "node_id": node_id,
        }))
        .transact()
        .await?
        .json()?;
    return Ok(answer);
}

async fn post_answer(
    coordinator_contract: Contract,
    account: Account,
    node_id: AccountId,
    bounty_id: AccountId,
    answer: String,
    message: String,
    status: NodeResponseStatus,
) -> anyhow::Result<NodeResponse> {
    println!("posting answer: {}", answer);
    println!("bounty_id: {}", bounty_id);
    let node_response: NodeResponse = account
        .call(coordinator_contract.id(), "post_answer")
        .args_json(json!({
            "node_id": node_id,
            "bounty_id": bounty_id,
            "answer": answer,
            "message": message,
            "status": status,
        }))
        .transact()
        .await?
        // .into_result()?;
        .json()?;
    return Ok(node_response);
}

async fn should_post_answer(
    coordinator_contract: Contract,
    account: Account,
    bounty_id: AccountId,
    node_id: AccountId,
) -> anyhow::Result<bool> {
    let should_post_answer: bool = account
        .call(coordinator_contract.id(), "should_post_answer")
        .max_gas()
        .args_json(json!({
            "bounty_id": bounty_id,
            "message": format!("test message {}", env::random_seed()[0]),
            "node_id": node_id,
        }))
        .transact()
        // .view() //view doesn't work for some reason
        .await?
        .json::<bool>()?;
    return Ok(should_post_answer);
}

#[tokio::test]
async fn test_create_nodes() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let coordinator_contract = setup_coordinator(worker.clone()).await?;
    let accounts = create_accounts(worker.clone(), 2).await;
    let account_vec: Vec<Account> = accounts.values().cloned().collect();
    create_nodes(&coordinator_contract, account_vec, 1).await?;
    assert_eq!(
        get_node_count(&coordinator_contract).await?,
        2,
        "node bootstrapping didn't return the expected number of nodes"
    );
    Ok(())
}

#[tokio::test]
async fn test_create_bounty() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let coordinator_contract = setup_coordinator(worker.clone()).await?;
    let accounts = create_accounts(worker.clone(), 1).await;
    let account_vec: Vec<Account> = accounts.values().cloned().collect();
    let _nodes = create_nodes(&coordinator_contract, account_vec.clone(), 1).await?;
    let bounty_owner = &account_vec[(random_seed().clone()[0] % 10) as usize];
    let _bounties = create_bounties(&coordinator_contract, bounty_owner.clone(), 1, 1, 1).await?;
    assert_eq!(
        get_bounty_count(coordinator_contract.clone()).await?,
        1,
        "bounty count should be 1"
    );
    Ok(())
}

#[tokio::test]
async fn test_bounty_full_lifecycle() -> anyhow::Result<()> {
    let num_accounts = 5;
    let min_nodes = 2;
    let max_nodes = 3;
    assert!(
        min_nodes + max_nodes <= num_accounts,
        "failed to create bounty, min_nodes + max_nodes must be less than or equal to num_accounts"
    );
    let worker = near_workspaces::sandbox().await?;
    let coordinator_contract = setup_coordinator(worker.clone()).await?;
    let mut accounts = create_accounts(worker.clone(), num_accounts).await;
    let account_vec: Vec<Account> = accounts.values().cloned().collect();
    let mut nodes = create_nodes(&coordinator_contract, account_vec.clone(), 1).await?;
    assert_eq!(
        get_node_count(&coordinator_contract).await?,
        num_accounts,
        "node bootstrapping didn't return the expected number of nodes"
    );

    // Success run
    let bounty_owner_id = accounts.keys().next().unwrap().clone();
    let bounty_owner = accounts
        .get(&bounty_owner_id)
        .unwrap_or_else(|| panic!("failed to remove bounty owner from accounts"));
    let bounty = create_bounty(
        &coordinator_contract,
        bounty_owner.clone(),
        min_nodes,
        max_nodes,
    )
    .await?;
    assert_eq!(
        get_bounty_count(coordinator_contract.clone()).await?,
        1,
        "bounty count should be 1"
    );
    complete_bounty(
        coordinator_contract.clone(),
        &bounty,
        accounts.clone(),
        &nodes,
        min_nodes,
        0,
    )
    .await?;
    println!("fetching bounty: {}", bounty.id.clone());
    let hot_bounty = get_bounty(&coordinator_contract, bounty.id.clone()).await?;
    assert_eq!(hot_bounty.id, bounty.id.clone(), "bounty should exist");
    println!(
        "bounty: {} {} {} {}",
        hot_bounty.successful_nodes.len(),
        hot_bounty.failed_nodes.len(),
        hot_bounty.min_nodes,
        hot_bounty.answers.len()
    );
    assert_eq!(
        hot_bounty.status,
        BountyStatus::Success,
        "bounty should be completed"
    );
    assert!(
        hot_bounty.answers.len() >= min_nodes,
        "bounty should have at least min_nodes answers"
    );
    assert!(
        hot_bounty.successful_nodes.len() >= min_nodes,
        "bounty should have at least min_nodes responses"
    );

    //Fail run
    // let bounty_owner_id = accounts.keys().unwrap().clone().get(1);
    // let bounty_owner = accounts.get(&bounty_owner_id).unwrap_or_else(|| panic!("failed to remove bounty owner from accounts"));
    let bounty = create_bounty(
        &coordinator_contract,
        bounty_owner.clone(),
        min_nodes,
        max_nodes,
    )
    .await?;
    println!("bounty name {}", bounty.id);
    complete_bounty(
        coordinator_contract.clone(),
        &bounty,
        accounts.clone(),
        &nodes,
        1,
        min_nodes,
    )
    .await?;
    println!("fetching bounty: {}", bounty.id.clone());
    let hot_bounty = get_bounty(&coordinator_contract, bounty.id.clone()).await?;
    assert_eq!(hot_bounty.id, bounty.id.clone(), "bounty should exist");
    assert_eq!(
        hot_bounty.status,
        BountyStatus::Failed,
        "bounty should be completed"
    );
    assert!(
        hot_bounty.answers.len() >= min_nodes + 1,
        "bounty should have at least min_nodes answers"
    );
    assert!(
        hot_bounty.failed_nodes.len() >= min_nodes,
        "bounty should have at least min_nodes failed responses"
    );

    //TODO Cancel run
    Ok(())
}
