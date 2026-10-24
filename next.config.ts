import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  async headers() {
    return [
      {
        /*
          The Inspiration library's pages may never be shown inside another
          website (in an <iframe>). Otherwise a website could load, say, the
          bookmarklet's "Save to a board" window invisibly on top of its own
          page and trick you into clicking Save ("clickjacking"). Both
          headers say the same thing: frame-ancestors for current browsers,
          X-Frame-Options for older ones. Only this prototype is affected.
        */
        source: "/prototypes/inspiration-library/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
