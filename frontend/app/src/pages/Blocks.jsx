import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentStudent } from "../student";
import NavBar from "../components/NavBar";
import { tierFor, TIER_BAR_CLASSES } from "../tiers";

export default function Blocks() {
  const studentId = getCurrentStudent();
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(null);

  const load = () => {
    api
      .getBlocks(studentId)
      .then((data) => setBlocks(data.blocks))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (!studentId) {
      navigate("/");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const choose = async (blockIndex) => {
    setStarting(blockIndex);
    try {
      await api.startSession(studentId, blockIndex);
      navigate("/loop");
    } catch (err) {
      setError(err.message);
      setStarting(null);
    }
  };

  if (!studentId) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-1">Choose a Focus Area</h2>
        <p className="text-gray-500 text-sm mb-6">
          Each area is a self-contained session (5 concepts, up to 15 rounds) -- pick the one
          that needs the most work, or whichever you'd like to practice.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded p-4 mb-4">
            {error}
          </div>
        )}

        {!blocks && !error && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Loading...</div>
        )}

        {blocks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {blocks.map((block) => {
              const tier = tierFor(block.average_mastery);
              return (
                <button
                  key={block.index}
                  onClick={() => choose(block.index)}
                  disabled={starting !== null}
                  className="text-left bg-white rounded-lg shadow hover:shadow-lg border border-gray-200 hover:border-blue-300 p-5 transition disabled:opacity-60"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{block.name}</h3>
                    {block.complete && (
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                        COMPLETE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{block.concepts.join(" · ")}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${TIER_BAR_CLASSES[tier]}`}
                      style={{ width: `${Math.min(100, block.average_mastery * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-sm">
                    <span className="text-gray-600">
                      {Math.round(block.average_mastery * 100)}% average
                    </span>
                    <span className="text-gray-400">
                      weakest: {block.weakest_concept} ({Math.round(block.weakest_belief * 100)}%)
                    </span>
                  </div>
                  {starting === block.index && (
                    <p className="text-xs text-blue-600 mt-2">Starting session...</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
