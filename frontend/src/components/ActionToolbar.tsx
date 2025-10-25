import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function ActionToolbar({ children }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 border-b rounded-t-lg">
      {children}
    </div>
  );
}