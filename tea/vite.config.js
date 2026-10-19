import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:8000'

  const proxyConfig = {
    target: backendTarget,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        // pot/src/SlicerAPI/api/v1/routes/generate.py defines @router.get("/", ... content: GenerateResponse = Body())
        // In browser environments, fetch() cannot send a body with GET methods.
        // The frontend sends POST with the JSON body, and the Vite proxy translates the method to GET
        // so that the FastAPI backend accepts the request and parses the body.
        if (req.method === 'POST' && req.url && req.url.includes('/generate')) {
          proxyReq.method = 'GET'
        }
      })
    },
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/v1': proxyConfig,
      },
    },
    preview: {
      proxy: {
        '/v1': proxyConfig,
      },
    },
  }
})
