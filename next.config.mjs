/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // PIEMR serves its site assets from this CloudFront distribution.
      { protocol: 'https', hostname: 'd3md8ar2i5icyz.cloudfront.net' },
      { protocol: 'https', hostname: 'piemr.edu.in' },
      { protocol: 'https', hostname: 'www.piemr.edu.in' },
      { protocol: 'https', hostname: 'sih.gov.in' },
      { protocol: 'https', hostname: 'www.sih.gov.in' },
      // Bing's search-result thumbnail cache. Allowed only so a photo
      // sourced from there renders; see the note in src/lib/leadership.ts
      // about replacing it with an institute-hosted image.
      { protocol: 'https', hostname: 'th.bing.com' },
    ],
  },
};

export default nextConfig;
