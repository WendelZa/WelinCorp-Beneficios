import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proposalsRouter from "./proposals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proposalsRouter);

export default router;
