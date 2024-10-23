import React, {ReactElement, useEffect, useState} from "react";
import {Checkbox, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow} from "@mui/material";
import {FCWithChildren} from "../types";
import {Link} from "react-router-dom";
import Button from "@mui/material/Button";
import {localStorageState} from "../App";
import {BountyExecutionState, BountyMonitor, ExecutionMessageSummaryValue} from "../bounty/bounty-monitor";
import {NodeStorage, TransientStorage} from "../storage";
import {messageFactory} from "./util";
import useWebSocket from "react-use-websocket";
import {ClientMessage} from "../../../execution-client/database";
import {atom, selector, useRecoilState, useRecoilValue} from "recoil";
import {wallet} from "../index";
import {chainNodesState, viewMineOnlyState} from "./existing-node"; //TODO fix me later


// const nodesVisibleBounties = atom<{ [key: string]: boolean }>({
//     key: "nodesVisibleBounties",
//     default: {}
// })

const localNodesState = selector({
    key: "localNodesState",
    get: async ({get}) => {
        const chainNodes = get(chainNodesState)
        const storage = get(localStorageState)
        const localNodes = storage.getOrSetDefault("nodes", {})
        let nodes: NodeStorage = chainNodes.reduce((acc: NodeStorage, node) => {
            return {
                ...acc,
                [node.id]: {
                    ...node,
                    url: localNodes[node.id]?.url ?? "",
                }
            }
        }, {})
        return nodes
    },
})

const nodesState = atom<NodeStorage>({
    key: "nodesState",
    default: localNodesState,
    effects: [
        //Copy state changes to local storage
        ({onSet}) => {
            onSet((newValue) => {
                const storage = new TransientStorage()
                storage.set("nodes", newValue)
            })
        }
    ]

})

