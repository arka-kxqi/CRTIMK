# Run: local_near dev-deploy --wasmFile target/wasm32-unknown-unknown/release/
#Populate below variablea
ACCOUNT=$ACCOUNT
#REDEPLOY_CONTRACT=yes #Put anything here to redeploy the contract
REDEPLOY_CONTRACT= #Put anything here to redeploy the contract
#BOUNTY_NAME="test-bounty-$(date +%s)"
REFERENCE_BOUNTY=140-836519529.bounty.will-anyone-notice2.testnet
NETWORK=testnet #testnet or localnet
#CONTRACT_NAME=dev-1668981191112-14627628939016

# If the network is localnet, then we need to set a bunch of envvars. If it's testnet, we don't need an alias because the envvars are built in to the cli. n
if [[ -z "$NETWORK" || "$NETWORK" == "localnet" ]]; then
  alias local_near="NEAR_ENV=\"local\" NEAR_CLI_LOCALNET_NETWORK_ID=\"localnet\" NEAR_NODE_URL=\"http://0.0.0.0:3030\"  near"
else
  echo "Using testnet"
  alias local_near="near"
fi

source_neardev() {
  source ./neardev/dev-account.env

  echo "$CONTRACT_NAME"
  if [[ -z $CONTRACT_NAME ]]; then
    echo "No CONTRACT_NAME defined: $CONTRACT_NAME"
    exit 1
  fi

  sed -i.bak "s/COORDINATOR_CONTRACT_ID=.*/COORDINATOR_CONTRACT_ID=\"$CONTRACT_NAME\"/g" ../execution-client/.env
  sed -i.bak "s/COORDINATOR_ID=.*/COORDINATOR_ID=\"$CONTRACT_NAME\"/g" ../frontend/.env
  sed -i.bak "s/COORDINATOR_ID=.*/COORDINATOR_ID=\"$CONTRACT_NAME\"/g" ../playbook/install.sh
}

if [[ -n $REDEPLOY_CONTRACT ]]; then #If defined then...
  rm -rf ./neardev/
  ./build.sh
  #  local_near deploy faws.testnet --wasmFile target/wasm32-unknown-unknown/release/coordinator.wasm
#    local_near deploy $CONTRACT_NAME.testnet --wasmFile target/wasm32-unknown-unknown/release/coordinator.wasm
  local_near dev-deploy --wasmFile target/wasm32-unknown-unknown/release/coordinator.wasm
  source_neardev

#  local_near call "$CONTRACT_NAME" register_node '{"name": "helper-node1", "absolute_timeout": 60000, "allow_network": true, "allow_gpu": false}' --deposit 1 --accountId="$ACCOUNT"
#  local_near call "$CONTRACT_NAME" register_node '{"name": "helper-node2", "absolute_timeout": 60000, "allow_network": true, "allow_gpu": false}' --deposit 1 --accountId="$ACCOUNT"
#  local_near call "$CONTRACT_NAME" register_node '{"name": "helper-node3", "absolute_timeout": 60000, "allow_network": true, "allow_gpu": false}' --deposit 1 --accountId="$ACCOUNT"
fi
source_neardev

#local_near call "$CONTRACT_NAME" register_node '{"name": "node1", "allow_network": true, "allow_gpu": true}' --deposit 1 --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" register_node '{"name": "node2", "allow_network": true, "allow_gpu": true}' --deposit 1 --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" register_node '{"name": "node3", "allow_network": true, "allow_gpu": true}' --deposit 1 --accountId="$ACCOUNT"

#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"node1.node.$ACCOUNT\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"helper-node1.node.faws-demo-emitter.testnet\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"helper-node2.node.faws-demo-emitter.testnet\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"helper-node3.node.faws-demo-emitter.testnet\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"test2.node.faws-demo-emitter3.testnet\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"test2.node.faws-demo-emitter2.testnet\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" remove_node "{\"node_id\": \"test2.node.faws-demo-emitter3.testnet\"}" --accountId="$ACCOUNT"

local_near view "$CONTRACT_NAME" get_nodes --accountId="$ACCOUNT"
#local_near view "$CONTRACT_NAME" get_node --accountId="$ACCOUNT" "{\"account_id\": \"node1.node.$ACCOUNT\"}"
#local_near view "$CONTRACT_NAME" get_bounties --accountId="$ACCOUNT"
#local_near view "$CONTRACT_NAME" get_bounty --accountId="$ACCOUNT" "{\"bounty_id\": \"$REFERENCE_BOUNTY\"}"

