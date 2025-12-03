import { useParams } from 'react-router-dom';

function ReportIssuePage() {
  const { requestId } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Report an Issue
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Request ID: {requestId}
        </p>
      </div>
    </div>
  );
}

export default ReportIssuePage;

