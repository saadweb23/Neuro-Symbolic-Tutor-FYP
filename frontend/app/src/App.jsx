import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Placement from "./pages/Placement";
import Blocks from "./pages/Blocks";
import MainLoop from "./pages/MainLoop";
import Mastery from "./pages/Mastery";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/placement" element={<Placement />} />
        <Route path="/blocks" element={<Blocks />} />
        <Route path="/loop" element={<MainLoop />} />
        <Route path="/mastery" element={<Mastery />} />
      </Routes>
    </BrowserRouter>
  );
}
