import type { Router, RouteRecordRaw } from 'vue-router'
import { currentSession } from '@/mock/personal/session'
export const personalRoutes: RouteRecordRaw[] = [
  {
    path: '/auth/login',
    name: 'PersonalLogin',
    component: () => import('@/views/personal/Login.vue')
  },
  {
    path: '/',
    component: () => import('@/views/personal/Layout.vue'),
    redirect: '/my-goals',
    children: [
      {
        path: 'my-goals',
        component: () => import('@/views/personal/goals/index.vue'),
        meta: { title: '我的季度目标' }
      },
      {
        path: 'my-weekly',
        component: () => import('@/views/personal/weekly/index.vue'),
        meta: { title: '我的周报' }
      },
      {
        path: 'my-reviews',
        component: () => import('@/views/personal/reviews/index.vue'),
        meta: { title: '我的绩效汇报' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/my-goals' }
]
/** 原型独立访问守卫。 */
export function setupPersonalGuard(router: Router) {
  router.beforeEach((to) => {
    const session = currentSession()
    if (to.path !== '/auth/login' && !session) {
      return { path: '/auth/login', query: { message: '请先通过飞书登录' } }
    }
    if (to.path === '/auth/login' && session) return '/my-weekly'
    document.title = `${String(to.meta.title || '飞书登录')} · 个人 OKR`
    return true
  })
}
