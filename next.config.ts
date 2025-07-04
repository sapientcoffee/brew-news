import type { NextConfig } from 'next';

const firebaseWebAppConfig = process.env.FIREBASE_WEBAPP_CONFIG ? JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG) : {};

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseWebAppConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseWebAppConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseWebAppConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseWebAppConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseWebAppConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseWebAppConfig.appId,
  }
};

export default nextConfig;
