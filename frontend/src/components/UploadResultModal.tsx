import { AnimatePresence, motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

type Result = {
  inserted: number;
  skipped?: number;
  skip_details?: { reason: string }[];
};

type Props = {
  result: Result | null;
  isOpen: boolean;
  onClose: () => void;
};

export function UploadResultModal({ result, isOpen, onClose }: Props) {
  if (!result) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-25 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-white rounded-lg max-w-md w-full max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Upload Results</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">Inserted: <strong>{result.inserted}</strong></p>
              {result.skipped !== undefined && (
                <p className="text-sm text-gray-600">Skipped: <strong>{result.skipped}</strong></p>
              )}
              {result.skip_details && result.skip_details.length > 0 && (
                <div className="mt-3">
                  <h4 className="font-medium text-gray-900 mb-1">Skip Details:</h4>
                  <ul className="text-xs text-gray-600 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                    {result.skip_details.map((detail, idx) => (
                      <li key={idx} className="py-1 border-b last:border-0">{detail.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}