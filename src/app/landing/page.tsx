"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"

// ── animated counter ──────────────────────────────────────────────────────
function Counter({
  target,
  suffix = "",
  duration = 2000,
}: {
  target: number
  suffix?: string
  duration?: number
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const tick = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

const features = [
  {
    icon: "🎓",
    title: "Structured Courses",
    desc: "Professionally designed biblical and leadership courses organised into modules and lessons that fit every schedule.",
    gradient: "from-green-500/20 to-emerald-500/10",
    border: "border-green-500/30",
    iconBg: "bg-green-100",
  },
  {
    icon: "📹",
    title: "Live Classes",
    desc: "Join real-time Google Meet sessions scheduled by your instructors and stay engaged with interactive learning.",
    gradient: "from-orange-500/20 to-amber-500/10",
    border: "border-orange-500/30",
    iconBg: "bg-orange-100",
  },
  {
    icon: "📜",
    title: "Certificates",
    desc: "Earn verifiable certificates upon completing courses — recognition for your spiritual and academic growth.",
    gradient: "from-red-500/20 to-rose-500/10",
    border: "border-red-500/30",
    iconBg: "bg-red-100",
  },
  {
    icon: "📊",
    title: "Progress Tracking",
    desc: "Visualise your journey with dashboards that show completion rates, exam scores, and momentum at a glance.",
    gradient: "from-green-600/20 to-teal-500/10",
    border: "border-teal-500/30",
    iconBg: "bg-teal-100",
  },
  {
    icon: "💬",
    title: "Community Forums",
    desc: "Engage in topic-driven discussions with fellow learners and instructors to deepen understanding together.",
    gradient: "from-amber-500/20 to-yellow-400/10",
    border: "border-amber-500/30",
    iconBg: "bg-amber-100",
  },
  {
    icon: "🤝",
    title: "Accountability Partners",
    desc: "Stay on track with a dedicated accountability partner who receives progress updates and encourages you.",
    gradient: "from-red-600/20 to-pink-500/10",
    border: "border-red-600/30",
    iconBg: "bg-pink-100",
  },
]

const roles = [
  {
    label: "Student",
    title: "Learn & Grow",
    desc: "Access courses, track progress, join live sessions, sit exams, and earn certificates — all in one place.",
    gradient: "from-green-600 to-emerald-500",
    gradientStr: "#006633,#00843D",
    link: "/auth/login",
    cta: "Start Learning",
    svgPath: "/Students-cuate.svg",
  },
  {
    label: "Teacher",
    title: "Teach & Inspire",
    desc: "Create and publish courses, schedule live classes, grade assignments, and monitor your students&#39; progress.",
    gradient: "from-orange-500 to-amber-400",
    gradientStr: "#F97316,#FB923C",
    link: "/auth/login",
    cta: "Start Teaching",
    svgPath: "/Teacher student-pana.svg",
  },
  {
    label: "Admin",
    title: "Lead & Manage",
    desc: "Oversee the entire platform — manage users, configure cohorts, view analytics, and keep everything running.",
    gradient: "from-red-600 to-rose-500",
    gradientStr: "#CC0000,#DC2626",
    link: "/auth/login",
    cta: "Go to Admin",
    svgPath: "/Admin-pana.svg",
  },
]

const testimonials = [
  {
    quote: "The LFF LMS transformed how I engage with biblical teachings. I can now learn at my own pace while staying connected to my church.",
    name: "Sister Grace O.",
    role: "Student, Lagos Chapter",
    initials: "GO",
    color: "#006633",
  },
  {
    quote: "As a teacher, creating courses here is seamless. The live class integration with Google Meet is exactly what our ministry needed.",
    name: "Pastor James A.",
    role: "Course Instructor",
    initials: "JA",
    color: "#F97316",
  },
  {
    quote: "Managing hundreds of students across cohorts used to be a nightmare. The admin dashboard makes it effortless and insightful.",
    name: "Deacon Samuel K.",
    role: "Platform Administrator",
    initials: "SK",
    color: "#CC0000",
  },
]

const stats = [
  { value: 1200, suffix: "+", label: "Registered Members" },
  { value: 48, suffix: "", label: "Active Courses" },
  { value: 15, suffix: "+", label: "Expert Instructors" },
  { value: 3200, suffix: "+", label: "Certificates Issued" },
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden" style={{ fontFamily: "var(--font-poppins, sans-serif)" }}>
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(30px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseRing {
          0%   { transform:scale(1);   opacity:1; }
          100% { transform:scale(1.6); opacity:0; }
        }
        .lff-float-slow  { animation: float 6s ease-in-out infinite; }
        .lff-float-mid   { animation: float 4s ease-in-out infinite 1s; }
        .lff-fade-up     { animation: fadeSlideUp 0.7s ease both; }
        .lff-card:hover  { transform:translateY(-6px); box-shadow:0 20px 40px rgba(0,102,51,0.15); }
        .lff-card        { transition: transform .3s, box-shadow .3s; }
        .lff-shimmer {
          background: linear-gradient(90deg,#006633,#F97316,#CC0000,#006633);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .lff-hero-bg {
          background: linear-gradient(135deg,rgba(0,102,51,0.06) 0%,rgba(249,115,22,0.04) 40%,rgba(204,0,0,0.03) 100%);
        }
        .lff-screen-frame {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 12px 12px 6px;
          box-shadow: 0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .lff-screen-notch {
          width:80px; height:8px;
          background:#111;
          border-radius:0 0 8px 8px;
          margin:0 auto 8px;
        }
        .lff-screen-inner {
          border-radius:8px;
          overflow:hidden;
          border:1px solid rgba(255,255,255,0.05);
        }
        .lff-screen-stand {
          width:60px; height:16px;
          background:linear-gradient(to bottom,#2a2a3e,#1a1a2e);
          margin:0 auto;
          clip-path:polygon(10% 0%,90% 0%,100% 100%,0% 100%);
        }
        .lff-screen-base {
          width:140px; height:6px;
          background:#2a2a3e;
          border-radius:3px;
          margin:0 auto;
        }
        .lff-section-tag {
          display:inline-flex;
          align-items:center;
          gap:6px;
          background:linear-gradient(135deg,rgba(0,102,51,0.1),rgba(249,115,22,0.1));
          border:1px solid rgba(0,102,51,0.2);
          color:#006633;
          font-size:.78rem;
          font-weight:700;
          letter-spacing:.1em;
          text-transform:uppercase;
          padding:5px 14px;
          border-radius:9999px;
          margin-bottom:16px;
        }
        .lff-btn-primary {
          background: linear-gradient(135deg,#006633,#00843D);
          color:white;
          padding:14px 32px;
          border-radius:9999px;
          font-weight:700;
          font-size:1rem;
          display:inline-flex;
          align-items:center;
          gap:8px;
          transition:all .3s;
          box-shadow:0 8px 25px rgba(0,102,51,0.35);
          text-decoration:none;
        }
        .lff-btn-primary:hover {
          transform:translateY(-2px);
          box-shadow:0 12px 35px rgba(0,102,51,0.5);
        }
        .lff-btn-secondary {
          border:2px solid #006633;
          color:#006633;
          background:white;
          padding:12px 32px;
          border-radius:9999px;
          font-weight:600;
          font-size:1rem;
          display:inline-flex;
          align-items:center;
          gap:8px;
          transition:all .3s;
          text-decoration:none;
        }
        .lff-btn-secondary:hover {
          background:#006633;
          color:white;
          transform:translateY(-2px);
        }
        .lff-nav-scrolled {
          background:rgba(255,255,255,0.95);
          backdrop-filter:blur(12px);
          box-shadow:0 2px 20px rgba(0,0,0,0.08);
        }
        .lff-pulse-dot {
          position:relative;
          width:8px; height:8px;
          border-radius:9999px;
          background:#006633;
          display:inline-block;
        }
        .lff-pulse-dot::before {
          content:'';
          position:absolute;
          inset:0;
          border-radius:9999px;
          background:#006633;
          animation:pulseRing 1.5s cubic-bezier(0.215,0.61,0.355,1) infinite;
        }
      `}</style>

      {/* NAVIGATION */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "lff-nav-scrolled" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12">
                <Image src="/logo.png" alt="LFF Logo" fill className="object-contain" />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight" style={{ color: "#006633", fontFamily: "var(--font-montserrat, sans-serif)" }}>LFF LMS</div>
                <div className="text-xs text-gray-500 leading-tight">Living Faith Foundation</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {[["Features", "#features"], ["How It Works", "#how-it-works"], ["For You", "#roles"]].map(([label, href]) => (
                <a key={label} href={href} className="text-sm font-medium text-gray-600 hover:text-green-700 transition-colors">{label}</a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {/* <Link href="/auth/login" className="lff-btn-secondary text-sm" style={{ padding: "10px 20px" }}></Link> */}
              <Link href="/auth/login" className="lff-btn-primary text-sm" style={{ padding: "10px 20px" }}>Sign In</Link>
            </div>

            <button className="md:hidden p-2 rounded-lg text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
            {[["Features", "#features"], ["How It Works", "#how-it-works"]].map(([label, href]) => (
              <a key={label} href={href} className="block py-2 text-gray-700 hover:text-green-700 font-medium" onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              {/* <Link href="/auth/login" className="lff-btn-secondary text-sm text-center justify-center"></Link> */}
              <Link href="/auth/login" className="lff-btn-primary text-sm justify-center">Sign In</Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col justify-center pt-24 pb-10 overflow-hidden lff-hero-bg">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ background: "radial-gradient(circle,#006633,transparent)" }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-15" style={{ background: "radial-gradient(circle,#F97316,transparent)" }} />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10" style={{ background: "radial-gradient(circle,#CC0000,transparent)" }} />
        <div className="absolute top-1/4 left-16 w-3 h-3 rounded-full opacity-60 lff-float-slow" style={{ background: "#00843D" }} />
        <div className="absolute top-1/3 right-1/3 w-2 h-2 rounded-full opacity-60 lff-float-mid" style={{ background: "#F97316" }} />
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 rounded-full opacity-60 lff-float-slow" style={{ background: "#CC0000" }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div className="lff-fade-up">
              <div className="lff-section-tag">
                <span className="lff-pulse-dot" />
                Living Faith Foundation
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-6" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
                <span className="text-gray-900">Grow in</span><br />
                <span className="lff-shimmer">Faith &amp; Knowledge</span><br />
                <span className="text-gray-900">Together</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-xl">
                The Living Faith Foundation Learning Management System  where biblical education meets modern technology.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                {[{ i: "✅", t: "Structured Bible Courses" }, { i: "📹", t: "Live Google Meet Classes" }, { i: "🏆", t: "Earn Certificates" }].map((p) => (
                  <span key={p.t} className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">{p.i} {p.t}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <Link href="/auth/login" className="lff-btn-primary">Start Learning Now →</Link>
                <a href="#features" className="lff-btn-secondary">▶ Explore Features</a>
              </div>
              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[["GO", "#006633"], ["JA", "#F97316"], ["SK", "#CC0000"], ["EM", "#00843D"]].map(([init, color], idx) => (
                    <div key={idx} className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md" style={{ background: color }}>{init}</div>
                  ))}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">1,200+ Members</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => <span key={s} className="text-amber-400 text-sm">★</span>)}
                    <span className="text-xs text-gray-500 ml-1">across all cohorts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monitor */}
            <div className="relative flex flex-col items-center lff-fade-up lff-float-mid">
              <div className="absolute inset-0 rounded-3xl blur-3xl opacity-30 scale-90" style={{ background: "linear-gradient(135deg,rgba(0,102,51,0.5),rgba(249,115,22,0.4))" }} />
              <div className="relative w-full max-w-2xl">
                <div className="lff-screen-frame">
                  <div className="lff-screen-notch" />
                  <div className="lff-screen-inner">
                    <Image src="/image.png" alt="LFF LMS Dashboard" width={900} height={563} className="w-full h-auto block" priority />
                  </div>
                </div>
                <div className="lff-screen-stand" />
                <div className="lff-screen-base" />
              </div>
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2 lff-float-slow" style={{ border: "2px solid rgba(0,102,51,0.15)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "#006633" }}>🎓</div>
                <div><div className="text-xs font-bold text-gray-800">Structured Bible Courses</div><div className="text-xs text-gray-500"></div></div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2 lff-float-mid" style={{ border: "2px solid rgba(249,115,22,0.2)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: "#F97316" }}>📜</div>
                <div><div className="text-xs font-bold text-gray-800">Earn Certificates</div><div className="text-xs text-gray-500">After Completion</div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ lineHeight: 0 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-16"><path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill="white" /></svg>
        </div>
      </section>

      {/* STATS */}
      {/* <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl sm:text-5xl font-extrabold mb-1" style={{ color: ["#006633", "#F97316", "#CC0000", "#00843D"][i], fontFamily: "var(--font-montserrat, sans-serif)" }}>
                  <Counter target={s.value} suffix={s.suffix} />
                </div>
                <div className="text-sm text-gray-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      <div className="h-px mx-8" style={{ background: "linear-gradient(to right,transparent,#00843D,transparent)" }} />

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="lff-section-tag">🌟 Platform Features</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
              Everything You Need to <span style={{ color: "#006633" }}>Learn &amp; Thrive</span>
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">Purpose-built for the Living Faith Foundation community — powerful tools for students, teachers, and administrators alike.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className={`lff-card relative rounded-3xl p-8 bg-gradient-to-br ${f.gradient} border ${f.border} overflow-hidden`}>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 bg-current" />
                <div className={`w-14 h-14 rounded-2xl ${f.iconBg} flex items-center justify-center text-2xl mb-5 shadow-sm`}>{f.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(0,102,51,0.04) 0%,rgba(249,115,22,0.04) 50%,rgba(204,0,0,0.03) 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="lff-section-tag">🚀 Getting Started</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
              Three Simple Steps to <span style={{ color: "#F97316" }}>Begin Your Journey</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "01", icon: "🔐", title: "Sign In", desc: "Use your church-issued credentials to log in securely and access your personalised dashboard.", color: "#006633", bg: "bg-green-50" },
              { step: "02", icon: "📚", title: "Enroll in Courses", desc: "Browse available courses, join cohorts, and start learning at your own pace with structured content.", color: "#F97316", bg: "bg-orange-50" },
              { step: "03", icon: "🏆", title: "Grow & Certify", desc: "Complete lessons, pass exams, join live classes, and earn verifiable certificates for your achievement.", color: "#CC0000", bg: "bg-red-50" },
            ].map((s, i) => (
              <div key={i} className="text-center lff-card">
                <div className={`relative w-20 h-20 mx-auto rounded-3xl ${s.bg} flex items-center justify-center text-3xl mb-6 shadow-lg`} style={{ border: `2px solid ${s.color}30` }}>
                  <span>{s.icon}</span>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow" style={{ background: s.color }}>{s.step}</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="lff-section-tag">👥 Built For Everyone</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
              A Platform for <span style={{ color: "#006633" }}>Every Role</span>
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">Whether you&apos;re here to learn, teach, or lead — LFF LMS has the tools tailored just for you.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {roles.map((r, i) => (
              <div key={i} className="lff-card rounded-3xl overflow-hidden border border-gray-100 shadow-md flex flex-col">
                <div className={`relative h-56 bg-gradient-to-br ${r.gradient} flex items-center justify-center overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-white/30" />
                    <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-white/20" />
                  </div>
                  <Image src={r.svgPath} alt={r.label} width={200} height={180} className="object-contain lff-float-slow drop-shadow-xl" />
                  <div className="absolute top-4 left-4 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>{r.label}</div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{r.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: r.desc }} />
                  <div className="mt-6">
                    <Link href={r.link} className="block w-full text-center py-3 rounded-2xl font-bold text-white transition-all hover:opacity-90 hover:shadow-lg text-sm" style={{ background: `linear-gradient(135deg,${r.gradientStr})` }}>{r.cta} →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {/* <section id="testimonials" className="py-24" style={{ background: "linear-gradient(180deg,#f0fdf4 0%,#fff7ed 50%,#fef2f2 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="lff-section-tag">💬 Community Stories</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
              Voices from the <span style={{ color: "#006633" }}>LFF Community</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="lff-card bg-white rounded-3xl p-8 shadow-md relative overflow-hidden" style={{ border: "1px solid rgba(0,102,51,0.08)" }}>
                <div className="absolute -top-4 -left-2 text-8xl font-serif opacity-10 select-none" style={{ color: "#006633" }}>&ldquo;</div>
                <div className="flex text-amber-400 text-sm mb-4">{[1, 2, 3, 4, 5].map(s => <span key={s}>★</span>)}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6 relative z-10">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA */}
      <section className="py-24 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#004d26 0%,#006633 40%,#003319 100%)" }}>
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#F97316,transparent)", transform: "translate(40%,-40%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#FFA500,transparent)", transform: "translate(-40%,40%)" }} />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <Image src="/logo.png" alt="LFF Logo" fill className="object-contain" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>
            Ready to Start Your<br /><span style={{ color: "#FFA500" }}>Learning Journey?</span>
          </h2>
          <p className="text-lg mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: "rgba(220,252,231,0.9)" }}>
            Join thousands of Living Faith Foundation members growing spiritually and academically through our world-class Learning Management System.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth/login" className="inline-flex items-center gap-2 text-base font-bold py-4 px-10 rounded-full transition-all hover:scale-105 hover:shadow-2xl" style={{ background: "linear-gradient(135deg,#F97316,#FFA500)", color: "white" }}>Access the Platform →</Link>
            <a href="#features" className="inline-flex items-center gap-2 text-base font-bold py-4 px-10 rounded-full text-white hover:bg-white/10 transition-all" style={{ border: "2px solid rgba(255,255,255,0.3)" }}>Learn More</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12" style={{ background: "#0a0a0f" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-12 h-12"><Image src="/logo.png" alt="LFF Logo" fill className="object-contain" /></div>
                <div>
                  <div className="font-bold text-white text-lg" style={{ fontFamily: "var(--font-montserrat, sans-serif)" }}>LFF LMS</div>
                  <div className="text-xs text-gray-500">Living Faith Foundation</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed max-w-xs text-gray-400">Empowering believers through structured biblical education and community-driven learning. Church &amp; Missions — reaching the world one lesson at a time.</p>
            </div>
            <div>
              <div className="text-white font-semibold mb-4">Platform</div>
              <ul className="space-y-2 text-sm text-gray-400">
                {["Student Login", "Teacher Login", "Admin Login", "Courses", "Certificates"].map(l => (
                  <li key={l}><Link href="/auth/login" className="hover:text-green-400 transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-4">Connect</div>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>🌍 Living Faith Foundation</li>
                <li>⛪ Church &amp; Missions</li>
                <li>📧 support@lff.org</li>
                <li>📞 Available via platform</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} Living Faith Foundation. All rights reserved.</p>
            <div className="flex gap-2">{["#006633", "#F97316", "#CC0000"].map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