export const NodeList: React.FC = () => {
    // const wallet = useRecoilValue(walletState);
    const storage = useRecoilValue(localStorageState);
    const [nodes, setNodes] = useRecoilState(nodesState)
    const [viewMineOnly, setViewMineOnly] = useRecoilState(viewMineOnlyState);
    const [debug, setDebug] = React.useState(false);

    const DisplayIfVerbose: FCWithChildren = ({children}) => debug
        ? <>{children}</> : <></>


    //Delay setting storage until the user has stopped typing for 1s
    //This can be avoided with a submit button
    useEffect(() => {
        const timeOutId = setTimeout(() => {
            storage.set("nodes", nodes)
        }, 1000);
        return () => {
            clearTimeout(timeOutId)
        };
    }, [nodes]);

    //Refresh nodes every 2s. Node data doesn't change w/o a transaction, so this is moreso ceremony
    useEffect(() => {
        const pollingInterval = setInterval(wallet.getNodes, 2000)
        return () => {
            clearInterval(pollingInterval)
        }
    }, [nodes]);


    let body: ReactElement = <Table>
        <TableHead>
            <TableRow>
                <TableCell>Id</TableCell>
                <TableCell>Last Success</TableCell>
                <TableCell>Last Failure</TableCell>
                <TableCell>Active Bounties</TableCell>
                <DisplayIfVerbose><TableCell>Last Rejected</TableCell></DisplayIfVerbose>
                <DisplayIfVerbose><TableCell>Total success</TableCell></DisplayIfVerbose>
                <DisplayIfVerbose><TableCell>Total failure</TableCell></DisplayIfVerbose>
                <DisplayIfVerbose><TableCell>Total rejected</TableCell></DisplayIfVerbose>
                <DisplayIfVerbose><TableCell>Total unanswered</TableCell></DisplayIfVerbose>
                <TableCell>Success rate</TableCell>
                <DisplayIfVerbose><TableCell>Supports network</TableCell></DisplayIfVerbose>
                <DisplayIfVerbose><TableCell>Supports GPU</TableCell></DisplayIfVerbose>
                <TableCell>URL</TableCell>
                <TableCell>Connection</TableCell>
                <TableCell></TableCell>
            </TableRow>
        </TableHead>
        <TableBody>
            {Object.values(nodes).map(node => {
                let localNode = nodes[node.id];
                const temp: BountyExecutionState = messageFactory(10).reduce((acc: BountyExecutionState, message) => {
                    return {
                        ...acc,
                        [message.bountyId]: {
                            nodeId: node.id,
                            bountyId: message.bountyId,
                            lastUpdate: message.sentAt,
                            phase: message.context.phase
                        }
                    }
                }, {})
                console.log(`listening to ${localNode.url}`)
                const [bountyState, setBountyState] = useState<BountyExecutionState>(temp);
                const {lastMessage, readyState} = useWebSocket(localNode.url);
                const [showDetail, setShowDetail] = useState(false)

                const incomplete = Object.values(bountyState).filter((bounty) => bounty.phase !== "Complete").length;

                useEffect(() => {
                    if (lastMessage) {
                        console.log(`got message ${lastMessage}`)
                        //Validate that message is of a type we care about
                        const {bountyId, data, sentAt} = JSON.parse(lastMessage.data) as ClientMessage
                        const current = bountyState[node.id + bountyId]
                        const bounty: ExecutionMessageSummaryValue = {
                            nodeId: node.id,
                            bountyId,
                            phase: data.phase || current?.phase || "new",
                            lastUpdate: sentAt
                        }
                        setBountyState({...bountyState, [node.id + bountyId]: bounty})
                    }
                }, [localNode.url, lastMessage, readyState])

                return <React.Fragment key={node.id}>
                    <TableRow key={node.id}>
                        <TableCell>
                            <Link to={`/node/${node.id}`}>{node.id}</Link>
                        </TableCell>
                        <TableCell>{node.last_success}</TableCell>
                        <TableCell>{node.last_failure}</TableCell>
                        <TableCell>
                            <Chip label={incomplete} color={incomplete > 0 ? "secondary" : "primary"}/>
                        </TableCell>
                        <DisplayIfVerbose><TableCell>{node.last_reject}</TableCell></DisplayIfVerbose>
                        <DisplayIfVerbose><TableCell>{node.successful_runs}</TableCell></DisplayIfVerbose>
                        <DisplayIfVerbose><TableCell>{node.failed_runs}</TableCell></DisplayIfVerbose>
                        <DisplayIfVerbose><TableCell>{node.rejected_runs}</TableCell></DisplayIfVerbose>
                        <DisplayIfVerbose><TableCell>{node.unanswered_runs}</TableCell></DisplayIfVerbose>
                        <TableCell>0</TableCell>
                        <DisplayIfVerbose><TableCell><Checkbox disabled={true}
                                                               checked={node.allow_network}/></TableCell></DisplayIfVerbose>
                        <DisplayIfVerbose><TableCell><Checkbox disabled={true}
                                                               checked={node.allow_gpu}/></TableCell></DisplayIfVerbose>

                        <TableCell>
                            <Button variant={showDetail ? "outlined" : "contained"} color={"primary"}
                                    onClick={() => {
                                        setShowDetail(!showDetail)
                                    }}>
                                Details
                            </Button>
                        </TableCell>
                    </TableRow>
                    {showDetail && <TableRow key={node.id + "bounty-monitor"}>
                        <BountyMonitor bountyState={bountyState}/>
                    </TableRow>}
                </React.Fragment>
            })}
        </TableBody>
    </Table>

    return <Grid container spacing={2}>

        <Grid item>
            <Button
                variant={debug ? "contained" : "outlined"}
                onClick={() => setDebug(!debug)}
            >
                {debug ? "Hide details" : "Show details"}
            </Button>
        </Grid>
        <Grid item>
            <Button
                variant={viewMineOnly ? "contained" : "outlined"}
                onClick={() => setViewMineOnly(!viewMineOnly)}
            >
                {viewMineOnly ? "View all nodes" : "View only my nodes"}
            </Button>
        </Grid>
        <Grid item xs={12}>
            {body}
        </Grid>
        <Grid item>
            <Link to={"node/new"}><Button variant={"contained"}>Register a new node</Button></Link>
        </Grid>
    </Grid>
}
