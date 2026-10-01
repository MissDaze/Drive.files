"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Archive,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileSearch,
  FolderSearch2,
  LogOut,
  Package,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  WalletCards,
} from "lucide-react"

type Scan = {
  id: string
  status: string
  totalFiles: number
  indexedFiles: number
  analysedFiles: number
  skippedFiles: number
  synthesisOffset: number
  createdAt: string
  completedAt?: string | null
}

type MeState = {
  authenticated: boolean
  driveConnected?: boolean
  user?: { id: string; email: string; name?: string | null; avatarUrl?: string | null }
  latestScan?: Scan | null
  fileCount?: number
  opportunityCount?: number
}

type Opportunity = {
  id: string
  title: string
  description: string
  score: number
  fileIds: string[]
  targetAudience: string
  suggestedPrice?: string | null
  monetization?: string | null
  missingPieces?: string[]
  nextSteps?: string[]
}

type DriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string | null
  contentStatus: string
}

type Bundle = {
  id: string
  name: string
  description?: string | null
  fileIds: string[]
  createdAt: string
}

const ACTIVE = new Set(["inventorying", "analysing", "synthesizing"])

function statusLabel(status?: string) {
  if (!status) return "Not scanned"
  return {
    queued: "Queued",
    inventorying: "Inventorying Drive",
    analysing: "Analysing assets",
    synthesizing: "Finding opportunities",
    completed: "Complete",
  }[status] || status
}

function scoreStyle(score: number) {
  if (score >= 75) return "bg-emerald-100 text-emerald-800"
  if (score >= 50) return "bg-amber-100 text-amber-800"
  return "bg-slate-100 text-slate-700"
}

