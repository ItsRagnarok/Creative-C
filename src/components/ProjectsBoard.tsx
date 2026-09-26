"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Owner } from "@/components/PipelineBoard";
import { PROJECT_STAGES, PROJECT_STAGE_LABEL, projectBadge, FILE_KIND_ICON, type ProjectStage } from "@/lib/projects";

export type ProjectRow = {
  id: string;
  title: string;
  lead_id: string | null;
  stage: ProjectStage;
  owner_id: string | null;
  deadline: string | null;
  notes: string | null;
  created_at: string;
  owner: Owner | null;
  lead: { id: string; name: string } | null;
};

export type ProjectTaskRow = {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  assignee_id: string | null;
  position: number;
  assignee: Owner | null;
};

export type ProjectFileRow = {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  status_label: string | null;
  url: string | null;
};

type LeadOption = { id: string; name: string };

type ProjectForm = {
  id?: string;
  title: string;
  lead_id: string;
  owner_id: string;
  stage: ProjectStage;
  deadline: string;
  notes: string;
};

function emptyForm(): ProjectForm {
  return { title: "", lead_id: "", owner_id: "", stage: "de_pornit", deadline: "", notes: "" };
}

export default function ProjectsBoard({
  initialProjects,
  initialTasks,
  initialFiles,
  owners,
  leads,
  canEdit,
  currentUserId,
}: {
  initialProjects: ProjectRow[];
  initialTasks: ProjectTaskRow[];
  initialFiles: ProjectFileRow[];
  owners: Owner[];
  leads: LeadOption[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const supabase = createClient();
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [files, setFiles] = useState(initialFiles);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjects[0]?.id ?? null);
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; form: ProjectForm }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileKind, setNewFileKind] = useState("file");
  const [newFileUrl, setNewFileUrl] = useState("");

  const [today] = useState(() => new Date());

  const byStage = useMemo(() => {
    const map = new Map<ProjectStage, ProjectRow[]>();
    PROJECT_STAGES.forEach((s) => map.set(s.key, []));
    projects.forEach((p) => map.get(p.stage)?.push(p));
    return map;
  }, [projects]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const selectedTasks = useMemo(
    () => tasks.filter((t) => t.project_id === selectedId).sort((a, b) => a.position - b.position),
    [tasks, selectedId],
  );
  const selectedFiles = useMemo(() => files.filter((f) => f.project_id === selectedId), [files, selectedId]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, ProjectTaskRow[]>();
    tasks.forEach((t) => {
      if (!map.has(t.project_id)) map.set(t.project_id, []);
      map.get(t.project_id)!.push(t);
    });
    return map;
  }, [tasks]);

  function openCreate() {
    setError(null);
    setModal({ mode: "create", form: emptyForm() });
  }

  function openEdit(p: ProjectRow) {
    setError(null);
    setModal({
      mode: "edit",
      form: {
        id: p.id,
        title: p.title,
        lead_id: p.lead_id ?? "",
        owner_id: p.owner_id ?? "",
        stage: p.stage,
        deadline: p.deadline ?? "",
        notes: p.notes ?? "",
      },
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const { form, mode } = modal;
    if (!form.title.trim()) {
      setError("Titlul e obligatoriu.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      lead_id: form.lead_id || null,
      owner_id: form.owner_id || null,
      stage: form.stage,
      deadline: form.deadline || null,
      notes: form.notes.trim() || null,
    };

    if (mode === "create") {
      const { data, error: err } = await supabase
        .from("projects")
        .insert(payload)
        .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      const row = data as ProjectRow;
      setProjects((prev) => [row, ...prev]);
      setSelectedId(row.id);
    } else {
      const { data, error: err } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", form.id!)
        .select("*, owner:profiles(id, full_name, initials), lead:leads(id, name)")
        .single();
      setSaving(false);
      if (err) return setError(err.message);
      setProjects((prev) => prev.map((p) => (p.id === form.id ? (data as ProjectRow) : p)));
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!modal?.form.id) return;
    if (!window.confirm("Ștergi definitiv acest proiect, cu task-urile și fișierele lui?")) return;
    setSaving(true);
    const { error: err } = await supabase.from("projects").delete().eq("id", modal.form.id);
    setSaving(false);
    if (err) return setError(err.message);
    setProjects((prev) => prev.filter((p) => p.id !== modal.form.id));
    setTasks((prev) => prev.filter((t) => t.project_id !== modal.form.id));
    setFiles((prev) => prev.filter((f) => f.project_id !== modal.form.id));
    if (selectedId === modal.form.id) setSelectedId(null);
    setModal(null);
  }

  async function toggleTask(t: ProjectTaskRow) {
    const canToggle = canEdit || t.assignee_id === currentUserId;
    if (!canToggle) return;
    const { error: err } = await supabase.from("project_tasks").update({ done: !t.done }).eq("id", t.id);
    if (err) return;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newTaskTitle.trim()) return;
    const position = selectedTasks.length;
    const { data, error: err } = await supabase
      .from("project_tasks")
      .insert({
        project_id: selectedId,
        title: newTaskTitle.trim(),
        assignee_id: newTaskAssignee || null,
        position,
      })
      .select("*, assignee:profiles(id, full_name, initials)")
      .single();
    if (err) return;
    setTasks((prev) => [...prev, data as ProjectTaskRow]);
    setNewTaskTitle("");
    setNewTaskAssignee("");
  }

  async function deleteTask(id: string) {
    const { error: err } = await supabase.from("project_tasks").delete().eq("id", id);
    if (err) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function addFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !newFileName.trim()) return;
    const { data, error: err } = await supabase
      .from("project_files")
      .insert({
        project_id: selectedId,
        name: newFileName.trim(),
        kind: newFileKind,
        url: newFileUrl.trim() || null,
      })
      .select("*")
      .single();
    if (err) return;
    setFiles((prev) => [...prev, data as ProjectFileRow]);
    setNewFileName("");
    setNewFileUrl("");
    setNewFileKind("file");
  }

  async function deleteFile(id: string) {
    const { error: err } = await supabase.from("project_files").delete().eq("id", id);
    if (err) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Proiecte</h1>
          <p>Fiecare proiect e legat automat de client → task-uri → fișiere.</p>
        </div>
        {canEdit && (
          <button className="btn primary" onClick={openCreate}>+ Proiect nou</button>
        )}
      </div>

      <div className="card">
        <div className="kanban">
          {PROJECT_STAGES.map((s) => {
            const items = byStage.get(s.key) ?? [];
            return (
              <div key={s.key} className="kanban-col">
                <div className="kanban-col-head">
                  <h4>{s.label}</h4>
                  <span className="kanban-count">{items.length}</span>
                </div>
                {items.map((p) => {
                  const pTasks = tasksByProject.get(p.id) ?? [];
                  const doneCount = pTasks.filter((t) => t.done).length;
                  const pct = pTasks.length > 0 ? Math.round((doneCount / pTasks.length) * 100) : null;
                  const badge = projectBadge(p.stage, p.deadline, today);
                  return (
                    <button
                      key={p.id}
                      className="kcard"
                      style={selectedId === p.id ? { borderColor: "var(--accent)" } : undefined}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="title">{p.title}</div>
                      <div className="faint" style={{ fontSize: 12 }}>
                        {p.lead ? `client: ${p.lead.name}` : "fără client asociat"}
                      </div>
                      {pct !== null && (
                        <div style={{ marginTop: 8 }}>
                          <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                        </div>
                      )}
                      <div className="meta">
                        <span className={`badge ${badge.color}`}>{badge.text}</span>
                        {p.owner ? (
                          <div className="p-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{p.owner.initials}</div>
                        ) : (
                          <span className="faint" style={{ fontSize: 11 }}>nealocat</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && <div className="empty-note">niciun proiect</div>}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          <div className="section-title">
            <h2>{selected.title}{selected.lead ? ` — ${selected.lead.name}` : ""}</h2>
            {canEdit && (
              <button className="btn sm ghost" onClick={() => openEdit(selected)}>Editează proiect</button>
            )}
          </div>
          <div className="grid g-2">
            <div className="card">
              <div className="card-title"><h3>Task-uri</h3></div>
              <div className="list">
                {selectedTasks.map((t) => {
                  const canToggle = canEdit || t.assignee_id === currentUserId;
                  return (
                    <div key={t.id} className="list-row">
                      <input
                        type="checkbox"
                        checked={t.done}
                        disabled={!canToggle}
                        onChange={() => toggleTask(t)}
                        style={{ width: "auto" }}
                      />
                      <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--text-faint)" : undefined }}>
                        {t.title}
                      </span>
                      {t.assignee ? (
                        <div className="p-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>{t.assignee.initials}</div>
                      ) : (
                        <span className="faint">—</span>
                      )}
                      {canEdit && (
                        <button className="modal-close" onClick={() => deleteTask(t.id)} title="Șterge task">✕</button>
                      )}
                    </div>
                  );
                })}
                {selectedTasks.length === 0 && <div className="empty-note">Niciun task încă.</div>}
              </div>
              {canEdit && (
                <form onSubmit={addTask} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input
                    placeholder="Task nou…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 13 }}
                  />
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 12 }}
                  >
                    <option value="">— nealocat —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn sm primary">Adaugă</button>
                </form>
              )}
            </div>

            <div className="card">
              <div className="card-title"><h3>Fișiere proiect</h3><span className="hint">atașate direct</span></div>
              <div className="list">
                {selectedFiles.map((f) => (
                  <div key={f.id} className="list-row">
                    <span className="ic">{FILE_KIND_ICON[f.kind] ?? FILE_KIND_ICON.file}</span>
                    <span style={{ flex: 1 }}>{f.name}</span>
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer" className="btn sm ghost">Deschide</a>
                    ) : f.status_label ? (
                      <span className="badge blue">{f.status_label}</span>
                    ) : null}
                    {canEdit && (
                      <button className="modal-close" onClick={() => deleteFile(f.id)} title="Șterge fișier">✕</button>
                    )}
                  </div>
                ))}
                {selectedFiles.length === 0 && <div className="empty-note">Niciun fișier atașat.</div>}
              </div>
              {canEdit && (
                <form onSubmit={addFile} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <input
                    placeholder="Nume fișier / link…"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    style={{ flex: "1 1 140px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 13 }}
                  />
                  <select
                    value={newFileKind}
                    onChange={(e) => setNewFileKind(e.target.value)}
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 12 }}
                  >
                    <option value="file">📎 fișier</option>
                    <option value="folder">📁 folder</option>
                    <option value="video">🎬 video</option>
                    <option value="doc">📄 document</option>
                  </select>
                  <input
                    placeholder="URL (opțional)"
                    value={newFileUrl}
                    onChange={(e) => setNewFileUrl(e.target.value)}
                    style={{ flex: "1 1 140px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 13 }}
                  />
                  <button type="submit" className="btn sm primary">Adaugă</button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.mode === "create" ? "Proiect nou" : "Editează proiect"}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="field">
                <label>Titlu</label>
                <input value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} />
              </div>
              <div className="field">
                <label>Client</label>
                <select value={modal.form.lead_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, lead_id: e.target.value } })}>
                  <option value="">— fără client —</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid g-2">
                <div className="field">
                  <label>Responsabil</label>
                  <select value={modal.form.owner_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, owner_id: e.target.value } })}>
                    <option value="">— nealocat —</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Etapă</label>
                  <select value={modal.form.stage} onChange={(e) => setModal({ ...modal, form: { ...modal.form, stage: e.target.value as ProjectStage } })}>
                    {PROJECT_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{PROJECT_STAGE_LABEL[s.key]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Deadline (opțional)</label>
                <input type="date" value={modal.form.deadline} onChange={(e) => setModal({ ...modal, form: { ...modal.form, deadline: e.target.value } })} />
              </div>
              <div className="field">
                <label>Notițe</label>
                <textarea rows={2} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} />
              </div>

              {error && <div className="field-error">{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {modal.mode === "edit" && (
                  <button type="button" className="btn danger" onClick={handleDelete} disabled={saving}>
                    Șterge
                  </button>
                )}
                <button type="submit" className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? "Se salvează…" : "Salvează"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
