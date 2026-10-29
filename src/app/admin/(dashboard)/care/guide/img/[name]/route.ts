import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Screenshots for the owner's guide (docs/website-care-guide). Behind the admin sign in like every /admin path. */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  if (!/^[a-z0-9-]+\.png$/.test(name)) return new Response('Not found', { status: 404 })
  try {
    const data = await readFile(join(process.cwd(), 'docs', 'website-care-guide', name))
    return new Response(new Uint8Array(data), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
