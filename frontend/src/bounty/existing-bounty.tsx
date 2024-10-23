import React, { useContext, useEffect } from "react";
import {
  Button,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Bounty, BountyStatuses } from "../../../execution-client/types";
import { WalletContext } from "../app";
import { atom, selector, selectorFamily, useRecoilState } from "recoil";
import { UpdateBountyModal } from "./update-bounty-modal";
import { wallet } from "../index";
import { ErrorBoundary } from "react-error-boundary";
import { yoctoNear } from "../common/near-wallet";
import { useNavigate } from "react-router-dom";
import {StyledLink} from "../common/styled-link";
import {ViewBountySolutionModal} from "./view-solution-modal";

const chainBountiesState = selector({
  key: "chainBounties",
  get: async ({ get }) => {
    let bounties = [];
    try {
      bounties = await wallet.getBountiesOwnedBySelf();
    } catch (e) {}
    return bounties;
  },
});

const bountyAnswerCountsState = selectorFamily({
  key: "bountyAnswerCounts",
  get:
    (bountyID: string) =>
    async ({ get }) => {
      return await wallet.getBountyAnswerCounts(bountyID);
    },
});
const allBountyAnswersCountState = selector({
  key: "allBountyAnswersCountState",
  get: async ({ get }) => {
    const bounties = get(chainBountiesState);
    return bounties.reduce((acc: { [key: string]: any }, bounty) => {
      acc[bounty.id] = get(bountyAnswerCountsState(bounty.id));
      return acc;
    }, {});
  },
});

export const bountiesState = atom({
  key: "bountiesStates",
  default: chainBountiesState,
});

const bountyAnswersState = atom({
  key: "bountyAnswersState",
  default: allBountyAnswersCountState,
});

export default function ExistingBounty() {
  const wallet = useContext(WalletContext);
  const [bounties, setBounties] = useRecoilState(bountiesState);
  const [bountyAnswers, setBountyAnswers] = useRecoilState(bountyAnswersState);
  //Refetch bounties and answer counts every 2s
  useEffect(() => {
    const getBounties = async () => {
      const selfBounties = await wallet.getBountiesOwnedBySelf();
      let answers = { ...bountyAnswers };
      for await (const bounty of selfBounties) {
        const answerCounts = await wallet.getBountyAnswerCounts(bounty.id);
        answers[bounty.id] = answerCounts;
      }
      setBounties(selfBounties);
      setBountyAnswers(answers);
    };
    const interval = setInterval(() => {
      getBounties();
    }, 2000);
    return () => clearInterval(interval);
  }, [bounties]);

  return (
    <>
      <div style={{ marginTop: "24px" }}>
        {Object.values(bounties).length === 0 && (
          <Typography variant="h6" component="h2">
            No Existing Bounties
          </Typography>
        )}
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Id</TableCell>
                <TableCell align="center">Successful Nodes</TableCell>
                <TableCell align="center">Failed Nodes</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.values(bounties)
                .filter((bounty) => bounty.owner_id === wallet.accountId)
                .map((bounty) => (<Row bounty={bounty} key={bounty.id} />
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div role="alert">
            <p>Something went wrong:</p>
            <pre>{error.message}</pre>
            <button onClick={resetErrorBoundary}>Try again</button>
          </div>
        )}
      />
    </>
  );
}

