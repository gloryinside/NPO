import { afterEach, describe, it, expect, vi } from 'vitest'
import { facebookShareUrl, hasShareProvider, registerShareProvider, shareTo, withShareUtm } from '@/lib/share'

const content = { url: 'https://hope.example.org/c/winter', title: '겨울 나눔' }

afterEach(() => registerShareProvider('kakao', null))

describe('공유', () => {
  it('공유 링크에 유입 경로를 붙이고, 이미 있으면 그대로 둔다', () => {
    expect(withShareUtm(content.url, 'kakao')).toBe('https://hope.example.org/c/winter?utm_source=kakao&utm_medium=share')
    expect(withShareUtm('https://a.kr/?utm_source=news', 'kakao')).toBe('https://a.kr/?utm_source=news')
    expect(facebookShareUrl(content.url)).toContain(encodeURIComponent('utm_source=facebook'))
  })

  it('카카오 provider가 없으면 기기 공유 창을 쓴다', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    expect(hasShareProvider('kakao')).toBe(false)
    expect(await shareTo('kakao', content, { share })).toBe('native')
    expect(share.mock.calls[0][0].url).toContain('utm_source=kakao')
  })

  it('공유 창도 없으면 링크를 복사한다', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)
    expect(await shareTo('kakao', content, { copy })).toBe('copied')
  })

  it('공유 창을 사용자가 닫으면 복사로 넘어가지 않는다', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' })
    const copy = vi.fn()
    expect(await shareTo('kakao', content, { share: vi.fn().mockRejectedValue(abort), copy })).toBe('native')
    expect(copy).not.toHaveBeenCalled()
  })

  it('준비된 provider가 있으면 그 채널로 공유한다', async () => {
    const provider = { isReady: () => true, share: vi.fn().mockResolvedValue(undefined) }
    registerShareProvider('kakao', provider)
    expect(await shareTo('kakao', content, {})).toBe('shared')
    expect(provider.share).toHaveBeenCalledOnce()
  })

  it('provider가 실패하면 대체 경로로 간다', async () => {
    registerShareProvider('kakao', { isReady: () => true, share: vi.fn().mockRejectedValue(new Error('sdk')) })
    expect(await shareTo('kakao', content, { copy: vi.fn().mockResolvedValue(undefined) })).toBe('copied')
  })

  it('링크 복사는 공유 창을 띄우지 않는다', async () => {
    const share = vi.fn()
    expect(await shareTo('link', content, { share, copy: vi.fn().mockResolvedValue(undefined) })).toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })

  it('아무 수단도 없으면 실패로 알린다', async () => {
    expect(await shareTo('kakao', content, {})).toBe('failed')
  })
})
