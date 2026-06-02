import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  classifyFolderFile,
  reformatGuidanceForFile,
  type DetectedFile,
  type FileSourceType,
  type FolderClassificationMode,
  type ReformatGuidance,
} from "@memory-middleware/ingestion";
import { apiPost } from "../../lib/api.js";
import { Badge } from "../ui/Badge.js";
import { Button } from "../ui/Button.js";
import { CheckboxField } from "../ui/CheckboxField.js";
import { Modal } from "../ui/Modal.js";
import { Panel } from "../ui/Panel.js";

interface QueuedJob {
  relativePath: string;
  traceId: string;
  jobId: string;
  sourceType: FileSourceType;
}

interface ScannedEntry {
  file: File;
  content: string;
  classification: DetectedFile;
}

interface FolderImportPanelProps {
  workspaceId: string;
  sourceType: FileSourceType;
  persistenceMode: "persistent" | "temporary";
  disabled?: boolean;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function relativePathFromFile(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return withPath.webkitRelativePath || file.name;
}

function processableEntries(entries: ScannedEntry[]): ScannedEntry[] {
  return entries.filter((entry) => entry.classification.processable && entry.classification.ingestType);
}

function unprocessableEntries(entries: ScannedEntry[]): DetectedFile[] {
  return entries.filter((entry) => !entry.classification.processable).map((entry) => entry.classification);
}

export function FolderImportPanel({
  workspaceId,
  sourceType,
  persistenceMode,
  disabled,
}: FolderImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autoDetect, setAutoDetect] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedEntry[]>([]);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<DetectedFile[]>([]);
  const [queued, setQueued] = useState<QueuedJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const classificationMode: FolderClassificationMode = autoDetect ? "auto-detect" : "strict";
  const processable = processableEntries(scanned);

  const guidanceEntries = skipped
    .map((file) => ({
      file,
      guidance: reformatGuidanceForFile(file, autoDetect ? (file.suggestedType ?? sourceType) : sourceType),
    }))
    .filter((entry): entry is { file: DetectedFile; guidance: ReformatGuidance } => entry.guidance !== null);

  const resetResults = () => {
    setSkipped([]);
    setQueued([]);
    setError(null);
  };

  const scanFolder = async (fileList: FileList) => {
    setScanning(true);
    resetResults();
    setShowChoiceModal(false);
    setShowFilePicker(false);

    const files = Array.from(fileList).filter((f) => !f.name.startsWith("."));
    if (files.length === 0) {
      setScanning(false);
      setError("No files found in the selected folder.");
      return;
    }

    const root = relativePathFromFile(files[0]!).split("/")[0] ?? "folder";
    setFolderName(root);

    const entries: ScannedEntry[] = [];

    for (const file of files) {
      const relativePath = relativePathFromFile(file);
      try {
        const content = await readFileAsText(file);
        const classification = classifyFolderFile({
          relativePath,
          content,
          selectedSourceType: sourceType,
          mode: classificationMode,
        });
        entries.push({ file, content, classification });
      } catch {
        entries.push({
          file,
          content: "",
          classification: {
            relativePath,
            fileName: file.name,
            detectedType: null,
            matchesSelectedType: false,
            processable: false,
            reason: "Could not read file",
          },
        });
      }
    }

    setScanned(entries);
    setScanning(false);

    if (processableEntries(entries).length === 0) {
      setSkipped(unprocessableEntries(entries));
      if (entries.length === 0) {
        setError("No files found in the selected folder.");
      }
      return;
    }

    setShowChoiceModal(true);
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;
    await scanFolder(fileList);
    if (inputRef.current) inputRef.current.value = "";
  };

  const queueEntries = async (entries: ScannedEntry[]) => {
    if (!workspaceId) {
      setError("Workspace ID is required before queuing ingestion jobs.");
      return;
    }

    setQueuing(true);
    setError(null);
    setShowChoiceModal(false);
    setShowFilePicker(false);

    const jobs: QueuedJob[] = [];
    const failed: DetectedFile[] = [...unprocessableEntries(scanned)];

    for (const entry of entries) {
      const { file, content, classification } = entry;
      const ingestType = classification.ingestType;
      if (!ingestType) continue;

      try {
        const response = await apiPost<{ traceId: string; jobId: string }>("/ingest", {
          workspaceId,
          sourceType: ingestType,
          persistenceMode,
          content,
          title: classification.fileName.replace(/\.[^.]+$/, ""),
          sourceLabel: relativePathFromFile(file),
        });
        jobs.push({
          relativePath: classification.relativePath,
          traceId: response.traceId,
          jobId: response.jobId,
          sourceType: ingestType,
        });
      } catch (e) {
        failed.push({
          ...classification,
          processable: false,
          matchesSelectedType: false,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    setQueued(jobs);
    setSkipped(failed);
    setQueuing(false);
  };

  const openFilePicker = () => {
    const paths = new Set(processable.map((entry) => entry.classification.relativePath));
    setSelectedPaths(paths);
    setShowChoiceModal(false);
    setShowFilePicker(true);
  };

  const uploadAll = () => {
    void queueEntries(processable);
  };

  const uploadSelected = () => {
    const selected = processable.filter((entry) => selectedPaths.has(entry.classification.relativePath));
    void queueEntries(selected);
  };

  const togglePath = (relativePath: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relativePath)) next.delete(relativePath);
      else next.add(relativePath);
      return next;
    });
  };

