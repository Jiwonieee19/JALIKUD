import Button from './Button'

interface Props {
  page: number
  lastPage: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
  /** Noun for the row count line, e.g. "users" -> "1-10 of 34 users". */
  itemLabel?: string
}

/**
 * Page numbers to render, with `null` marking an ellipsis gap.
 *
 * Always shows the first and last page plus a window around the current one, so
 * the control stays a fixed width instead of growing one button per page.
 */
function pageWindow(page: number, lastPage: number): Array<number | null> {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1)

  const pages = new Set<number>([1, lastPage, page])
  for (const offset of [-1, 1]) {
    const candidate = page + offset
    if (candidate > 1 && candidate < lastPage) pages.add(candidate)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const withGaps: Array<number | null> = []
  let previous = 0
  for (const value of sorted) {
    if (previous && value - previous > 1) withGaps.push(null)
    withGaps.push(value)
    previous = value
  }
  return withGaps
}

export default function Pagination({
  page,
  lastPage,
  total,
  perPage,
  onPageChange,
  itemLabel = 'rows',
}: Props) {
  // lastPage is floored at 1 everywhere so a single page is still "page 1 of 1".
  const safePage = Math.min(Math.max(page, 1), lastPage)
  const firstRow = total === 0 ? 0 : (safePage - 1) * perPage + 1
  const lastRow = Math.min(safePage * perPage, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span className="tabular-nums">
        {total === 0
          ? `No ${itemLabel}`
          : `${firstRow}-${lastRow} of ${total} ${itemLabel}`}
      </span>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          ‹
        </Button>

        {pageWindow(safePage, lastPage).map((value, index) =>
          value === null ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={value}
              variant={value === safePage ? 'primary' : 'secondary'}
              className="px-2.5 py-1 text-xs tabular-nums"
              aria-current={value === safePage ? 'page' : undefined}
              onClick={() => onPageChange(value)}
            >
              {value}
            </Button>
          ),
        )}

        <Button
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          disabled={safePage >= lastPage}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          ›
        </Button>
      </nav>
    </div>
  )
}