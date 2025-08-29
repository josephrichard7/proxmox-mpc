import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    // Performance optimizations
    target: 'es2020',
    minify: 'terser',
    sourcemap: false, // Disable for production
    
    // Terser options for better compression
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      format: {
        comments: false,
      },
    },
    
    // Code splitting optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/form'],
          query: ['@tanstack/react-query'],
          charts: ['recharts', 'd3'],
          editor: ['@monaco-editor/react'],
          icons: ['@tabler/icons-react'],
          
          // UI chunks by feature
          dashboard: [
            './src/pages/DashboardPage.tsx',
            './src/components/dashboard'
          ],
          vms: [
            './src/pages/vms/VMsPage.tsx', 
            './src/pages/vms/VMDetailsPage.tsx'
          ],
          containers: ['./src/pages/containers/ContainersPage.tsx'],
          nodes: ['./src/pages/nodes/NodesPage.tsx'],
          
          // Common UI components
          common: [
            './src/components/common',
            './src/components/layout'
          ]
        },
        
        // Asset naming for caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    
    // Build size limits
    chunkSizeWarningLimit: 500,
  },
  
  // Development server optimizations
  server: {
    hmr: {
      overlay: false
    },
    host: true,
    port: 3001
  },
  
  // CSS optimization
  css: {
    devSourcemap: true
  },
  
  // Enable esbuild optimizations
  esbuild: {
    target: 'esnext',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mantine/core',
      '@mantine/hooks',
      '@tanstack/react-query',
      'axios'
    ],
    exclude: ['@monaco-editor/react'] // Let Monaco load its own workers
  }
});