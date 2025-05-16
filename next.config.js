/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	webpack: (config) => {
		config.externals.push("pino-pretty", "lokijs", "encoding");
		return config;
	},
	swcMinify: false,
	experimental: {
		serverActions: false,
	},
};

module.exports = nextConfig;
