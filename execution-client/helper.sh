# Run: local_near dev-deploy --wasmFile target/wasm32-unknown-unknown/release/
#Populate below variablea
ACCOUNT=$ACCOUNT
NODE_NAME=$NODE_NAME
ALLOW_NETWORK=$ALLOW_NETWORK
ALLOW_GPU=$ALLOW_GPU
CONTRACT_NAME=dev-1667851730608-70663242970224
if [[ -z "$ACCOUNT" || -z "$NODE_NAME" || -z "$ALLOW_NETWORK" || -z "$ALLOW_GPU" ]]; then
  echo "One of ACCOUNT, NODE_NAME, ALLOW_NETWORK, or ALLOW_GPU is not set"
  echo "Usage: ACCOUNT= NODE_NAME= ALLOW_NETWORK= ALLOW_NETWORK= ./register_node.sh"
  exit 1
fi


near call "$CONTRACT_NAME" register_node "{\"name\": \"$NODE_NAME\", \"allow_network\": $ALLOW_NETWORK, \"allow_gpu\": $ALLOW_GPU}" --deposit 1 --accountId="$ACCOUNT"