export default function HomePage() {
  const [me, setMe] = useState<MeState | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [tab, setTab] = useState<"overview" | "opportunities" | "assets" | "bundles">("overview")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const loadSession = async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" })
    const data = await response.json()
    setMe(data)
    setScan(data.latestScan || null)
    return data as MeState
  }

  const loadOpportunities = async () => {
    const response = await fetch("/api/opportunities", { cache: "no-store" })
    if (response.ok) setOpportunities((await response.json()).opportunities || [])
  }

  const loadFiles = async (query = "") => {
    const params = new URLSearchParams({ pageSize: "60" })
    if (query.trim()) params.set("search", query.trim())
    const response = await fetch("/api/drive/files?" + params.toString(), { cache: "no-store" })
    if (response.ok) setFiles((await response.json()).files || [])
  }

  const loadBundles = async () => {
    const response = await fetch("/api/bundles", { cache: "no-store" })
    if (response.ok) setBundles((await response.json()).bundles || [])
  }

  const refreshData = async () => {
    const session = await loadSession()
    if (session.authenticated) {
      await Promise.all([loadOpportunities(), loadFiles(), loadBundles()])
    }
  }

  useEffect(() => {
    refreshData().catch((e) => setError(e instanceof Error ? e.message : "Could not load app"))
  }, [])

  useEffect(() => {
    if (!scan || !ACTIVE.has(scan.status)) return

    const timer = setTimeout(async () => {
      try {
        let endpoint = ""
        if (scan.status === "inventorying") endpoint = `/api/scans/${scan.id}/inventory-step`
        if (scan.status === "analysing") endpoint = `/api/scans/${scan.id}/analyse-step`
        if (scan.status === "synthesizing") endpoint = `/api/scans/${scan.id}/synthesis-step`
        if (!endpoint) return

        const response = await fetch(endpoint, { method: "POST" })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Scan step failed")
        setScan(data.scan)

        if (data.scan?.status === "completed") {
          await refreshData()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scan step failed")
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [scan])

  const progress = useMemo(() => {
    if (!scan) return 0
    if (scan.status === "completed") return 100
    if (scan.status === "inventorying") return 10
    if (scan.status === "synthesizing") return 92
    if (!scan.totalFiles) return 15
    return Math.min(90, Math.max(15, Math.round(((scan.analysedFiles + scan.skippedFiles) / scan.totalFiles) * 85)))
  }, [scan])

  const startScan = async () => {
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/scans", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not start scan")
      setScan(data.scan)
      setTab("overview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start scan")
    } finally {
      setBusy(false)
    }
  }

  const saveBundle = async (opportunity: Opportunity) => {
    setError("")
    const response = await fetch("/api/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: opportunity.title,
        description: opportunity.description,
        fileIds: opportunity.fileIds,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || "Could not save bundle")
      return
    }
    await loadBundles()
    setTab("bundles")
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setMe({ authenticated: false })
    setScan(null)
    setOpportunities([])
    setFiles([])
    setBundles([])
  }

  if (!me) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading Asset Archaeologist…
        </div>
      </main>
    )
  }

  if (!me.authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
          <div className="grid w-full gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <section>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
                <Sparkles className="h-4 w-4" />
                AI asset discovery for forgotten cloud files
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
                Find the products, projects and IP hiding in your Google Drive.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Asset Archaeologist inventories your Drive, reads supported files, groups related work and identifies
                what is sellable, nearly sellable, useful as a bundle, or better kept internal.
              </p>
              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  ["Inventory", "Scan the Drive instead of the first 100 files."],
                  ["Understand", "Analyse Docs, Sheets, PDFs, DOCX, text and images."],
                  ["Monetise", "Get target buyers, routes, gaps, pricing and next steps."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium">{title}</div>
                    <div className="mt-1 text-sm text-slate-400">{body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                <FolderSearch2 className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-semibold">Connect Google Drive</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Sign in with Google and grant read-only Drive access. Your OAuth credentials are encrypted before they
                are stored in the application database.
              </p>
              <a
                href="/api/auth/google"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 font-medium text-slate-950 hover:bg-slate-100"
              >
                Continue with Google
              </a>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                File content selected for analysis is sent to the configured OpenRouter model. Drive access itself is
                read-only.
              </p>
            </section>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Asset Archaeologist</div>
              <div className="text-xs text-slate-500">Google Drive commercial asset discovery</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{me.user?.name || me.user?.email}</div>
              <div className="text-xs text-slate-500">{me.user?.email}</div>
            </div>
            <button onClick={logout} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Indexed assets", value: me.fileCount || 0, icon: Database },
            { label: "Opportunities", value: opportunities.length, icon: Target },
            { label: "Saved bundles", value: bundles.length, icon: Package },
            { label: "Latest scan", value: statusLabel(scan?.status), icon: FileSearch },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <item.icon className="mb-4 h-5 w-5 text-slate-500" />
              <div className="text-2xl font-semibold">{item.value}</div>
              <div className="mt-1 text-sm text-slate-500">{item.label}</div>
            </div>
          ))}
        </section>

        <nav className="mb-6 flex flex-wrap gap-2">
          {[
            ["overview", "Overview"],
            ["opportunities", "Opportunities"],
            ["assets", "Asset catalogue"],
            ["bundles", "Bundles"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value as typeof tab)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                tab === value ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Drive scan</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Inventory, analyse and synthesize your Drive into a commercial asset catalogue.
                  </p>
                </div>
                <button
                  onClick={startScan}
                  disabled={busy || Boolean(scan && ACTIVE.has(scan.status))}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${scan && ACTIVE.has(scan.status) ? "animate-spin" : ""}`} />
                  {scan && ACTIVE.has(scan.status) ? "Scan running" : me.fileCount ? "Rescan Drive" : "Scan Drive"}
                </button>
              </div>

              {scan ? (
                <div className="mt-7">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{statusLabel(scan.status)}</span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Indexed", scan.indexedFiles],
                      ["Analysed", scan.analysedFiles],
                      ["Skipped", scan.skippedFiles],
                      ["Candidates", opportunities.length],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <div className="text-lg font-semibold">{value}</div>
                        <div className="text-xs text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-7 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No scan has been run yet.
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
              <WalletCards className="h-6 w-6 text-cyan-300" />
              <h2 className="mt-5 text-xl font-semibold">What the analysis returns</h2>
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <p><strong className="text-white">What you own:</strong> projects, datasets, research, templates, SOPs, content and supporting material.</p>
                <p><strong className="text-white">What belongs together:</strong> related files are assessed as coherent commercial opportunities rather than random keyword bundles.</p>
                <p><strong className="text-white">Who buys it:</strong> each opportunity names a specific target buyer/customer.</p>
                <p><strong className="text-white">How to monetise it:</strong> asset sale, SaaS, licensing, download, training, service enablement or keep/internal.</p>
                <p><strong className="text-white">What is missing:</strong> concrete gaps and ordered next actions.</p>
              </div>
            </section>
          </div>
        )}

        {tab === "opportunities" && (
          <section className="space-y-4">
            {opportunities.length === 0 ? (
              <Empty icon={Target} title="No opportunities yet" body="Run a Drive scan. Commercial candidates will appear here after synthesis." />
            ) : (
              opportunities.map((opportunity) => (
                <article key={opportunity.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold">{opportunity.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreStyle(opportunity.score)}`}>
                          {opportunity.score}/100
                        </span>
                      </div>
                      <p className="mt-2 leading-7 text-slate-600">{opportunity.description}</p>
                    </div>
                    <button
                      onClick={() => saveBundle(opportunity)}
                      disabled={!opportunity.fileIds?.length}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Package className="h-4 w-4" />
                      Save bundle
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <Info title="Target buyer" text={opportunity.targetAudience} />
                    <Info title="Suggested positioning" text={opportunity.suggestedPrice || "Price not determined"} />
                    <Info title="Best monetisation route" text={opportunity.monetization || "Further assessment required"} />
                  </div>

                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <ListBlock title="Missing pieces" items={opportunity.missingPieces || []} />
                    <ListBlock title="Next steps" items={opportunity.nextSteps || []} ordered />
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {tab === "assets" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Asset catalogue</h2>
                <p className="mt-1 text-sm text-slate-500">The most recently modified indexed Drive assets.</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadFiles(search)}
                  placeholder="Search file names"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
                <button onClick={() => loadFiles(search)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                  Search
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[1fr_160px_110px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <div>File</div><div>Type</div><div>Status</div>
              </div>
              {files.map((file) => (
                <div key={file.id} className="grid grid-cols-[1fr_160px_110px] border-t border-slate-100 px-4 py-3 text-sm">
                  <div className="truncate pr-4 font-medium">{file.name}</div>
                  <div className="truncate pr-3 text-slate-500">{file.mimeType.split("/").pop()}</div>
                  <div className="capitalize text-slate-500">{file.contentStatus}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "bundles" && (
          <section className="space-y-4">
            {bundles.length === 0 ? (
              <Empty icon={Package} title="No saved bundles" body="Save an opportunity as a bundle, then export the source material as a ZIP." />
            ) : (
              bundles.map((bundle) => (
                <article key={bundle.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <h2 className="font-semibold">{bundle.name}</h2>
                    <p className="mt-1 max-w-3xl text-sm text-slate-500">{bundle.description}</p>
                    <p className="mt-2 text-xs text-slate-400">{Array.isArray(bundle.fileIds) ? bundle.fileIds.length : 0} source files</p>
                  </div>
                  <a
                    href={`/api/bundles/${bundle.id}/export`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Archive className="h-4 w-4" />
                    Export ZIP
                  </a>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{text}</div>
    </div>
  )
}

function ListBlock({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul"
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <Tag className={`mt-2 space-y-2 text-sm leading-6 text-slate-600 ${ordered ? "list-decimal" : "list-disc"} pl-5`}>
          {items.map((item, index) => <li key={index}>{item}</li>)}
        </Tag>
      ) : (
        <p className="mt-2 text-sm text-slate-400">None identified.</p>
      )}
    </div>
  )
}

function Empty({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof UserRound
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-slate-400" />
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{body}</p>
    </div>
  )
}
