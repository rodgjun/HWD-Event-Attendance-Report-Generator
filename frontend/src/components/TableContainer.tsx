type Props = {
  children: React.ReactNode;
  loading: boolean;
  data: any[];
  emptyMessage?: string;
};

export function TableContainer({ children, loading, data, emptyMessage = 'No records found.' }: Props) {
  if (loading) {
    return (
      <tr>
        <td colSpan={6} className="px-6 py-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500">Loading registrations...</p>
          </div>
        </td>
      </tr>
    );
  }

  if (data.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-6 py-16 text-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-normal text-gray-500">{emptyMessage}</p>
          </div>
        </td>
      </tr>
    );
  }

  return <>{children}</>;
}