import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getCurrentStudent } from "../student";
import NavBar from "../components/NavBar";
import ExplanationCallout from "../components/ExplanationCallout";
import { TIER_BAR_CLASSES, tierFor } from "../tiers";

function youtubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function deltaLabel(before, after) {
  const delta = Math.round(after * 100) - Math.round(before * 100);
  const sign = delta > 0 ? "+" : "";
  return `${Math.round(before * 100)}% → ${Math.round(after * 100)}% (${sign}${delta}%)`;
}

export default function MainLoop() {
  const studentId = getCurrentStudent();
  const navigate = useNavigate();

  const [step, setStep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState(null);
  const [rounds, setRounds] = useState(0);
  const [viewedDelta, setViewedDelta] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchNext = async () => {
    setLoading(true);
    setFeedback(null);
    setSelected(null);
    setViewedDelta(null);
    setError(null);
    setSubmitting(false);
    try {
      const data = await api.getNext(studentId);
      if (data.content_type === "no_session") {
        navigate("/blocks");
        return;
      }
      setStep(data);
      setStartedAt(Date.now());
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
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const elapsedSeconds = () => (Date.now() - startedAt) / 1000;

  const submitMcq = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.submitMcqAnswer(
        studentId,
        step.content.id,
        selected,
        elapsedSeconds()
      );
      setFeedback(result);
      setRounds((r) => r + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markViewed = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const beforeBelief = step.mastery_belief;
      const result = await api.markContentViewed(studentId, step.concept, step.content.id, elapsedSeconds());
      setRounds((r) => r + 1);
      setViewedDelta({ concept: step.concept, before: beforeBelief, after: result.updated_belief });
      setTimeout(fetchNext, 1100);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const continueSession = async () => {
    try {
      await api.continueSession(studentId);
      fetchNext();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!studentId) return null;

  const showRoundCard = step && !["complete", "block_complete", "session_paused"].includes(step.content_type);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">Your Learning Loop</h2>
          <span className="text-xs text-gray-400">Round {rounds + 1}</span>
        </div>

        {step && step.block && (
          <BlockProgressBar block={step.block} />
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded p-4 mb-4">
            {error}{" "}
            <button className="underline ml-2" onClick={fetchNext}>
              Retry
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Consulting the tutoring agent...
          </div>
        )}

        {!loading && step && !error && step.content_type === "complete" && (
          <CompletionCard step={step} onViewDashboard={() => navigate("/mastery")} />
        )}

        {!loading && step && !error && step.content_type === "block_complete" && (
          <BlockCompleteCard
            step={step}
            onChooseBlock={() => navigate("/blocks")}
            onViewDashboard={() => navigate("/mastery")}
          />
        )}

        {!loading && step && !error && step.content_type === "session_paused" && (
          <SessionPausedCard
            step={step}
            onContinue={continueSession}
            onChooseBlock={() => navigate("/blocks")}
            onViewDashboard={() => navigate("/mastery")}
          />
        )}

        {!loading && showRoundCard && !error && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="border-t-8 border-yellow-400" />
            <div className="p-5 sm:p-8 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  {step.concept}
                </span>
                <span className="text-xs text-gray-400">
                  belief: {Math.round(step.mastery_belief * 100)}%
                  {step.attempt_number > 0 && (
                    <> · attempt {step.attempt_number + 1} (accumulated evidence, not a single pass/fail)</>
                  )}
                </span>
              </div>

              <ExplanationCallout text={step.explanation} />

              {step.content_type === "video" && !viewedDelta && (
                <VideoBlock content={step.content} onMarkWatched={markViewed} submitting={submitting} />
              )}

              {step.content_type === "escalation" && !viewedDelta && (
                <EscalationBlock content={step.content} onMarkRead={markViewed} submitting={submitting} />
              )}

              {viewedDelta && (
                <DeltaBanner concept={viewedDelta.concept} before={viewedDelta.before} after={viewedDelta.after} />
              )}

              {step.content_type === "practice_problem" && !feedback && (
                <McqBlock
                  content={step.content}
                  selected={selected}
                  onSelect={setSelected}
                  onSubmit={submitMcq}
                  submitting={submitting}
                />
              )}

              {step.content_type === "practice_problem" && feedback && (
                <McqFeedback feedback={feedback} before={step.mastery_belief} onContinue={fetchNext} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockProgressBar({ block }) {
  const tier = tierFor(block.average_mastery);
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-semibold text-gray-700">{block.name}</span>
        <span className="text-gray-400">
          round {block.round_count}/{block.round_cap} · {Math.round(block.average_mastery * 100)}% avg
          (target 65%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${TIER_BAR_CLASSES[tier]}`}
          style={{ width: `${Math.min(100, block.average_mastery * 100)}%` }}
        />
      </div>
    </div>
  );
}

function DeltaBanner({ concept, before, after }) {
  const improved = after >= before;
  return (
    <div
      className={`rounded-lg border-2 p-4 text-center font-semibold ${
        improved ? "bg-emerald-50 border-emerald-400 text-emerald-800" : "bg-red-50 border-red-400 text-red-800"
      }`}
    >
      {concept}: {deltaLabel(before, after)}
    </div>
  );
}

function CompletionCard({ step, onViewDashboard }) {
  const { average_mastery: avg, weakest_concepts: weakest } = step.content;
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="border-t-8 border-emerald-400" />
      <div className="p-6 sm:p-10 text-center space-y-5">
        <div className="text-5xl">🎓</div>
        <h3 className="text-2xl font-bold text-emerald-700">Curriculum Complete</h3>
        <p className="text-gray-600 max-w-md mx-auto">{step.explanation}</p>
        <div className="inline-block bg-emerald-50 border border-emerald-300 rounded-lg px-6 py-3">
          <div className="text-3xl font-bold text-emerald-700">{Math.round(avg * 100)}%</div>
          <div className="text-xs text-emerald-700">average mastery</div>
        </div>
        {weakest && weakest.length > 0 && (
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Still softest on:{" "}
            <span className="font-semibold text-gray-700">
              {weakest.map((w) => w.concept).join(", ")}
            </span>{" "}
            -- worth a manual review even though the session target was reached.
          </p>
        )}
        <button
          onClick={onViewDashboard}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded shadow transition"
        >
          View Full Mastery Dashboard
        </button>
      </div>
    </div>
  );
}

function BlockCompleteCard({ step, onChooseBlock, onViewDashboard }) {
  const { block_name: name, average_mastery: avg } = step.content;
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="border-t-8 border-emerald-400" />
      <div className="p-6 sm:p-10 text-center space-y-5">
        <div className="text-5xl">✅</div>
        <h3 className="text-2xl font-bold text-emerald-700">{name} Complete</h3>
        <p className="text-gray-600 max-w-md mx-auto">{step.explanation}</p>
        <div className="inline-block bg-emerald-50 border border-emerald-300 rounded-lg px-6 py-3">
          <div className="text-3xl font-bold text-emerald-700">{Math.round(avg * 100)}%</div>
          <div className="text-xs text-emerald-700">block average mastery</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onChooseBlock}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded shadow transition"
          >
            Choose Next Block
          </button>
          <button
            onClick={onViewDashboard}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-2.5 rounded shadow transition"
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionPausedCard({ step, onContinue, onChooseBlock, onViewDashboard }) {
  const { block_name: name, average_mastery: avg, round_count, round_cap, weakest_concept, weakest_belief } =
    step.content;
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="border-t-8 border-blue-400" />
      <div className="p-6 sm:p-10 text-center space-y-5">
        <div className="text-5xl">⏸️</div>
        <h3 className="text-2xl font-bold text-blue-700">Session Paused</h3>
        <p className="text-gray-600 max-w-md mx-auto">{step.explanation}</p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="bg-blue-50 border border-blue-300 rounded-lg px-6 py-3">
            <div className="text-2xl font-bold text-blue-700">{Math.round(avg * 100)}%</div>
            <div className="text-xs text-blue-700">{name} average</div>
          </div>
          <div className="bg-gray-50 border border-gray-300 rounded-lg px-6 py-3">
            <div className="text-2xl font-bold text-gray-700">
              {round_count}/{round_cap}
            </div>
            <div className="text-xs text-gray-500">rounds used</div>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Weakest in this block right now: <span className="font-semibold">{weakest_concept}</span> (
          {Math.round(weakest_belief * 100)}%)
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onContinue}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded shadow transition"
          >
            Continue This Block
          </button>
          <button
            onClick={onChooseBlock}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-2.5 rounded shadow transition"
          >
            Choose a Different Block
          </button>
          <button
            onClick={onViewDashboard}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-2.5 rounded shadow transition"
          >
            View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoBlock({ content, onMarkWatched, submitting }) {
  const embedUrl = youtubeEmbedUrl(content.url);
  return (
    <div>
      <h3 className="font-bold text-lg mb-3">{content.title}</h3>
      {embedUrl ? (
        <div className="relative w-full pb-[56.25%] rounded overflow-hidden bg-black mb-4">
          <iframe
            src={embedUrl}
            title={content.title}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline block mb-4"
        >
          Watch on {content.source}
        </a>
      )}
      <button
        onClick={onMarkWatched}
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded shadow transition"
      >
        {submitting ? "Saving..." : "Mark Watched -- Continue"}
      </button>
    </div>
  );
}

function McqBlock({ content, selected, onSelect, onSubmit, submitting }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">Practice Question</h3>
        <span className="text-xs font-semibold text-gray-400 uppercase">
          {content.difficulty}
        </span>
      </div>
      <p className="font-semibold mb-4 whitespace-pre-wrap bg-gray-50 border rounded p-3">
        {content.question}
      </p>
      <div className="space-y-3">
        {content.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
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
        onClick={onSubmit}
        disabled={selected === null || submitting}
        className="mt-5 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded shadow transition"
      >
        {submitting ? "Submitting..." : "Submit Answer"}
      </button>
    </div>
  );
}

function McqFeedback({ feedback, before, onContinue }) {
  const correct = feedback.passed;
  return (
    <div
      className={`rounded-lg border-2 p-5 ${
        correct ? "bg-emerald-50 border-emerald-400" : "bg-red-50 border-red-400"
      }`}
    >
      <p className={`font-bold text-lg mb-2 ${correct ? "text-emerald-800" : "text-red-800"}`}>
        {correct ? "Correct!" : "Not quite."}
      </p>
      <p className="text-sm text-gray-700 mb-3">{feedback.explanation}</p>
      <p className="text-xs font-semibold text-gray-500 mb-4">
        belief updated: {deltaLabel(before, feedback.updated_belief)}
      </p>
      <button
        onClick={onContinue}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded shadow transition"
      >
        Continue
      </button>
    </div>
  );
}

function EscalationBlock({ content, onMarkRead, submitting }) {
  return (
    <div>
      <h3 className="font-bold text-lg mb-3">{content.title}</h3>
      <a
        href={content.url}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline block mb-4"
      >
        Open deep-dive on {content.source}
      </a>
      <button
        onClick={onMarkRead}
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded shadow transition"
      >
        {submitting ? "Saving..." : "Mark Read -- Continue"}
      </button>
    </div>
  );
}
