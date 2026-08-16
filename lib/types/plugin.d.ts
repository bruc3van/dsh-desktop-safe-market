import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './index.ts';
/**
 * Mount the market service.
 * @param ctx - host cordis context.
 * @param resolved - plugin configuration, already validated by the entry.
 * @returns a disposer for the entry's effect seat.
 */
export declare function applyMarket(ctx: Context, resolved: Config): () => void;
