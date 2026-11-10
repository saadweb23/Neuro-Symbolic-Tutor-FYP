import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentStudent } from "../student";
import NavBar from "../components/NavBar";
import ConceptGrid from "../components/ConceptGrid";

export default function Mastery() {
  const studentId = getCurrentStudent();
  const navigate = useNavigate();
  const [beliefs, setBeliefs] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMastery(studentId);
      setBeliefs(data.beliefs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!studentId) {
      navigate("/");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (!studentId) return null;

  const avg =
    beliefs && Object.values(beliefs).length
      ? Object.values(beliefs).reduce((a, b) => a + b, 0) / Object.values(beliefs).length
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Mastery Dashboard</h2>
            <p className="text-gray-500 text-sm">
              Live belief vector from the Dual-GCN tracker -- 25 concepts, updated after
              every interaction.
            </p>
          </div>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded shadow transition"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded p-4 mb-4">
            {error}
          </div>
        )}

        {loading && <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Loading...</div>}

        {!loading && beliefs && (
          <div className="bg-white rounded-lg shadow-lg p-5 sm:p-8">
            {avg !== null && (
              <div className="mb-6 flex items-center gap-4">
                <div className="text-3xl font-bold text-blue-700">{Math.round(avg * 100)}%</div>
                <div className="text-sm text-gray-500">average mastery across the curriculum</div>
              </div>
            )}
            <div className="flex items-center gap-4 mb-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> mastered (&ge;70%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> developing (40-70%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> weak (&lt;40%)
              </span>
            </div>
            <ConceptGrid beliefs={beliefs} />
          </div>
        )}
      </div>
    </div>
  );
}