  const toggleAllSelected = () => {
    if (selectedPaths.size === processable.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(processable.map((entry) => entry.classification.relativePath)));
    }
  };

  const busy = scanning || queuing;
  const mismatchCount = scanned.filter(
    (entry) => entry.classification.processable && !entry.classification.matchesSelectedType,
  ).length;
  const canResumeImport =
    processable.length > 0 && !showChoiceModal && !showFilePicker && !busy && queued.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-0)] p-6 text-center">
        <input
          ref={inputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is supported in Chromium browsers
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => void handleFolderSelect(e)}
        />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {autoDetect
            ? "Select a folder — each file is auto-detected and queued by its format."
            : (
              <>
                Select a folder — each file is verified against{" "}
                <span className="font-mono text-[var(--color-accent)]">{sourceType}</span> before queuing.
              </>
            )}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <CheckboxField
            label="Auto-detect source type per file"
            checked={autoDetect}
            onChange={setAutoDetect}
          />
          <Button
            variant="secondary"
            disabled={disabled || busy}
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Processing folder…" : "Import folder"}
          </Button>
        </div>
        {folderName && !busy && !showChoiceModal && !showFilePicker && (
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            {folderName} — {queued.length} queued
            {skipped.length > 0 ? `, ${skipped.length} skipped` : ""}
          </p>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {canResumeImport && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-0)] px-4 py-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-mono text-[var(--color-text-primary)]">{folderName}</span> — {processable.length}{" "}
            file{processable.length === 1 ? "" : "s"} ready to import
          </p>
          <Button variant="secondary" onClick={() => setShowChoiceModal(true)}>
            Review import options
          </Button>
        </div>
      )}

      <Modal
        open={showChoiceModal}
        title={folderName ? `Import from ${folderName}` : "Import folder"}
        description={`${processable.length} file${processable.length === 1 ? "" : "s"} ready${
          unprocessableEntries(scanned).length > 0
            ? ` · ${unprocessableEntries(scanned).length} cannot be processed`
            : ""
        }${autoDetect && mismatchCount > 0 ? ` · ${mismatchCount} auto-detected` : ""}`}
        onClose={() => setShowChoiceModal(false)}
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          Choose how you want to queue files from this folder.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" variant="secondary" onClick={openFilePicker}>
            Select files from {folderName ?? "folder"}
          </Button>
          <Button className="flex-1" disabled={!workspaceId || queuing} loading={queuing} onClick={uploadAll}>
            Upload All
          </Button>
        </div>
        {!workspaceId && (
          <p className="mt-3 text-xs text-[var(--color-danger)]">Workspace ID is required before uploading.</p>
        )}
      </Modal>

      <Modal
        open={showFilePicker}
        title={`Select files from ${folderName ?? "folder"}`}
        description={`${selectedPaths.size} of ${processable.length} selected`}
        onClose={() => setShowFilePicker(false)}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFilePicker(false)}>
              Cancel
            </Button>
            <Button
              disabled={!workspaceId || selectedPaths.size === 0 || queuing}
              loading={queuing}
              onClick={uploadSelected}
            >
              Queue selected ({selectedPaths.size})
            </Button>
          </>
        }
      >
        <div className="mb-3">
          <CheckboxField
            label={selectedPaths.size === processable.length ? "Deselect all" : "Select all"}
            checked={selectedPaths.size === processable.length && processable.length > 0}
            onChange={toggleAllSelected}
          />
        </div>
        <ul className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border-subtle)]">
          {processable.map((entry) => {
            const { classification } = entry;
            const checked = selectedPaths.has(classification.relativePath);
            return (
              <li key={classification.relativePath}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface-2)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePath(classification.relativePath)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--color-text-secondary)]">
                    {classification.relativePath}
                  </span>
                  {autoDetect && classification.ingestType && (
                    <Badge variant="accent">{classification.ingestType}</Badge>
                  )}
                  {!autoDetect && !classification.matchesSelectedType && classification.detectedType && (
                    <Badge variant="warning">{classification.detectedType}</Badge>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </Modal>

      {queued.length > 0 && (
        <Panel code="PIPE.01b" title="Queued for ingestion" description="Matching files submitted to the async pipeline.">
          <ul className="event-list">
            {queued.map((job) => (
              <li key={job.jobId}>
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <span className="truncate font-mono text-xs">{job.relativePath}</span>
                  {autoDetect && <Badge variant="accent">{job.sourceType}</Badge>}
                </span>
                <Link to={`/ingestion/${job.traceId}`}>Trace</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {skipped.length > 0 && (
        <Panel
          code="PIPE.01c"
          title="Could not process"
          description={
            autoDetect
              ? "These files are unsupported or could not be read."
              : "These files did not match the selected source type or are unsupported."
          }
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Detected</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {skipped.map((file) => (
                <tr key={file.relativePath}>
                  <td className="font-mono text-xs">{file.relativePath}</td>
                  <td>
                    {file.detectedType ? (
                      <Badge variant="warning">{file.detectedType}</Badge>
                    ) : (
                      <Badge variant="danger">none</Badge>
                    )}
                  </td>
                  <td className="text-[var(--color-text-tertiary)]">{file.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {guidanceEntries.length > 0 && (
        <Panel
          code="NORM.01"
          title="Reformat to canonical input"
          description="Wrong-format files can be converted to meet the deterministic normalization interface before re-import."
        >
          <div className="space-y-4">
            {guidanceEntries.map(({ file, guidance }) => (
              <article
                key={file.relativePath}
                className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-4"
              >
                <header className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">{file.fileName}</span>
                  <Badge variant="accent">
                    {guidance.fromLabel} → {guidance.targetType}
                  </Badge>
                </header>
                <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                  {guidance.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
            Normalization order: deterministic parse → structural extraction → schema validation → optional LLM
            structuring. Re-import after conversion.
          </p>
        </Panel>
      )}
    </div>
  );
}
