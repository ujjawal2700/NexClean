/** A vehicle category key — admin-managed, not a fixed set. */
export type CarType = string;
type CarSilhouetteProps = {
    type?: CarType;
    className?: string;
    /** unique id base to avoid gradient collisions when many render */
    uid?: string;
};
export declare function CarSilhouette({ type, className, uid }: CarSilhouetteProps): import("react").JSX.Element;
export {};
