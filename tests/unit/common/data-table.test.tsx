import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type DataTableColumn } from '@/components/common/data-table'

interface Row { id: string; name: string }

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: '이름', render: (r) => r.name },
]

describe('DataTable', () => {
  it('rows=[] + emptyMessage 지정 시 메시지 렌더', () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="데이터가 없습니다."
      />
    )
    expect(screen.getByText('데이터가 없습니다.')).toBeTruthy()
  })

  it('isLoading=true 시 skeleton 렌더', () => {
    const { container } = render(
      <DataTable<Row>
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        isLoading
      />
    )
    const skeletons = container.querySelectorAll('[data-slot="table-skeleton-row"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('selectable + 행 체크박스 클릭 시 onSelectionChange 호출', () => {
    const rows: Row[] = [{ id: 'a', name: 'Alice' }]
    const onSelectionChange = vi.fn()
    render(
      <DataTable<Row>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectable
        selectedIds={new Set()}
        onSelectionChange={onSelectionChange}
      />
    )
    const checkboxes = screen.getAllByRole('checkbox')
    // [0] = header 전체선택, [1] = row
    fireEvent.click(checkboxes[1])
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['a']))
  })
})
