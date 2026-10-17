import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { SessionExpiredGuard } from '@/components/common/session-expired-guard'

function fakeResponse(init: { status?: number; redirected?: boolean; url?: string; body?: unknown }): Response {
  const r = new Response(JSON.stringify(init.body ?? {}), { status: init.status ?? 200 })
  Object.defineProperty(r, 'redirected', { value: !!init.redirected })
  Object.defineProperty(r, 'url', { value: init.url ?? '' })
  return r
}

function mount(next: Response, props: Partial<Parameters<typeof SessionExpiredGuard>[0]> = {}) {
  window.fetch = vi.fn(async () => next) as typeof fetch
  render(
    <SessionExpiredGuard apiPrefix="/api/admin/" loginHref="/admin/login?reason=expired" expiredBody="다시 로그인하세요" {...props} />,
  )
}

describe('SessionExpiredGuard', () => {
  afterEach(() => {
    cleanup()
    push.mockReset()
  })

  it('관리자 API 401 → 로그인 만료 안내', async () => {
    mount(fakeResponse({ status: 401 }))
    await act(async () => void (await fetch('/api/admin/members')))
    expect(await screen.findByText('로그인이 만료되었어요')).toBeTruthy()
  })

  it('로그인 화면으로 리다이렉트된 응답도 만료로 본다(페이지용 가드 API)', async () => {
    mount(fakeResponse({ redirected: true, url: 'http://demo.localhost/admin/login' }))
    await act(async () => void (await fetch('/api/admin/board')))
    expect(await screen.findByText('로그인이 만료되었어요')).toBeTruthy()
  })

  it('다른 API·무시 목록은 감지하지 않는다', async () => {
    mount(fakeResponse({ status: 401 }), { ignore: ['/api/admin/ping'] })
    await act(async () => {
      await fetch('/api/donor/profile')
      await fetch('/api/admin/ping')
    })
    expect(screen.queryByText('로그인이 만료되었어요')).toBeNull()
  })

  it('CSRF 403 → 새로고침 안내', async () => {
    mount(fakeResponse({ status: 403, body: { code: 'CSRF_FORBIDDEN' } }))
    await act(async () => void (await fetch('/api/admin/x', { method: 'POST' })))
    expect(await screen.findByText('요청이 거부되었어요')).toBeTruthy()
  })

  it('dismissible이면 닫을 수 있고, 자동 이동 설정이 없으면 이동하지 않는다', async () => {
    mount(fakeResponse({ status: 401 }), { dismissible: true })
    await act(async () => void (await fetch('/api/admin/members')))
    fireEvent.click((await screen.findAllByRole('button', { name: '닫기' }))[0])
    await waitFor(() => expect(screen.queryByText('로그인이 만료되었어요')).toBeNull())
    expect(push).not.toHaveBeenCalled()
  })
})
