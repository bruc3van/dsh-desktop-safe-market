import { type RefObject } from 'react';
/** Return the active list to its start without scrolling the surrounding app. */
export declare function BackToTop({ root, page, label }: {
    root: RefObject<HTMLDivElement>;
    page: string;
    label: string;
}): import("react").JSX.Element | null;
