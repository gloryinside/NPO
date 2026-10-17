import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConfirmProvider, useConfirm } from '@/components/ui/confirm-dialog'

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button
      onClick={async () => onResult(await confirm({ title: '약정을 해지할까요?', description: '다음 결제부터 멈춥니다.', confirmText: '해지', tone: 'danger' }))}
    >
      열기
    </button>
  )
}

const setup = () => {
  const results: boolean[] = []
  render(
    <ConfirmProvider>
      <Harness onResult={(ok) => results.push(ok)} />
    </ConfirmProvider>,
  )
  fireEvent.click(screen.getByText('열기'))
  return results
}

describe('useConfirm', () => {
  it('확인을 누르면 true', async () => {
    const results = setup()
    expect(await screen.findByText('약정을 해지할까요?')).toBeTruthy()
    expect(screen.getByText('다음 결제부터 멈춥니다.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '해지' }))
    await waitFor(() => expect(results).toEqual([true]))
  })

  it('취소를 누르면 false', async () => {
    const results = setup()
    fireEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(results).toEqual([false]))
  })

  it('Provider 밖에서 쓰면 바로 알려 준다', () => {
    const Bad = () => { useConfirm(); return null }
    expect(() => render(<Bad />)).toThrow(/ConfirmProvider/)
  })
})
