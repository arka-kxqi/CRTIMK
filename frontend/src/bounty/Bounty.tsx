import { Box, Button, Modal, Typography } from "@mui/material";
import CreateBounty from "./create-bounty";
import React from "react";
import ExistingBounty from "./existing-bounty";
import { Add } from "@mui/icons-material";
import { selector, useRecoilValue } from "recoil";
import { wallet } from "../index";

const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 800,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};
const nodeCountState = selector({
  key: "nodeCountState",
  get: async ({ get }) => {
    console.log("Nodescount state)");
    return await wallet.getNodeCount();
  },
});

export default function Bounty() {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  let nodeCount = 0;
  nodeCount = useRecoilValue(nodeCountState);

  return (
    <>
      <Button variant="contained" onClick={handleOpen} startIcon={<Add />}>
        Create Bounty
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="create-bounty-modal-title"
        aria-describedby="create-bounty-modal-description"
      >
        <Box sx={style}>
          <Typography
            id="create-bounty-modal-title"
            variant="h5"
            component="h2"
          >
            Create Bounty
          </Typography>
          <CreateBounty handleClose={handleClose} nodeCount={nodeCount} />
        </Box>
      </Modal>
      <ExistingBounty />
    </>
  );
}
