import React from 'react';

type Props = {
  children: React.ReactNode;
  loading: boolean;
  data: any[];
  emptyMessage?: string;
  modulename?: string;
  numColumns?: number; // New: Dynamic colSpan for empty/loading
};

export function TableContainer({ 
  children, 
  loading, 
  data, 
  emptyMessage = 'No records found.', 
  modulename = '', 
  numColumns = 6 
}: Props) {
  const colSpan = numColumns;

  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500">Loading {modulename}...</p>
          </div>
        </td>
      </tr>
    );
  }

  if (data.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-16 text-center">
          <div className="text-sm text-gray-500">{emptyMessage}</div>
        </td>
      </tr>
    );
  }

  return <>{children}</>;
}