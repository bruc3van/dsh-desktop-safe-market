import type { ReviewMode } from './reviewMode.ts';
import type { MarketLocale } from './copy.ts';
export declare function ReviewSelector({ id, describedBy, value, disabled, onChange, t }: {
    id: string;
    describedBy: string;
    value: ReviewMode;
    disabled: boolean;
    onChange: (mode: ReviewMode) => void;
    t: MarketLocale;
}): import("react").JSX.Element;
