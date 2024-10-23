# F.A.W.S. coordinator contract

TL;DR:
Use the frontend or this command to create bounties
```shell
near call "$CONTRACT_NAME" create_bounty --accountId="$ACCOUNT" --deposit 2 "{\"file_location\": \"https://github.com/ad0ll/docker-hello-world.git\", \"file_download_protocol\": \"HTTPS\", \"min_nodes\": 1, \"timeout_seconds\": 600, \"network_required\": true, \"gpu_required\": false, \"amt_storage\": \"1000000000000000000000000\", \"amt_node_reward\": \"1000000000000000000000000\"}"
```
Use the frontend, playbook, or this command to register a node
```shell
near call "$CONTRACT_NAME" register_node '{"name": "helper-node3", "absolute_timeout": 60000, "allow_network": true, "allow_gpu": false}' --deposit 1 --accountId="$ACCOUNT"
```

this contract is the on chain backend for f.a.w.s.. it contains three parts (that may be split into separate contracts in the future):
1. [coordinator](./coordinator/src/coordinator/mod.rs): all of the heavy lifting. handles most functions of f.a.w.s. including node election, bounty payouts, and managing the lifespan of nodes and bounties. also the only place where data for f.a.w.s. is stored.
2. [bounty](./coordinator/src/bounty/mod.rs): a discrete job that is distributed to off chain clients by the coordinator. see bounty creation for specifics
3. [node](./coordinator/src/node/mod.rs): an on chain representation of an off chain client

## specifics

### Bounties

#### EABounty Creation
**When creating a bounty, please be a good steward to the network and avoid running code that could compromise the safety and security of node operators.**

To create a bounty that can be run on F.A.W.S., you must pass a package url to file_location that is one of the following:
1. A git repository that contains a Dockerfile at its root. The git repo must be public, and we encourage using the https instead of the ssh url, since we don't know if nodes have ssh keys set up.
2. A zip or tar file that is packed with a directory that contains a Dockerfile at its root/first level
3. A path to a Dockerfile

You can do anything that Docker can do in your Dockerfile. There are only two concrete requirements. 
First, **in order to see the result of a node's execution**, the last line of output written to stdout/stderr must be a specifically formatted JSON string: 
```
{
        "bounty_data": {
            "result": "data as string",
            "message": "optional message, typically used for printing error messages"
        }
}
```
Failure to exit with this JSON string will result in empty responses from nodes. They'll get paid for the work, but you won't be able to see the result.
Second, in order to run GPU workloads, you must pass the "GPU Required" on bounty creation. This will pass "--gpus all" to the docker run command.

There are some other best practices that we recommend, but they are not required:
1. Always produce the above json, even if there is an error. this will allow node's to consistently report whether the bounty succeeded or failed.
2. Accurately estimate how long a bounty will take when creating it. This will filter out nodes that have settings that would kill the bounty prematurely.

You can refer to this [hello world package for an example on how to set up a bounty](https://github.com/ad0ll/docker-hello-world)

#### Bounty lifecycle
The typical lifecycle of a bounty is as follows:
1. A bounty is created using the frontend or a script.
2. The coordinator looks at what the bounty requires (gpu + network currently) and elects suitable nodes to run the bounty.
3. Nodes receive the bounty creation event and run the job off chain
4. Each node submits their answers until the minimum majority of answers required by the bounty is reached.
5. The final node closes the bounty. The remaining storage deposit is returned to the bounty creator.
6. Nodes receive the bounty complete event and collect their reward if they're in the majority (Currently, if the majority of nodes succeed, any successful node receives the reward, or if the majority of nodes fail, any failed node receives the reward. This will be changed in the future to be more fair and robust,


### Nodes
Nodes are on chain representations of off chain clients. We use them to store node configuration, which is primarily used to filter nodes during election. For instance, a node can be configured with "allow_gpu" which will allow it to be elected by a bounty that has "gpu_required" set to true.

Besides configuration, the contract records metrics about each node on the network, but doesn't currently act on them. There are plans later to move consistently failing nodes to an offline state (no slashing), but that isn't in the current version