/**
 * Environment variable helper for Remix loaders
 *
 * Handles the different locations where environment variables
 * are placed depending on the runtime context:
 * - Development: context.env (via remixCloudflareDevProxy)
 * - Production: context.cloudflare.env (via Cloudflare Pages)
 */
export function getEnv(context: any): Record<string, any> {
  return (
    (context as any)?.env ||         // Development mode (cast to any for TypeScript)
    context?.cloudflare?.env ||      // Production Cloudflare Workers/Pages
    context?.env ||                  // Fallback location
    {}                               // Empty object fallback
  );
}
