import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { userRouter } from "../modules/user/user.routes";
import { bookingRouter } from "../modules/booking/booking.routes";
import { subscriptionRouter } from "../modules/subscription/subscription.routes";
import { catalogRouter } from "../modules/catalog/catalog.routes";
import { notificationRouter } from "../modules/notification/notification.routes";
import { areaAlertRouter } from "../modules/area-alert/areaAlert.routes";
import { paymentRouter } from "../modules/payment/payment.routes";
import { agentRouter } from "../modules/agent/agent.routes";
import { adminRouter } from "../modules/admin/admin.routes";

/** Mounts every module router under /api. */
export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/bookings", bookingRouter);
apiRouter.use("/subscriptions", subscriptionRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/area-alerts", areaAlertRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/agent", agentRouter);
apiRouter.use("/admin", adminRouter);
