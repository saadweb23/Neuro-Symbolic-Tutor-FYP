import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentStudent, markStudentKnown } from "../student";
import ConceptGrid from "../components/ConceptGrid";
import NavBar from "../components/NavBar";

export default function Placement() {
  const studentId = getCurrentStudent();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [questionStart, setQuestionStart] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [beliefs, setBeliefs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) {
      navigate("/");
      return;
    }
    api
      .startPlacement(studentId)
      .then((data) => {
        setQuestions(data.questions);
        setQuestionStart(Date.now());
      })
      .catch((err) => setError(err.message));
  }, [studentId, navigate]);

  const handleNext = async () => {
    if (selected === null) return;
    const timeTaken = (Date.now() - questionStart) / 1000;
    const current = questions[index];
    const nextAnswers = [
      ...answers,
      { content_id: current.content_id, selected_index: selected, time_taken: timeTaken },
    ];
    setAnswers(nextAnswers);
    setSelected(null);

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setQuestionStart(Date.now());
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.submitPlacement(studentId, nextAnswers);
      setBeliefs(result.beliefs);
      markStudentKnown(studentId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!studentId) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-red-600">Something went wrong: {error}</p>
      </div>
    );
  }

  if (beliefs) {
    const weakest = Object.entries(beliefs)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([c]) => c);

    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-2">Here's what we found</h2>
            <p className="text-gray-600 mb-4">
              Based on your placement quiz, your weakest areas right now are{" "}
              <span className="font-semibold text-red-700">{weakest.join(", ")}</span>. The
              adaptive agent will prioritize remediation there first, tracing forward
              through anything that depends on them.
            </p>
            <p className="text-xs text-gray-400 mb-4 italic">
              Only {questions.length} concepts were actually quizzed -- the rest of this grid comes from the
              knowledge graph: each answer propagates two hops across prerequisite/dependent
              edges, so related concepts start with an informed estimate instead of a blank
              guess. Untouched, distant concepts default to a neutral prior until the
              learning loop reaches them directly.
            </p>
            <ConceptGrid beliefs={beliefs} />
            <button
              onClick={() => navigate("/blocks")}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded shadow transition"
            >
              Choose a Focus Area to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!questions || submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-500">
          {submitting ? "Scoring your placement quiz..." : "Loading placement quiz..."}
        </p>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-blue-600 text-white px-4 py-3">
        <h1 className="font-bold">NeuroTutor Placement Quiz</h1>
      </div>
      <div className="flex-grow flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-gray-400 uppercase">
              {q.concept}
            </span>
            <span className="text-xs text-gray-400">
              Question {index + 1} of {questions.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((index + (beliefs ? 1 : 0)) / questions.length) * 100}%` }}
            />
          </div>
          <p className="font-semibold mb-4 whitespace-pre-wrap">{q.question}</p>
          <div className="space-y-3">
            {q.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-left p-3 border rounded transition ${
                  selected === i
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
          <button
            onClick={handleNext}
            disabled={selected === null}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded shadow transition"
          >
            {index + 1 < questions.length ? "Next" : "Finish Placement"}
          </button>
        </div>
      </div>
    </div>
  );
}
