/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "chrzzzworkzppcezcuwl.supabase.co",
      },
    ],
  },
};

export default nextConfig;
