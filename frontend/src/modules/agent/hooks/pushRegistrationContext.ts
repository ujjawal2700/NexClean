import { createContext, useContext } from "react";

/** Registration must finish before the dashboard can report missing alerts. */
export const PushRegistrationContext = createContext(true);
export const usePushRegistrationPending = () => useContext(PushRegistrationContext);
