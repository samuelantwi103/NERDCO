import { useState } from 'react';

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(0);
  const total = Math.ceil(items.length / pageSize);
  const slice = items.slice(page * pageSize, (page + 1) * pageSize);
  return { slice, page, total, setPage };
}
