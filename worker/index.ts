/**
 * Cloudflare Worker：静态资产（dist）未命中的请求进入本脚本，按前缀白名单反代：
 *   /api/* → https://api.bgm.tv/*   （剥前缀转发，query 原样附带）
 *   /img/* → https://lain.bgm.tv/*  （剥前缀转发，长缓存）
 * 其余一律 403，防止被滥用为公共代理。
 *
 * 注意：响应头显式构造最小头集，不整体复制回源响应头——Workers fetch 通常已自动
 * 解压 body，回源头中的 Content-Encoding / Content-Length 与实际内容不再匹配。
 */

const UA = 'dream/acg-grid/0.1.0 (https://grid.1dream.online)';

const ROUTES: Record<string, string> = {
  api: 'https://api.bgm.tv',
  img: 'https://lain.bgm.tv',
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const prefix = url.pathname.split('/')[1];
    const originBase = ROUTES[prefix];
    if (!originBase) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const target = originBase + url.pathname.slice(prefix.length + 1) + url.search;
    const isImg = prefix === 'img';

    // 请求头：注入规范 UA（浏览器无法自定义 UA），透传 Content-Type（POST 搜索体为 JSON）
    const fwd: Record<string, string> = { 'User-Agent': UA };
    const ct = request.headers.get('Content-Type');
    if (ct) fwd['Content-Type'] = ct;

    let resp: Response;
    try {
      resp = await fetch(target, {
        method: request.method,
        headers: fwd,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        // GET 缓存减少回源；POST（搜索）不缓存直传
        // @ts-expect-error cf 选项由 Cloudflare 运行时提供，类型库未覆盖
        cf: isImg
          ? { cacheEverything: true, cacheTtl: 2592000 }
          : request.method === 'GET'
            ? { cacheTtl: 300 }
            : undefined,
      });
    } catch {
      return new Response(JSON.stringify({ error: 'upstream unreachable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', resp.headers.get('Content-Type') ?? 'application/octet-stream');
    if (isImg) {
      // bangumi 封面 URL 是内容地址、永不变化，可放心长缓存（回源自带 30 天，此处双保险）
      headers.set('Cache-Control', 'public, max-age=2592000, immutable');
    }
    return new Response(resp.body, { status: resp.status, headers });
  },
};
