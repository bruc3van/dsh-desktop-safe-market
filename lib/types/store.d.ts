/**
 * The market's durable domain: the reduced catalog and the ETags that let the
 * next read ask conditionally.
 *
 * Caching the reduction rather than the crawl is the point. The snapshot is
 * 2.4 MB and moves once a day; what the browser needs is the ~100 rows it was
 * reduced to. Keeping those on disk means a Host restart costs two 304s
 * instead of a full download, and a Host that cannot reach GitHub at all
 * still opens the market with the last catalog it saw.
 */
import { z } from 'zod';
/** The durable state: one catalog, plus what it was fetched with. */
export declare const safeMarketDomainState: z.ZodObject<{
    catalog: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
        items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            fullName: z.ZodString;
            owner: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            description: z.ZodString;
            stars: z.ZodNumber;
            language: z.ZodString;
            license: z.ZodString;
            pushedAt: z.ZodString;
            defaultBranch: z.ZodString;
            category: z.ZodString;
            categoryZh: z.ZodString;
            categoryEn: z.ZodString;
        }, z.core.$strip>>>>;
        categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            key: z.ZodString;
            zh: z.ZodString;
            en: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>>>;
        fetchedAt: z.ZodString;
        refreshedAt: z.ZodString;
        scanned: z.ZodNumber;
    }, z.core.$strip>>, z.ZodNull]>;
    repositoriesEtag: z.ZodString;
    curatedEtag: z.ZodString;
    marketSize: z.ZodNumber;
    catalogBase: z.ZodString;
}, z.core.$strip>;
/** Durable market state inferred from {@link safeMarketDomainState}. */
export type SafeMarketDomainState = z.infer<typeof safeMarketDomainState>;
/** The empty state a first run opens with. */
export declare const initialDomainState: SafeMarketDomainState;
/**
 * The `safe-market` domain spec: one global singleton, no tables. The plugin
 * opens this through `ctx.storageDomain`; the spec object is the single
 * source of the domain's identity, version, and schema.
 */
export declare const safeMarketDomainSpec: {
    name: string;
    version: number;
    global: {
        schema: z.ZodObject<{
            catalog: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
                items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    fullName: z.ZodString;
                    owner: z.ZodString;
                    name: z.ZodString;
                    url: z.ZodString;
                    description: z.ZodString;
                    stars: z.ZodNumber;
                    language: z.ZodString;
                    license: z.ZodString;
                    pushedAt: z.ZodString;
                    defaultBranch: z.ZodString;
                    category: z.ZodString;
                    categoryZh: z.ZodString;
                    categoryEn: z.ZodString;
                }, z.core.$strip>>>>;
                categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                    key: z.ZodString;
                    zh: z.ZodString;
                    en: z.ZodString;
                    count: z.ZodNumber;
                }, z.core.$strip>>>>;
                fetchedAt: z.ZodString;
                refreshedAt: z.ZodString;
                scanned: z.ZodNumber;
            }, z.core.$strip>>, z.ZodNull]>;
            repositoriesEtag: z.ZodString;
            curatedEtag: z.ZodString;
            marketSize: z.ZodNumber;
            catalogBase: z.ZodString;
        }, z.core.$strip>;
        initial: {
            catalog: Readonly<{
                items: readonly Readonly<{
                    fullName: string;
                    owner: string;
                    name: string;
                    url: string;
                    description: string;
                    stars: number;
                    language: string;
                    license: string;
                    pushedAt: string;
                    defaultBranch: string;
                    category: string;
                    categoryZh: string;
                    categoryEn: string;
                }>[];
                categories: readonly Readonly<{
                    key: string;
                    zh: string;
                    en: string;
                    count: number;
                }>[];
                fetchedAt: string;
                refreshedAt: string;
                scanned: number;
            }> | null;
            repositoriesEtag: string;
            curatedEtag: string;
            marketSize: number;
            catalogBase: string;
        };
    };
    tables: {};
};
