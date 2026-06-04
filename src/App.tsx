import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { StatusBar } from "@/components/StatusBar";
import { OptionsCard } from "@/components/OptionsCard";
import { RefinementCard } from "@/components/RefinementCard";
import { MapperModal } from "@/components/MapperModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ModelSetupModal } from "@/components/ModelSetupModal";
import { WorkflowPanel, type WorkflowMode } from "@/components/WorkflowPanel";
import { rpc } from "@/rpc/client";
import { useUi } from "@/lib/store";
import type { AppState, ModelStatus } from "@/rpc/types";

async function configurePackagedBackendEndpoint() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const status = await invoke<{ port?: number }>("backend_status");
    if (typeof status?.port === "number") {
      rpc.configure("127.0.0.1", status.port);
    }
  } catch {
    // Browser development falls back to VITE_BACKEND_PORT or 8765.
  }
}

export default function App() {
  const setConnected = useUi((s) => s.setConnected);
  const setState = useUi((s) => s.setState);
  const pushStatus = useUi((s) => s.pushStatus);
  const setProcessingProgress = useUi((s) => s.setProcessingProgress);
  const modal = useUi((s) => s.modal);
  const setModal = useUi((s) => s.setModal);
  const setStageMode = useUi((s) => s.setStageMode);
  const liveRunning = useUi((s) => s.state?.live_running ?? false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("file");
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelSetupOpen, setModelSetupOpen] = useState(false);

  useEffect(() => {
    const checkModels = async () => {
      const status = await rpc.modelStatus(false);
      setModelStatus(status);
      setModelSetupOpen(status.missing_required.length > 0);
    };

    let cancelled = false;
    configurePackagedBackendEndpoint().finally(() => {
      if (!cancelled) rpc.connect();
    });

    const offConn = rpc.onConnection(async (c) => {
      setConnected(c);
      if (c) {
        try {
          const s = await rpc.getState();
          setState(s);
          await checkModels();
        } catch (err) {
          // ignore — will retry
        }
      }
    });
    const offEv = rpc.on((e) => {
      if (e.event === "hello") {
        setState(e.state);
      } else if (e.event === "status") {
        pushStatus(e.text);
      } else if (e.event === "processing_progress") {
        setProcessingProgress({
          phase: e.phase,
          desc: e.desc,
          unit: e.unit,
          current: e.current,
          total: e.total,
          ratio: e.ratio,
          elapsed: e.elapsed,
        });
      } else if (e.event === "processing_done") {
        setProcessingProgress(null);
        rpc
          .getState()
          .then((s: AppState) => {
            setState(s);
            if (s.output_path) setStageMode("output");
          })
          .catch(() => undefined);
      }
    });

    const t = window.setInterval(async () => {
      try {
        const s = await rpc.getState();
        setState(s);
      } catch {
        /* ignore */
      }
    }, 3000);

    return () => {
      cancelled = true;
      offConn();
      offEv();
      window.clearInterval(t);
    };
  }, [setConnected, setState, pushStatus, setStageMode, setProcessingProgress]);

  const changeWorkflowMode = async (mode: WorkflowMode) => {
    if (mode === workflowMode) return;
    if (liveRunning) {
      await rpc.stopLive().catch(() => undefined);
    }
    setWorkflowMode(mode);
    setStageMode("idle");
  };

  return (
    <div className="relative z-10 flex h-screen flex-col">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenModels={async () => {
          const status = await rpc.modelStatus(false);
          setModelStatus(status);
          setModelSetupOpen(true);
        }}
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto flex h-full max-w-[1180px] flex-col gap-3">
          <WorkflowPanel mode={workflowMode} onModeChange={changeWorkflowMode} />

          <section className="grid gap-3 md:grid-cols-2">
            <OptionsCard />
            <RefinementCard />
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 bg-bg-soft/40 px-4 py-1.5 backdrop-blur">
        <StatusBar />
      </footer>

      <MapperModal
        open={modal === "mapping"}
        onClose={() => {
          setModal("none");
          (window as any).__mapperMode = undefined;
        }}
        mode={(window as any).__mapperMode === "live" ? "live" : "video"}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ModelSetupModal
        open={modelSetupOpen}
        status={modelStatus}
        onStatusChange={(status) => {
          setModelStatus(status);
        }}
        onClose={() => setModelSetupOpen(false)}
      />
    </div>
  );
}
