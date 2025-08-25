import { useEffect, useState } from "react";
import { Link, Route, Routes, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Mood from "./pages/Mood";
import VoiceHub from "./pages/VoiceHub";
import VoiceSession from "./pages/VoiceSession";
import VoiceResult from "./pages/VoiceResult";
import VoiceStats from "./pages/VoiceStats";
import { registerSW } from 'virtual:pwa-register'
import CrabHub from "./pages/CrabHub";


export default function App() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    registerSW({
      immediate: true,
      onNeedRefresh() { setNeedRefresh(true) },
      onOfflineReady() { setOfflineReady(true); setTimeout(() => setOfflineReady(false), 2000) }
    })
  }, [])

  return (
    <div className="min-h-screen w-screen text-ink
    bg-[radial-gradient(1200px_600px_at_50%_-100px,theme(colors.primary.50),white)]">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-primary-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="font-bold text-lg tracking-wide"
            style={{ fontFamily: "Nunito, Inter, sans-serif" }}>
            こごと
          </Link>
          <nav className="ml-auto text-sm flex gap-3">
            {[
              { to: "/mood", label: "表情ネガポジ" },
              { to: "/voice", label: "音声4択" },
              { to: "/crab", label: "カニと遊ぶ" },
            ].map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  "px-2 py-1 rounded-xl transition " +
                  (isActive
                    ? "bg-primary-50 text-primary-700 border border-primary-200 shadow-card"
                    : "text-ink/70 hover:text-ink hover:bg-muted")}
              >{label}</NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mood" element={<Mood />} />
          <Route path="/voice" element={<VoiceHub />} />
          <Route path="/voice/session" element={<VoiceSession />} />
          <Route path="/voice/result" element={<VoiceResult />} />
          <Route path="/voice/stats" element={<VoiceStats />} />
          <Route path="/crab" element={<CrabHub />} />

        </Routes>
      </main>

      {/* PWA: オフライン準備OKトースト（2秒で消える） */}
      {offlineReady && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-emerald-700 text-white rounded-lg shadow">
          オフラインで利用できます
        </div>
      )}

      {/* PWA: 更新ありトースト */}
      {needRefresh && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 bg-sky-700 text-white rounded-lg shadow flex items-center gap-3">
          新しいバージョンがあります
          <button
            onClick={() => location.reload()}
            className="px-2 py-1 rounded bg-white/20 hover:bg-white/30"
          >
            更新
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            あとで
          </button>
        </div>
      )}

    </div>

  );
}
