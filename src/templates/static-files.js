import slugifyLib from 'slugify';

function slugify(name) {
  return slugifyLib(name, { lower: true, strict: true }).slice(0, 50);
}

export function generateStaticFiles(businessData) {
  const slug = slugify(businessData.name);

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slug,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '14.2.5',
          react: '^18',
          'react-dom': '^18',
          'react-icons': '^5.2.1',
          'lucide-react': '^0.400.0',
        },
        devDependencies: {
          autoprefixer: '^10.4.19',
          postcss: '^8.4.39',
          tailwindcss: '^3.4.6',
        },
      }, null, 2),
    },
    {
      path: 'jsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          paths: { '@/*': ['./src/*'] },
        },
      }, null, 2),
    },
    {
      path: 'next.config.js',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/webp', 'image/avif'],
    unoptimized: true,
    dangerouslyAllowSVG: true,
  },
  env: {
    BUSINESS_NAME: '${businessData.name.replace(/'/g, "\\'")}',
    BUSINESS_PHONE: '${(businessData.phone || '').replace(/'/g, "\\'")}',
    BUSINESS_ADDRESS: '${(businessData.address || '').replace(/'/g, "\\'")}',
  },
};

module.exports = nextConfig;
`,
    },
    {
      path: 'tailwind.config.js',
      content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
    },
    {
      path: 'postcss.config.js',
      content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    },
    {
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply antialiased;
  }
}
`,
    },
  ];
}
