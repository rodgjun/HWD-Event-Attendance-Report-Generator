export function Landing() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to HWD Attendance & Events</h1>
      <p className="text-gray-700">Follow these steps to use the system:</p>
      <ol className="list-decimal pl-6 space-y-2 text-gray-800">
        <li>Create or verify events under the Events page.</li>
        <li>Upload Registrations using the template on Registrations.</li>
        <li>Record Attendance via manual entry or file upload.</li>
        <li>View analytics and export from the Reports page.</li>
      </ol>
      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <div className="font-medium">CSV Templates</div>
        <ul className="list-disc pl-6 text-sm text-gray-700">
          <li>Events.csv: Event ID | Event Type | Event Name | Event Date</li>
          <li>Registration.csv: Employee No | Employee Name | Department | Event Name | Status</li>
          <li>Attendance.csv: Employee No | Employee Name | Department | Mode of Attendance | Event Name</li>
        </ul>
      </div>
    </div>
  );
}


