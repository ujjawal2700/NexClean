import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { userRouter } from "../modules/user/user.routes";
import { bookingRouter } from "../modules/booking/booking.routes";
import { subscriptionRouter } from "../modules/subscription/subscription.routes";
import { catalogRouter } from "../modules/catalog/catalog.routes";

/** Mounts every module router under /api. */
export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/subscriptions", subscriptionRouter);
apiRouter.use("/catalog", catalogRouter);
