import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface Props<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: ReactNode
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export default function Table<T>({ columns, rows, rowKey, empty }: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 text-xs font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400 ${alignClass[column.align ?? 'left']} ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                {empty ?? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nothing to show yet.</p>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-slate-700 dark:text-slate-300 ${alignClass[column.align ?? 'left']} ${column.className ?? ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