function Row({ bounty }: { bounty: any }) {
  const [open, setOpen] = React.useState(false);
  const [expand, setExpand] = React.useState(false);
  const [field, setField] = React.useState("");
  const [bountyId, setBountyId] = React.useState("");
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  );
  const [bountySolutionModalOpen, setBountySolutionModalOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  const handleOpenModal = (button: string, bountyId: string) => {
    setBountyId(bountyId);
    setField(button);
    setOpen(true);
  };
  const handleCloseModal = () => setOpen(false);

  const cancelBounty = async (bountyId: string) => {
    await wallet.cancelBounty(bountyId);
  };

  return (
    <React.Fragment>
      <ViewBountySolutionModal bountyId={bounty.id} bountyStatus={bounty.status} modalOpen={bountySolutionModalOpen} handleClose={setBountySolutionModalOpen}/>
      <TableRow key={bounty.id}>
        <TableCell width={10}></TableCell>
        <TableCell component="th" scope="row">
          <StyledLink linkTarget={`/bounty/${bounty.id}`} content={bounty.id}/>
        </TableCell>
        <TableCell component="th" scope="row" align="center">
          <Typography>{bounty.successful_nodes?.length || 0}</Typography>
        </TableCell>
        <TableCell component="th" scope="row" align="center">
          <Typography>{bounty.failed_nodes?.length || 0}</Typography>
        </TableCell>
        <TableCell component="th" scope="row" align="center">

          <Chip
              label={bounty.status}
              variant="outlined"
              onClick={() => {
                //TODO Would be better if below showed a toast
                bounty.status.toLowerCase() !== BountyStatuses.Pending ?
                    setBountySolutionModalOpen(true) : null
              }}
              color={
                bounty.status.toLowerCase() ===
                BountyStatuses.Pending.toLowerCase()
                    ? "warning"
                    : bounty.status.toLowerCase() ===
                    BountyStatuses.Success.toLowerCase()
                        ? "success"
                        : "error"
              }
          />

        </TableCell>
        <TableCell component="th" scope="row" align="center">
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleOpenUserMenu}
          >
            Actions
          </Button>
          <Menu
            sx={{ mt: "45px" }}
            id="node-action-button"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            <MenuItem
              key="export"
              onClick={() => {
                exportBounty(bounty);
                handleCloseUserMenu();
              }}
            >
              <Typography textAlign="center">Export</Typography>
            </MenuItem>
            <MenuItem
              key="details"
              onClick={() => {
                navigate(`/bounty/${bounty.id}`);
                handleCloseUserMenu();
              }}
            >
              <Typography textAlign="center">Details</Typography>
            </MenuItem>
            {bounty.status.toLowerCase() === BountyStatuses.Pending &&
                <MenuItem
                    key="solution"
                    onClick={() => {
                      setBountySolutionModalOpen(true);
                      handleCloseUserMenu();
                    }}
                >
                  <Typography textAlign="center">Details</Typography>
                </MenuItem>
            }
            {bounty.status.toLowerCase() ===
            BountyStatuses.Pending.toLowerCase() && [(<MenuItem
                  key="reward"
                  onClick={() => {
                    handleOpenModal("Reward", bounty.id);
                    handleCloseUserMenu();
                  }}
                >
                  <Typography textAlign="center">Add Reward</Typography>
                </MenuItem>),
                (<MenuItem
                  key="storage"
                  onClick={() => {
                    handleOpenModal("Storage", bounty.id);
                    handleCloseUserMenu();
                  }}
                >
                  <Typography textAlign="center">Add Storage</Typography>
                </MenuItem>),
                (<MenuItem
                  key="cancel"
                  onClick={() => {
                    cancelBounty(bounty.id);
                    handleCloseUserMenu();
                  }}
                >
                  <Typography textAlign="center">Cancel Bounty</Typography>
                </MenuItem>)]
            }
          </Menu>
          <UpdateBountyModal
            bountyId={bountyId}
            field={field}
            open={open}
            handleClose={handleCloseModal}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ padding: 0 }}>
          <LinearProgress
            /* Show as green if in progress and not all nodes have completed
             Show as red if all nodes complete but have not met threshold
             Show as red is cancelled or failed
          */
            color={
              ((bounty.successful_nodes?.length || 0) < bounty.min_nodes) ||
              bounty.status.toLowerCase() ===
                BountyStatuses.Failed.toLowerCase() ||
              bounty.status.toLowerCase() ===
                BountyStatuses.Cancelled.toLowerCase()
                ? "error"
                : "success"
            }
            variant="determinate"
            value={
              ((bounty.successful_nodes?.length || 0) / bounty.min_nodes) * 100
            }
          />
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}

export const exportBounty = (bounty: Bounty) => {
  const element = document.createElement("a");
  const bountyConfig = {
    file_location: bounty.file_location,
    file_download_protocol: bounty.file_download_protocol,
    min_nodes: bounty.min_nodes,
    amt_storage: Number(bounty.amt_storage) / yoctoNear,
    amt_node_reward: Number(bounty.amt_node_reward) / yoctoNear,
    timeout_seconds: bounty.timeout_seconds,
    network_required: bounty.network_required,
    gpu_required: bounty.gpu_required,
  };
  const file = new Blob([JSON.stringify(bountyConfig)], {
    type: "application/json",
  });
  element.href = URL.createObjectURL(file);
  element.download = `${bounty.id}.json`;
  document.body.appendChild(element);
  element.click();
};


