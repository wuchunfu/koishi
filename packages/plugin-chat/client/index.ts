import { router } from 'koishi-plugin-webui/client'
import Chat from './chat.vue'
import 'vite/dynamic-import-polyfill'

router.addRoute({
  path: '/chat',
  name: '聊天',
  meta: { icon: 'comments', require: ['user'], authority: 4 },
  component: Chat,
})
