import { useEffect, useState } from "react";
import { apiGet } from "../lib/api.js";
import { Link } from "react-router-dom";
import { apiPost } from "../lib/api.js";
import { SelectField } from "../components/SelectField.js";
import { FolderImportPanel } from "../components/ingest/FolderImportPanel.js";
import { Button } from "../components/ui/Button.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { TextAreaField, TextField } from "../components/ui/TextField.js";

const DEFAULT_WORKSPACE = import.meta.env.VITE_WORKSPACE_ID ?? "";

type SourceType = "text" | "markdown" | "json" | "website";
type InputMode = "paste" | "folder";
type FileSourceType = Exclude<SourceType, "website">;

export function IngestPage() {
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE);
  const [sourceType, setSourceType] = useState<SourceType>("markdown");
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [content, setContent] = useState("# Sample\n\nDeterministic ingestion test.");
  const [url, setUrl] = useState("https://example.com");
  const [persistenceMode, setPersistenceMode] = useState<"persistent" | "temporary">("persistent");
  const [result, setResult] = useState<{ traceId: string; jobId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (DEFAULT_WORKSPACE) return;
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        workspaceId,
        sourceType,
        persistenceMode,
      };

      if (sourceType === "website") {
        body.url = url;
      } else {
        body.content = content;
      }

      const response = await apiPost<{ traceId: string; jobId: string }>("/ingest", body);
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const showFolderImport = inputMode === "folder" && sourceType !== "website";

  return (
    <div className="page">
      <PageHeader
        code="PIPE.01"
        title="Submit Ingestion"
        lede="Async pipeline — track progress in ingestion traces."
      />

      <section className="panel panel--form">
        <div className="form-grid">
          <TextField
            label="Workspace ID"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="Workspace UUID from db:seed"
          />

          <SelectField
            label="Source type"
            value={sourceType}
            onChange={(v) => {
              const next = v as SourceType;
              setSourceType(next);
              if (next === "website") setInputMode("paste");
            }}
            options={[
              { value: "text", label: "Plain text" },
              { value: "markdown", label: "Markdown" },
              { value: "json", label: "JSON" },
              { value: "website", label: "Website URL" },
            ]}
          />

          <SelectField
            label="Persistence"
            value={persistenceMode}
            onChange={(v) => setPersistenceMode(v as typeof persistenceMode)}
            options={[
              { value: "persistent", label: "Persistent" },
              { value: "temporary", label: "Temporary" },
            ]}
          />

          {sourceType !== "website" && (
            <SelectField
              label="Input mode"
              value={inputMode}
              onChange={(v) => setInputMode(v as InputMode)}
              options={[
                { value: "paste", label: "Paste content" },
                { value: "folder", label: "Import folder" },
              ]}
            />
          )}

          {sourceType === "website" ? (
            <TextField
              className="full-width"
              label="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          ) : showFolderImport ? (
            <div className="full-width">
              <FolderImportPanel
                workspaceId={workspaceId}
                sourceType={sourceType as FileSourceType}
                persistenceMode={persistenceMode}
                disabled={!workspaceId}
              />
            </div>
          ) : (
            <TextAreaField
              className="full-width"
              label="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
            />
          )}
        </div>

        {!showFolderImport && (
          <div className="form-actions">
            <Button disabled={submitting || !workspaceId} loading={submitting} onClick={() => void submit()}>
              POST /ingest
            </Button>
          </div>
        )}

        {!showFolderImport && error && <p className="error-text">{error}</p>}

        {!showFolderImport && result && (
          <p className="success-text">
            Job queued.{" "}
            <Link to={`/ingestion/${result.traceId}`}>View trace {result.traceId.slice(0, 10)}…</Link>
          </p>
        )}
      </section>
    </div>
  );
}
