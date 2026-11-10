import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { isKnownStudent, setCurrentStudent } from "../student";

export default function Landing() {
  const [studentId, setStudentId] = useState("");
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = studentId.trim();
    if (!id || checking) return;

    setCurrentStudent(id);
    if (!isKnownStudent(id)) {
      navigate("/placement");
      return;
    }

    // Returning student: resume an in-progress session if there is one,
    // otherwise land on the focus picker instead of assuming /loop --
    // /next now requires an active session (see content_engine.py).
    setChecking(true);
    try {
      const session = await api.getSession(id);
      navigate(session.active ? "/loop" : "/blocks");
    } catch {
      navigate("/blocks");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">NeuroTutor</h1>
        <p className="text-gray-600 mb-6">
          A neuro-symbolic Python tutor that reasons about *why* you're stuck, not
          just *that* you are.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your name or student ID
            </label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. alex_khan"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={checking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded shadow transition"
          >
            {checking ? "Checking..." : "Continue"}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-4">
          New here? You'll take a short placement quiz first. Returning students
          go straight back into their learning loop.
        </p>
      </div>
    </div>
  );
}
