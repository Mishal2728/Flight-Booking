const HOME_TITLE = 'Flight Search & Group Flight Tickets | AERORA';
const HOME_DESCRIPTION = 'Search one-way, round-trip and flexible flights, compare cheapest dates, or enquire about curated group flight fares with AERORA Travel Co.';
const ADMIN_PREFIX = '/portal-admin-8f2a9c';
const OG_IMAGE = '/destination-singapore.jpg';

function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, name);
    document.head.appendChild(node);
  }
  node.content = content;
}

function removeMeta(name: string, attribute: 'name' | 'property' = 'name') {
  document.head.querySelector(`meta[${attribute}="${name}"]`)?.remove();
}

function setCanonical(href: string | null) {
  let node = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement('link');
    node.rel = 'canonical';
    document.head.appendChild(node);
  }
  node.href = href;
}

function setStructuredData(origin: string) {
  const root = new URL('/', origin).href;
  const organizationId = `${root}#organization`;
  const websiteId = `${root}#website`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'AERORA Travel Co.',
        url: root,
        email: 'hello@aerora.travel',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email: 'hello@aerora.travel',
          availableLanguage: 'English',
        },
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: root,
        name: 'AERORA Travel Co.',
        publisher: { '@id': organizationId },
        inLanguage: 'en-IN',
      },
      {
        '@type': 'WebPage',
        '@id': `${root}#webpage`,
        url: root,
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        isPartOf: { '@id': websiteId },
        about: { '@id': organizationId },
        inLanguage: 'en-IN',
      },
    ],
  };
  let node = document.getElementById('aerora-seo-jsonld') as HTMLScriptElement | null;
  if (!node) {
    node = document.createElement('script');
    node.id = 'aerora-seo-jsonld';
    node.type = 'application/ld+json';
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(graph);
}

function clearStructuredData() {
  document.getElementById('aerora-seo-jsonld')?.remove();
}

export function applyPageSeo(pathname: string, origin: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const isAdmin = path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);
  const isHomepage = path === '/';
  const isIndexable = isHomepage;

  const title = isHomepage ? HOME_TITLE : isAdmin ? 'Partner Portal | AERORA' : 'Page Not Found | AERORA';
  const description = isHomepage
    ? HOME_DESCRIPTION
    : isAdmin ? 'Authorized partner access for AERORA Travel Co.' : 'This public page is not available.';
  document.title = title;
  setMeta('description', description);
  setMeta('robots', isIndexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow');
  setMeta('googlebot', isIndexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow');
  setMeta('theme-color', '#07111e');
  setCanonical(isIndexable ? new URL('/', origin).href : null);

  if (!isHomepage) {
    for (const tag of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:image:width', 'og:image:height', 'og:image:type', 'og:locale', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
      removeMeta(tag, tag.startsWith('og:') ? 'property' : 'name');
    }
    clearStructuredData();
    return;
  }

  const image = new URL(OG_IMAGE, origin).href;
  setMeta('og:type', 'website', 'property');
  setMeta('og:site_name', 'AERORA Travel Co.', 'property');
  setMeta('og:title', title, 'property');
  setMeta('og:description', description, 'property');
  setMeta('og:url', new URL('/', origin).href, 'property');
  setMeta('og:image', image, 'property');
  setMeta('og:image:alt', 'Singapore skyline at dusk', 'property');
  setMeta('og:image:width', '1536', 'property');
  setMeta('og:image:height', '1024', 'property');
  setMeta('og:image:type', 'image/jpeg', 'property');
  setMeta('og:locale', 'en_IN', 'property');
  setMeta('summary_large_image', 'twitter:card');
  setMeta(title, 'twitter:title');
  setMeta(description, 'twitter:description');
  setMeta(image, 'twitter:image');
  setMeta('Singapore skyline at dusk', 'twitter:image:alt');
  setStructuredData(origin);
}
