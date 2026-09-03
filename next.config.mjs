/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'piemr.edu.in' },
      { protocol: 'https', hostname: 'www.piemr.edu.in' },
      { protocol: 'https', hostname: 'sih.gov.in' },
      { protocol: 'https', hostname: 'www.sih.gov.in' },
    ],
  },
};

export default nextConfig;
