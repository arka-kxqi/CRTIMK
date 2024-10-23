# execution client

## risks
### **please read this section first**
this execution client is built to allow people you don't know to run code on your computer. We will be adding more features later to better protect operators, but for now, we **strongly recommend the following**:
* Install an always on VPN or always use tor for all network interactions
* Run the software on a device that has at least 64GB of storage for padding
* Monitor the UI for bounty rejections to verify why your node is refusing to run a bounty. You may need to adjust your on chain configuration.

#### developers/highly technical users
These are additional steps for technical users
* Isolate your client nodes on a VLAN and block access to your local network

## Setup

### Non/semi-technical
Refer to instructions in [../playbook/README.md](../playbook/README.md) for the one line installer.

### Technical users
Refer to .env.example for configuration options. Currently, you can fine tune storage behaviors

### Developers/Testnet
```shell
# Look at .env.example for configuration options
yarn && yarn start
```
NEARs testnet doesn't have a websocket, the indexer is heavy to run, and the recently released lake framework leans into AWS, which is antithetical to F.A.W.S.. 

During our testing, we were only able to get the indexer to run on an enterprise server and a high end gaming desktop. This was prohibitive for half the team, so we used a relay to echo manually published events to nodes. 
* If you're able to run a NEAR node, that's the best setup for development, and [we have a lightweight indexer here](https://github.com/ad0ll/nearcore/tree/master/tools/indexer/lightweight-indexer). 
* If you're not able to run a NEAR node, please [feel free to use the relay here](https://github.com/ad0ll/nearcore/tree/master/tools/indexer/websocket-relay).

Additionally, for development, you can use EMIT_BOUNTY settings to automatically create a bounty at a specified interval


## Bounty lifecycle
The short step-by-step is this:
1. Client receives bounty from websocket/indexer.
2. Client runs basic pre-flight checks on bounty.
3. Client downloads the bounty files into a temporary directory
4. Client runs the bounty using docker. The final line of output from the bounty is a specific JSON message that contains the result of the bounty.
5. Client checks if it can submit the answer, and if so, submits it.
6. Client cleans up the temporary directory.
7. At some point, node receives a bounty complete event and collects their reward1
