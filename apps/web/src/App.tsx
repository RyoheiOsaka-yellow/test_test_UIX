import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BranchDto,
  Entity,
  Operation,
  PreviewResultDto,
  TankEntityData,
  TransactionDto,
  VesselDto,
  VesselEntityData,
} from '@dock/shared';
import { api, ApiError, type Snapshot } from './api.js';
import { DockScene } from './scene.js';
import { EntityPanel, HistoryPanel, HydroPanel, TankEditor, TopBar } from './panels.js';

export interface PreviewState {
  preview: PreviewResultDto;
  tankId: string;
  after: TankEntityData;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DockScene | null>(null);

  const [vessel, setVessel] = useState<(VesselDto & { branches: BranchDto[] }) | null>(null);
  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [viewVersion, setViewVersion] = useState<number | null>(null); // null = head
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const atHead = viewVersion === null || viewVersion === branch?.headVersion;

  const vesselData = useMemo(
    () => snapshot?.entities.find((e) => e.kind === 'vessel')?.data as VesselEntityData | undefined,
    [snapshot],
  );

  // ---- bootstrap ----------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const projects = await api.projects();
        if (!projects.length) throw new Error('プロジェクトがありません — API を seed してください');
        const vessels = await api.vessels(projects[0].id);
        const v = await api.vessel(vessels[0].id);
        setVessel(v);
        const main = v.branches.find((b) => b.name === 'main') ?? v.branches[0];
        setBranch(main);
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      }
    })();
  }, []);

  const refreshBranch = useCallback(async (branchId: string, version: number | null) => {
    const [b, snap, txs] = await Promise.all([
      api.branch(branchId),
      api.entities(branchId, version === null ? {} : { version }),
      api.transactions(branchId),
    ]);
    setBranch(b);
    setSnapshot(snap);
    setTransactions(txs);
  }, []);

  useEffect(() => {
    if (!branch) return;
    refreshBranch(branch.id, viewVersion).catch((err) => setError(String(err.message ?? err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch?.id, viewVersion]);

  // ---- three.js lifecycle --------------------------------------------------
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new DockScene(mountRef.current);
    scene.onSelect = (id) => setSelectedId(id);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !sceneRef.current) return;
    sceneRef.current.setModel(snapshot.entities);
    sceneRef.current.setHome();
    const v = snapshot.entities.find((e) => e.kind === 'vessel')?.data as VesselEntityData | undefined;
    if (v && draft === null) setDraft(v.principal.designDraft);
    sceneRef.current.setDraft(draft ?? v?.principal.designDraft ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  useEffect(() => {
    if (draft !== null) sceneRef.current?.setDraft(draft);
  }, [draft]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
    if (selectedId) sceneRef.current?.focusTank(selectedId);
    if (previewState && previewState.tankId !== selectedId) {
      setPreviewState(null);
      sceneRef.current?.setGhost(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- actions -------------------------------------------------------------
  const runPreview = useCallback(
    async (tankId: string, patch: Record<string, unknown>) => {
      if (!branch || !snapshot) return;
      setBusy(true);
      setError(null);
      try {
        const ops: Operation[] = [{ op: 'entity.update', id: tankId, patch }];
        const preview = await api.preview(
          branch.id,
          ops,
          `Resize ${tankId} (UI)`,
          snapshot.version,
        );
        if (!preview.validation.ok) {
          setError(`検証エラー: ${preview.validation.errors.join('; ')}`);
          setPreviewState(null);
          sceneRef.current?.setGhost(null);
          return;
        }
        const after = preview.effects[0].after as TankEntityData;
        setPreviewState({ preview, tankId, after });
        sceneRef.current?.setGhost(after);
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
          const body = err.body as PreviewResultDto | null;
          setError(`検証エラー: ${body?.validation?.errors?.join('; ') ?? err.message}`);
        } else {
          setError(String(err instanceof Error ? err.message : err));
        }
      } finally {
        setBusy(false);
      }
    },
    [branch, snapshot],
  );

  const commitPreview = useCallback(async () => {
    if (!previewState || !branch) return;
    setBusy(true);
    setError(null);
    try {
      await api.commit(previewState.preview.transactionId);
      setPreviewState(null);
      sceneRef.current?.setGhost(null);
      await refreshBranch(branch.id, null);
      setViewVersion(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('コミット競合: ブランチが先に進んでいます。再読み込みして再プレビューしてください。');
        await refreshBranch(branch.id, viewVersion);
      } else {
        setError(String(err instanceof Error ? err.message : err));
      }
    } finally {
      setBusy(false);
    }
  }, [previewState, branch, refreshBranch, viewVersion]);

  const discardPreview = useCallback(() => {
    setPreviewState(null);
    sceneRef.current?.setGhost(null);
  }, []);

  const revert = useCallback(
    async (txId: string) => {
      if (!branch) return;
      setBusy(true);
      setError(null);
      try {
        await api.revert(txId);
        await refreshBranch(branch.id, null);
        setViewVersion(null);
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setBusy(false);
      }
    },
    [branch, refreshBranch],
  );

  const createBranch = useCallback(
    async (name: string, atVersion?: number) => {
      if (!vessel || !branch) return;
      setBusy(true);
      setError(null);
      try {
        const created = await api.createBranch(vessel.id, name, branch.id, atVersion);
        const v = await api.vessel(vessel.id);
        setVessel(v);
        setViewVersion(null);
        setBranch(created);
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setBusy(false);
      }
    },
    [vessel, branch],
  );

  const selectBranch = useCallback(
    (id: string) => {
      const b = vessel?.branches.find((x) => x.id === id);
      if (b) {
        setViewVersion(null);
        setSelectedId(null);
        setPreviewState(null);
        sceneRef.current?.setGhost(null);
        setBranch(b);
      }
    },
    [vessel],
  );

  const selectedTank = useMemo((): Entity | null => {
    if (!selectedId || !snapshot) return null;
    return snapshot.entities.find((e) => e.id === selectedId && e.kind === 'tank') ?? null;
  }, [selectedId, snapshot]);

  return (
    <div className="app">
      <TopBar
        vessel={vessel}
        branch={branch}
        viewVersion={viewVersion}
        onSelectBranch={selectBranch}
        onSetVersion={setViewVersion}
        onHome={() => sceneRef.current?.setHome()}
      />
      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error} <span className="dismiss">×</span>
        </div>
      )}
      {!atHead && (
        <div className="banner history">
          過去バージョン v{viewVersion} を表示中(読み取り専用) —{' '}
          <button className="link" onClick={() => setViewVersion(null)}>
            HEAD に戻る
          </button>
        </div>
      )}
      <div className="layout">
        <aside className="panel left">
          <EntityPanel
            snapshot={snapshot}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="viewport" ref={mountRef} />
        <aside className="panel right">
          <HydroPanel
            snapshot={snapshot}
            branch={branch}
            draft={draft}
            onDraft={setDraft}
            vesselData={vesselData}
            atHead={atHead}
            viewVersion={viewVersion}
          />
          {selectedTank && (
            <TankEditor
              key={`${selectedTank.id}@${snapshot?.version}`}
              tank={selectedTank.data as TankEntityData}
              tankId={selectedTank.id}
              editable={atHead}
              busy={busy}
              previewState={previewState}
              onPreview={runPreview}
              onCommit={commitPreview}
              onDiscard={discardPreview}
            />
          )}
          <HistoryPanel
            transactions={transactions}
            busy={busy}
            editable={atHead}
            onRevert={revert}
            onCreateBranch={createBranch}
            onViewVersion={setViewVersion}
          />
        </aside>
      </div>
    </div>
  );
}