# Below creates, then completes a bounty. Note, if min_nodes > 1, you'll need to run multiple execution clients

#The four below are all different combinations of network allowed + gpu allowed
#local_near call "$CONTRACT_NAME" create_bounty --accountId="$ACCOUNT" --deposit 2 "{\"file_location\": \"https://github.com/ad0ll/docker-hello-world.git\", \"file_download_protocol\": \"HTTPS\", \"min_nodes\": 2, \"timeout_seconds\": 60, \"network_required\": false, \"gpu_required\": false, \"amt_storage\": \"1000000000000000000000000\", \"amt_node_reward\": \"1000000000000000000000000\"}"
#local_near call "$CONTRACT_NAME" post_answer "{\"bounty_id\": \"$REFERENCE_BOUNTY\", \"node_id\": \"node3.node.$ACCOUNT\", \"answer\": \"42\", \"message\": \"CRAAAAAAAAB BAAAATTLE\", \"status\": \"SUCCESS\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" reelect_unanswered_nodes --accountId="$ACCOUNT" "{\"bounty_id\": \"$REFERENCE_BOUNTY\"}"
#local_near call "$CONTRACT_NAME" create_bounty --accountId="$ACCOUNT" --deposit 2 "{\"file_location\": \"https://github.com/ad0ll/docker-hello-world.git\", \"file_download_protocol\": \"HTTPS\", \"min_nodes\": 1, \"timeout_seconds\": 60, \"network_required\": true, \"gpu_required\": false, \"amt_storage\": \"1000000000000000000000000\", \"amt_node_reward\": \"1000000000000000000000000\"}"
#local_near call "$CONTRACT_NAME" create_bounty --accountId="$ACCOUNT" --deposit 2 "{\"file_location\": \"https://github.com/ad0ll/docker-hello-world.git\", \"file_download_protocol\": \"HTTPS\", \"min_nodes\": 1, \"timeout_seconds\": 600, \"network_required\": true, \"gpu_required\": false, \"amt_storage\": \"1000000000000000000000000\", \"amt_node_reward\": \"1000000000000000000000000\"}"
#local_near call "$CONTRACT_NAME" create_bounty --accountId="$ACCOUNT" --deposit 2 "{\"file_location\": \"https://github.com/ad0ll/docker-hello-world.git\", \"file_download_protocol\": \"HTTPS\", \"min_nodes\": 1, \"timeout_seconds\": 60, \"network_required\": false, \"gpu_required\": false, \"amt_storage\": \"1000000000000000000000000\", \"amt_node_reward\": \"1000000000000000000000000\"}"

#local_near call "$CONTRACT_NAME" remove_all_nodes --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" reject_bounty "{\"bounty_id\": \"$REFERENCE_BOUNTY\", \"node_id\": \"node1.node.$ACCOUNT\", \"message\": \"CRAAAAAAAAB BAAAATTLE\", \"status\": \"SUCCESS\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" post_answer "{\"bounty_id\": \"$REFERENCE_BOUNTY\", \"node_id\": \"node2.node.$ACCOUNT\", \"answer\": \"42\", \"message\": \"STEEEEEEEELLLLLL\", \"status\": \"SUCCESS\"}" --accountId="$ACCOUNT"

#local_near view "$CONTRACT_NAME" get_bounties --accountId="$ACCOUNT"
#local_near view "$CONTRACT_NAME" get_bounties --accountId="$ACCOUNT"
#
#local_near view "$CONTRACT_NAME" should_post_answer "{\"node_id\": \"node2.node.$ACCOUNT\", \"bounty_id\": \"$REFERENCE_BOUNTY\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" call_get_answer "{\"node_id\": \"node2.node.$ACCOUNT\", \"bounty_id\": \"$REFERENCE_BOUNTY\"}" --accountId="$ACCOUNT"

#local_near call "$CONTRACT_NAME" get_answer "{\"node_id\": \"node3.node.$ACCOUNT\", \"bounty_id\": \"$REFERENCE_BOUNTY\"}" --accountId="$ACCOUNT"
local_near call "$CONTRACT_NAME" get_bounty_result "{\"bounty_id\": \"$REFERENCE_BOUNTY\"}" --accountId="$ACCOUNT"
#local_near call "$CONTRACT_NAME" post_answer "{\"bounty_id\": \"$REFERENCE_BOUNTY\", \"node_id\": \"node5.node.$ACCOUNT\", \"answer\": \"42\", \"message\": \"slayer\", \"status\": \"SUCCESS\"}" --accountId="$ACCOUNT"
