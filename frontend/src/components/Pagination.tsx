type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function Pagination({ page, totalPages, onPageChange, disabled }: Props) {
  return (
    <div className="flex space-x-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1 || disabled}
        className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
      >
        Previous
      </button>
      <span className="px-3 py-2 text-sm">{page} / {totalPages}</span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages || disabled}
        className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}