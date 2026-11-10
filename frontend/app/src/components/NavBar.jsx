import { Link, useNavigate } from "react-router-dom";
import { clearCurrentStudent, getCurrentStudent } from "../student";

export default function NavBar() {
  const navigate = useNavigate();
  const studentId = getCurrentStudent();

  const switchStudent = () => {
    clearCurrentStudent();
    navigate("/");
  };

  return (
    <nav className="bg-blue-600 text-white px-4 py-3 shadow-md flex items-center justify-between flex-wrap gap-2">
      <Link to="/loop" className="text-lg font-bold tracking-tight">
        NeuroTutor
      </Link>
      {studentId && (
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          <Link
            to="/loop"
            className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-full transition"
          >
            Learning Loop
          </Link>
          <Link
            to="/mastery"
            className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-full transition"
          >
            Dashboard
          </Link>
          <span className="hidden sm:inline bg-blue-800 px-3 py-1.5 rounded-full">
            {studentId}
          </span>
          <button
            onClick={switchStudent}
            className="bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded-full transition"
          >
            Switch
          </button>
        </div>
      )}
    </nav>
  );
}
