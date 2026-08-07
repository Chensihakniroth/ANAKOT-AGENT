/**
 * Shared pagination helpers for paged lists.
 *
 * `paginationItems` builds the numbered-button window (with ellipsis elisions)
 * shown by the `Pagination*` UI components. Mirrors the window used by the
 * Artifacts page so every paged view in the app reads the same.
 */

/**
 * Returns a compact sequence of page numbers with an 'ellipsis' sentinel where
 * runs are elided, e.g. `[1, 'ellipsis', 4, 5, 6, 'ellipsis', 42]` for page 5
 * of 42. The first and last pages are always included; the window around the
 * current page is one page on each side (artifacts convention).
 */
export function paginationItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) {
    pages.push('ellipsis')
  }

  for (let nextPage = start; nextPage <= end; nextPage += 1) {
    pages.push(nextPage)
  }

  if (end < pageCount - 1) {
    pages.push('ellipsis')
  }

  pages.push(pageCount)

  return pages
}
