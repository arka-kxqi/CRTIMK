import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {Link} from "react-router-dom";

export type ExecutionMessageSummaryValue = {
  nodeId: string;
  bountyId: string;
  lastUpdate: number;
  phase: string;
};
export type BountyExecutionState = {
  [key: string]: ExecutionMessageSummaryValue;
};

const alphaSort = (a: string, b: string) => a.localeCompare(b) * -1;
// Draftwork component that renders what bounties are running, and their current phase
// Data is fed to it from NodeList currently (this is what renders when you click "show details" on a node)
export const BountyMonitor: React.FC<{ bountyState: BountyExecutionState }> = ({
  bountyState,
}) => {
  return (
    <>
      {Object.entries(bountyState).length === 0 ? (
        <Typography>No Bounty Activity</Typography>
      ) : (
        <>
          <Table>
            <colgroup>
              <col style={{width:'60%'}}/>
              <col style={{width:'20%'}}/>
              <col style={{width:'20%'}}/>
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>Bounty ID</TableCell>
                <TableCell>Last update</TableCell>
                <TableCell>Phase</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.keys(bountyState).sort((a,b) => alphaSort(a,b))
                  .map((key) => {
                    const execution = bountyState[key];
                return (
                  <TableRow key={key}>
                    <TableCell><Link to={`bounty/${execution.bountyId}`}
                                     style={{ textDecoration: 'none' }}>
                      <Typography variant={"body1"}
                      color={"primary"}>{execution.bountyId}</Typography>
                    </Link></TableCell>
                    <TableCell>
                      <Typography variant={"body1"}>{new Date(execution.lastUpdate).toLocaleString()}</Typography></TableCell>
                    <TableCell>
                      <Typography>
                        {execution.phase}
                      </Typography>
                      </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </>
  );
};
