import { Router, type IRouter } from "express";
import healthRouter from "./health";
import animalsRouter from "./animals";
import inbreedingRouter from "./inbreeding";

const router: IRouter = Router();

router.use(healthRouter);
router.use(animalsRouter);
router.use(inbreedingRouter);

export default router;
