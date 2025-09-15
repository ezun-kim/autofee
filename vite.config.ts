import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  base: '/autofee/', // 이 부분 중요! repo 이름과 일치해야 함
  plugins: [react()],
})
