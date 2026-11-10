import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:8080';
const adminProxy = {
  target: backend,
  changeOrigin: true,
  // The obscured prefix is also the client-side route; proxy only its API subpaths.
  bypass(req: { url?: string }) {
    const path = req.url?.split('?')[0];
    if (path === '/portal-admin-8f2a9c' || path === '/portal-admin-8f2a9c/') return '/';
  },
};
const proxy = {
  '/api/v1': { target: backend, changeOrigin: true },
  '/portal-admin-8f2a9c': adminProxy,
};

function seoAssetPlugin(publicSiteUrl?: string): Plugin {
  const configuredOrigin = () => {
    if (!publicSiteUrl?.trim()) return null;
    const url = new URL(publicSiteUrl.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || (url.pathname !== '/' && url.pathname !== '')) {
      throw new Error('VITE_PUBLIC_SITE_URL must be an http(s) origin at the site root, for example https://your-real-domain.');
    }
    return url.origin;
  };
  const originForRequest = (req: { headers: Record<string, string | string[] | undefined> }) => {
    const configured = configuredOrigin();
    if (configured) return configured;
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
    const rawHost = String(hostHeader || req.headers.host || '').split(',')[0].trim();
    if (!rawHost) return null;
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    const protocol = String(protoHeader || (rawHost.indexOf('localhost') === 0 || rawHost.indexOf('127.0.0.1') === 0 ? 'http' : 'https')).split(',')[0].trim();
    return new URL(`${protocol}://${rawHost}`).origin;
  };
  const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const sitemap = (origin: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${xmlEscape(new URL('/', origin).href)}</loc></url>\n</urlset>\n`;
  const robots = (origin: string | null) => `User-agent: *\nAllow: /\nDisallow: /portal-admin-8f2a9c\nDisallow: /api/\n${origin ? `Sitemap: ${new URL('/sitemap.xml', origin).href}\n` : ''}`;
  const serveSeoFile = (req: { url?: string; headers: Record<string, string | string[] | undefined> }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path !== '/robots.txt' && path !== '/sitemap.xml') return next();
    const origin = originForRequest(req);
    if (path === '/sitemap.xml' && !origin) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Set VITE_PUBLIC_SITE_URL to serve an absolute sitemap URL.');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', path === '/sitemap.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
    res.end(path === '/sitemap.xml' ? sitemap(origin!) : robots(origin));
  };
  return {
    name: 'aerora-seo-assets',
    transformIndexHtml(html) {
      const origin = configuredOrigin();
      if (!origin) return html;
      return html
        .replace('href="/" />\n    <link rel="preload"', `href="${origin}/" />\n    <link rel="preload"`)
        .replace('id="og-url" content="/"', `id="og-url" content="${origin}/"`)
        .replace('id="og-image" content="/destination-singapore.jpg"', `id="og-image" content="${origin}/destination-singapore.jpg"`)
        .replace('content="/destination-singapore.jpg" />\n    <meta name="twitter:image:alt"', `content="${origin}/destination-singapore.jpg" />\n    <meta name="twitter:image:alt"`);
    },
    configureServer(server) {
      server.middlewares.use(serveSeoFile as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveSeoFile as never);
    },
    generateBundle() {
      const origin = configuredOrigin();
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(origin) });
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(origin) });
      else this.warn('VITE_PUBLIC_SITE_URL is not configured: robots.txt will omit its Sitemap directive, and sitemap.xml is not emitted to avoid inventing a production domain.');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), seoAssetPlugin(env.VITE_PUBLIC_SITE_URL)],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      proxy,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.indexOf('node_modules/recharts') !== -1) return 'charts';
            if (id.indexOf('node_modules/framer-motion') !== -1 || id.indexOf('node_modules/gsap') !== -1 || id.indexOf('node_modules/lenis') !== -1) return 'motion';
            if (id.indexOf('node_modules/react') !== -1) return 'react-vendor';
          },
        },
      },
    },
  };
});
