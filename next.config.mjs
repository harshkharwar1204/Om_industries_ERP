/** @type {import('next').NextConfig} */
// Allow a second dev/prod instance (worker app on :3001) to use its own build dir
// so two `next` processes don't clobber the same .next folder and 404 each other.
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
export default nextConfig;
