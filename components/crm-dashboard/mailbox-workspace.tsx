"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSignature,
  FileText,
  Forward,
  Inbox,
  Loader2,
  MailOpen,
  Paperclip,
  Plus,
  Reply,
  ReplyAll,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  MailboxMessageDto,
  PlatformDocumentDto,
  SignatureRequestDto,
} from "@/lib/api/client";
import type { CrmSetupConfig, EmailComposerLead } from "./types";
import {
  cancelNativeSignatureRequest,
  completePdfUpload,
  createNativeSignatureRequest,
  createPdfUpload,
  discardMailboxDraft,
  getPlatformDocumentDownload,
  listPlatformDocuments,
  listSignatureRequests,
  loadMailbox,
  permanentlyDeleteMailboxEmail,
  restoreMailboxEmail,
  saveMailboxDraft,
  sendMailboxEmail,
  setMailboxReadState,
  trashMailboxEmail,
} from "@/lib/actions/email-actions";
import styles from "./mailbox-workspace.module.css";

const RichEditor = dynamic(() => import("@/components/ui/rich-editor"), {
  ssr: false,
  loading: () => (
    <div className={styles.dropzone}>Loading formatting tools…</div>
  ),
});
type Folder = MailboxMessageDto["folder"] | "signatures";
type Attachment = PlatformDocumentDto & { progress?: number };
type ComposerSeed = Partial<MailboxMessageDto> & {
  mode?: "new" | "reply" | "replyAll" | "forward";
};
const folders: Array<{ id: Folder; label: string; icon: typeof Inbox }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: Save },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "signatures", label: "Signatures", icon: FileSignature },
];

export default function MailboxWorkspace({
  leads,
  setupConfig,
}: {
  leads: EmailComposerLead[];
  setupConfig?: CrmSetupConfig;
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<MailboxMessageDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const selected =
    messages.find((message) => message.id === selectedId) || messages[0];
  const refresh = useCallback(
    async (
      nextFolder: Exclude<Folder, "signatures"> = folder === "signatures"
        ? "inbox"
        : folder,
    ) => {
      setLoading(true);
      const result = await loadMailbox(nextFolder);
      setLoading(false);
      if ("error" in result) return setFeedback(result.error);
      setMessages(result.messages);
      setUnread(result.unread);
      setSelectedId((current) =>
        result.messages.some((message) => message.id === current)
          ? current
          : result.messages[0]?.id || "",
      );
    },
    [folder],
  );
  useEffect(() => {
    if (folder !== "signatures") void refresh(folder);
  }, [folder, refresh]);

  async function openMessage(message: MailboxMessageDto) {
    setSelectedId(message.id);
    if (message.folder === "inbox" && !message.is_read) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
      const result = await setMailboxReadState(message.id, true);
      if ("error" in result) {
        setFeedback(result.error);
        void refresh("inbox");
      }
    }
  }
  async function setRead(message: MailboxMessageDto, read: boolean) {
    const result = await setMailboxReadState(message.id, read);
    if ("error" in result) return setFeedback(result.error);
    void refresh(folder === "signatures" ? "inbox" : folder);
  }
  async function trash(message: MailboxMessageDto) {
    if (!window.confirm("Move this email to Trash?")) return;
    const result = await trashMailboxEmail(message.id);
    if ("error" in result)
      return setFeedback(
        result.error || "The email could not be moved to Trash.",
      );
    setFeedback("Email moved to Trash.");
    void refresh(folder === "signatures" ? "inbox" : folder);
  }
  async function restore(message: MailboxMessageDto) {
    const result = await restoreMailboxEmail(message.id);
    if ("error" in result) return setFeedback(result.error);
    setFeedback("Email restored.");
    void refresh("trash");
  }
  async function erase(message: MailboxMessageDto) {
    if (
      !window.confirm("Permanently delete this email? This cannot be undone.")
    )
      return;
    const result = await permanentlyDeleteMailboxEmail(message.id);
    if ("error" in result)
      return setFeedback(
        result.error || "The email could not be permanently deleted.",
      );
    setFeedback("Email permanently deleted.");
    void refresh("trash");
  }
  async function download(documentId: string) {
    const result = await getPlatformDocumentDownload(documentId);
    if ("error" in result) return setFeedback(result.error);
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  function responseSeed(
    message: MailboxMessageDto,
    mode: "reply" | "replyAll" | "forward",
  ): ComposerSeed {
    const own = setupConfig?.defaultSenderEmail?.toLowerCase() || "";
    const replyAddress = message.from_address;
    const recipients = mode === "forward" ? [] : [replyAddress];
    const cc =
      mode === "replyAll"
        ? [...message.to_addresses, ...message.cc_addresses].filter(
            (value, index, all) =>
              value.toLowerCase() !== own &&
              value.toLowerCase() !== replyAddress.toLowerCase() &&
              all.indexOf(value) === index,
          )
        : [];
    const prefix =
      mode === "forward"
        ? "Fwd: "
        : /^re:/i.test(message.subject)
          ? ""
          : "Re: ";
    return {
      mode,
      thread_id: message.thread_id,
      id: message.id,
      to_addresses: recipients,
      cc_addresses: cc,
      subject: `${prefix}${message.subject}`,
      attachments: message.attachments,
      plain_body:
        mode === "forward"
          ? `\n\n---------- Forwarded message ----------\nFrom: ${message.from_name || message.from_address} <${message.from_address}>\nDate: ${new Date(message.received_at || message.sent_at || message.created_at).toLocaleString()}\nSubject: ${message.subject}\n\n${message.plain_body}`
          : "",
      sanitised_html_body:
        mode === "forward"
          ? `<p><br></p><hr><p><strong>Forwarded message</strong><br>From: ${message.from_name || message.from_address} &lt;${message.from_address}&gt;<br>Subject: ${message.subject}</p><blockquote>${message.sanitised_html_body || message.plain_body}</blockquote>`
          : "",
    };
  }

  if (folder === "signatures")
    return (
      <div className={styles.shell}>
        <Topbar
          folder={folder}
          unread={unread}
          setFolder={setFolder}
          onCompose={() => setComposer({ mode: "new" })}
        />
        {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
        <SignatureWorkspace leads={leads} onFeedback={setFeedback} />
        {composer ? (
          <FlagshipComposer
            leads={leads}
            setupConfig={setupConfig}
            seed={composer}
            onClose={() => setComposer(null)}
            onSaved={() => {
              setComposer(null);
              setFolder("drafts");
            }}
            onSent={() => {
              setComposer(null);
              setFolder("sent");
            }}
          />
        ) : null}
      </div>
    );
  return (
    <div className={styles.shell}>
      <Topbar
        folder={folder}
        unread={unread}
        setFolder={setFolder}
        onCompose={() => setComposer({ mode: "new" })}
      />
      {feedback ? (
        <div
          className={`${styles.feedback} ${feedback.toLowerCase().includes("could not") ? styles.error : ""}`}
        >
          {feedback}
        </div>
      ) : null}
      <div className={styles.mailGrid}>
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <strong>{folders.find((item) => item.id === folder)?.label}</strong>
            <span>
              {loading
                ? "Loading…"
                : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {loading ? (
            <div className={styles.empty}>
              <Loader2 className="animate-spin" />
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <button
                key={message.id}
                className={`${styles.messageRow} ${selected?.id === message.id ? styles.selected : ""} ${!message.is_read ? styles.unread : ""}`}
                onClick={() => void openMessage(message)}
              >
                <div className={styles.rowTop}>
                  <strong>
                    {message.direction === "inbound"
                      ? message.from_name || message.from_address
                      : message.to_addresses.join(", ") || "Draft"}
                  </strong>
                  <time>
                    {new Date(
                      message.received_at ||
                        message.sent_at ||
                        message.created_at,
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </div>
                <strong>{message.subject || "(No subject)"}</strong>
                <p>{message.plain_body || "Rich-text message"}</p>
                <div className={styles.rowBottom}>
                  <span>
                    {message.priority === "high"
                      ? "High priority"
                      : message.status}
                  </span>
                  <span>
                    {message.attachments.length
                      ? `${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className={styles.empty}>
              <div>
                <MailOpen size={28} />
                <strong>No messages here</strong>
                <span>
                  {folder === "inbox"
                    ? "Inbound messages will appear as Resend delivers them."
                    : "This folder is empty."}
                </span>
              </div>
            </div>
          )}
        </div>
        {selected ? (
          <article className={styles.detail}>
            <header className={styles.detailHeader}>
              <div>
                <h3>{selected.subject || "(No subject)"}</h3>
                <p>
                  From:{" "}
                  {selected.from_name
                    ? `${selected.from_name} <${selected.from_address}>`
                    : selected.from_address}
                </p>
                <p>
                  To: {selected.to_addresses.join(", ")}
                  {selected.cc_addresses.length
                    ? ` · CC: ${selected.cc_addresses.join(", ")}`
                    : ""}
                </p>
              </div>
              <div className={styles.detailActions}>
                {selected.folder === "inbox" ? (
                  <>
                    <button
                      className={styles.iconButton}
                      title="Reply"
                      onClick={() =>
                        setComposer(responseSeed(selected, "reply"))
                      }
                    >
                      <Reply size={15} />
                    </button>
                    <button
                      className={styles.iconButton}
                      title="Reply all"
                      onClick={() =>
                        setComposer(responseSeed(selected, "replyAll"))
                      }
                    >
                      <ReplyAll size={15} />
                    </button>
                  </>
                ) : null}
                <button
                  className={styles.iconButton}
                  title="Forward"
                  onClick={() => setComposer(responseSeed(selected, "forward"))}
                >
                  <Forward size={15} />
                </button>
                <button
                  className={styles.iconButton}
                  title={selected.is_read ? "Mark unread" : "Mark read"}
                  onClick={() => void setRead(selected, !selected.is_read)}
                >
                  <MailOpen size={15} />
                </button>
                {selected.folder === "trash" ? (
                  <>
                    <button
                      className={styles.iconButton}
                      title="Restore"
                      onClick={() => void restore(selected)}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      className={styles.iconButton}
                      title="Delete permanently"
                      onClick={() => void erase(selected)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.iconButton}
                    title="Move to Trash"
                    onClick={() => void trash(selected)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </header>
            <div className={styles.body}>
              {selected.sanitised_html_body ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: selected.sanitised_html_body,
                  }}
                />
              ) : (
                <p style={{ whiteSpace: "pre-wrap" }}>{selected.plain_body}</p>
              )}
            </div>
            {selected.attachments.length ? (
              <div className={styles.attachments}>
                <strong>Attachments</strong>
                {selected.attachments.map((attachment) => (
                  <div className={styles.attachment} key={attachment.id}>
                    <FileText size={18} />
                    <div>
                      <strong>{attachment.document.safe_filename}</strong>
                      <span>
                        {(attachment.document.size_bytes / 1024 / 1024).toFixed(
                          2,
                        )}{" "}
                        MB · PDF
                      </span>
                    </div>
                    <button
                      className={styles.iconButton}
                      title="Download attachment"
                      onClick={() => void download(attachment.document.id)}
                    >
                      <Download size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <div className={styles.empty}>
            <div>
              <Inbox size={28} />
              <strong>Select a message</strong>
              <span>
                Read, reply, forward, download files, or manage its state.
              </span>
            </div>
          </div>
        )}
      </div>
      {composer ? (
        <FlagshipComposer
          leads={leads}
          setupConfig={setupConfig}
          seed={composer}
          onClose={() => setComposer(null)}
          onSaved={() => {
            setComposer(null);
            setFolder("drafts");
          }}
          onSent={() => {
            setComposer(null);
            setFolder("sent");
          }}
        />
      ) : null}
    </div>
  );
}

function Topbar({
  folder,
  unread,
  setFolder,
  onCompose,
}: {
  folder: Folder;
  unread: number;
  setFolder: (folder: Folder) => void;
  onCompose: () => void;
}) {
  return (
    <div className={styles.topbar}>
      <nav className={styles.tabs} aria-label="Mailbox folders">
        {folders.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={folder === id ? styles.active : ""}
            onClick={() => setFolder(id)}
          >
            <Icon size={14} />
            {label}
            {id === "inbox" && unread ? ` (${unread})` : ""}
          </button>
        ))}
      </nav>
      <button className={styles.primary} onClick={onCompose}>
        <Plus size={15} /> Compose
      </button>
    </div>
  );
}

function AddressChips({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  function commit() {
    const candidates = input
      .split(/[;,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (!candidates.length) return;
    const invalid = candidates.find(
      (item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item),
    );
    if (invalid) return setError(`${invalid} is not a valid email`);
    onChange(Array.from(new Set([...values, ...candidates])));
    setInput("");
    setError("");
  }
  return (
    <div className={styles.addressRow}>
      <span className={styles.addressLabel}>{label}</span>
      <div className={styles.chips} title={error}>
        {values.map((value) => (
          <span className={styles.chip} key={value}>
            {value}
            <button
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          aria-label={`${label} recipient`}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setError("");
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (["Enter", ",", ";"].includes(event.key)) {
              event.preventDefault();
              commit();
            }
            if (event.key === "Backspace" && !input)
              onChange(values.slice(0, -1));
          }}
          placeholder={values.length ? "Add another" : "name@company.com"}
        />
      </div>
    </div>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) =>
      event.lengthComputable &&
      onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onerror = () => reject(new Error("PDF upload failed."));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PDF upload failed (${xhr.status}).`));
    xhr.send(file);
  });
}

async function uploadPdf(
  file: File,
  kind: "attachment" | "signature_original",
  leadId: string | null,
  onProgress: (progress: number) => void,
) {
  if (
    file.type !== "application/pdf" ||
    file.size <= 0 ||
    file.size > 25 * 1024 * 1024
  )
    throw new Error("Choose a PDF up to 25 MB.");
  const started = await createPdfUpload({
    filename: file.name,
    mimeType: "application/pdf",
    sizeBytes: file.size,
    kind,
  });
  if ("error" in started) throw new Error(started.error);
  await uploadWithProgress(started.uploadUrl, file, onProgress);
  const result = await completePdfUpload({
    filename: file.name,
    mimeType: "application/pdf",
    sizeBytes: file.size,
    kind,
    storagePath: started.storagePath,
    leadId,
  });
  if ("error" in result) throw new Error(result.error);
  return result;
}

function FlagshipComposer({
  leads,
  setupConfig,
  seed,
  onClose,
  onSaved,
  onSent,
}: {
  leads: EmailComposerLead[];
  setupConfig?: CrmSetupConfig;
  seed: ComposerSeed;
  onClose: () => void;
  onSaved: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(seed.to_addresses || []);
  const [cc, setCc] = useState(seed.cc_addresses || []);
  const [bcc, setBcc] = useState(seed.bcc_addresses || []);
  const [showCopies, setShowCopies] = useState(
    Boolean(seed.cc_addresses?.length || seed.bcc_addresses?.length),
  );
  const [subject, setSubject] = useState(seed.subject || "");
  const [html, setHtml] = useState(seed.sanitised_html_body || "");
  const [leadId, setLeadId] = useState(seed.lead_id || "");
  const [priority, setPriority] = useState<"low" | "normal" | "high">(
    seed.priority || "normal",
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>(
    seed.attachments?.map((item) => ({
      ...item.document,
      document_kind: "attachment",
      sha256: "",
      page_count: null,
      created_at: "",
    })) || [],
  );
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftId, setDraftId] = useState(
    seed.folder === "drafts" ? seed.id || "" : "",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const autosaveRef = useRef(false);
  const saveDraftRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const plain = useMemo(
    () =>
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+\n/g, "\n")
        .trim(),
    [html],
  );
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  async function attachFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const temp = {
        id: `upload-${crypto.randomUUID()}`,
        filename: file.name,
        safe_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sha256: "",
        document_kind: "attachment" as const,
        page_count: null,
        created_at: "",
        progress: 0,
      };
      setAttachments((current) => [...current, temp]);
      try {
        const document = await uploadPdf(
          file,
          "attachment",
          leadId || null,
          (progress) =>
            setAttachments((current) =>
              current.map((item) =>
                item.id === temp.id ? { ...item, progress } : item,
              ),
            ),
        );
        setAttachments((current) =>
          current.map((item) => (item.id === temp.id ? document : item)),
        );
      } catch (error) {
        setAttachments((current) =>
          current.filter((item) => item.id !== temp.id),
        );
        setFeedback(
          error instanceof Error ? error.message : "Attachment upload failed.",
        );
      }
    }
  }
  const payload = () => ({
    ...(draftId ? { id: draftId } : {}),
    leadId: leadId || null,
    threadId: seed.thread_id || null,
    to,
    cc,
    bcc,
    subject,
    htmlBody: html,
    plainBody: plain,
    priority,
    attachmentIds: attachments
      .filter((item) => !item.id.startsWith("upload-"))
      .map((item) => item.id),
  });
  async function saveDraft(silent = false) {
    if (busy === "send") return;
    if (!silent) setBusy("draft");
    const result = await saveMailboxDraft(payload());
    if (!silent) setBusy("");
    if ("error" in result) {
      if (!silent) setFeedback(result.error);
      return;
    }
    setDraftId(result.id);
    setDirty(false);
    if (!silent) {
      setFeedback("Draft saved.");
      window.setTimeout(onSaved, 500);
    }
  }
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });
  useEffect(() => {
    if (!autosaveRef.current) {
      autosaveRef.current = true;
      return;
    }
    setDirty(true);
    const timer = window.setTimeout(() => {
      if (subject || plain || to.length) void saveDraftRef.current?.(true);
    }, 2_500);
    return () => window.clearTimeout(timer);
  }, [attachments.length, bcc, cc, html, leadId, plain, priority, subject, to]);
  async function send() {
    setBusy("send");
    setFeedback("");
    const result = await sendMailboxEmail({
      ...payload(),
      ...(draftId ? { draftId } : {}),
      ...(seed.mode === "reply" || seed.mode === "replyAll"
        ? { replyToMessageId: seed.id }
        : {}),
      ...(scheduledAt
        ? { scheduledAt: new Date(scheduledAt).toISOString() }
        : {}),
    });
    setBusy("");
    if ("error" in result) return setFeedback(result.error);
    setDirty(false);
    onSent();
  }
  async function discard() {
    if (!draftId || !window.confirm("Discard this draft permanently?")) return;
    setBusy("discard");
    const result = await discardMailboxDraft(draftId);
    setBusy("");
    if ("error" in result)
      return setFeedback(result.error || "The draft could not be discarded.");
    setDirty(false);
    onClose();
  }
  function close() {
    if (dirty && !window.confirm("Close without saving your latest changes?"))
      return;
    onClose();
  }
  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className={styles.composer}
        role="dialog"
        aria-modal="true"
        aria-label="Email composer"
      >
        <header className={styles.composerHeader}>
          <div>
            <h2>
              {seed.mode === "reply"
                ? "Reply"
                : seed.mode === "replyAll"
                  ? "Reply all"
                  : seed.mode === "forward"
                    ? "Forward email"
                    : "New email"}
            </h2>
            <p>
              Assembled, validated, attached and sent by the Online2Day API.
            </p>
          </div>
          <button
            className={styles.iconButton}
            aria-label="Close composer"
            onClick={close}
          >
            <X size={16} />
          </button>
        </header>
        <div className={styles.composerBody}>
          <label className={styles.field}>
            <span>CRM LEAD</span>
            <select
              value={leadId}
              onChange={(event) => {
                const id = event.target.value;
                setLeadId(id);
                const lead = leads.find((item) => item.id === id);
                if (lead?.email && !to.length) setTo([lead.email]);
              }}
            >
              <option value="">Manual recipient</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} · {lead.company}
                </option>
              ))}
            </select>
          </label>
          <AddressChips label="To" values={to} onChange={setTo} />
          <div className={styles.addressTools}>
            <button onClick={() => setShowCopies((value) => !value)}>
              {showCopies ? "Hide CC/BCC" : "Add CC/BCC"}
            </button>
          </div>
          {showCopies ? (
            <>
              <AddressChips label="CC" values={cc} onChange={setCc} />
              <AddressChips label="BCC" values={bcc} onChange={setBcc} />
            </>
          ) : null}
          <label className={styles.field}>
            <span>SUBJECT</span>
            <input
              value={subject}
              maxLength={300}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="A clear, useful subject"
            />
          </label>
          <RichEditor
            value={html}
            onChange={setHtml}
            placeholder="Write your message…"
            minHeight="230px"
          />
          <div className={styles.options}>
            <label className={styles.field}>
              <span>PRIORITY</span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as typeof priority)
                }
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>SCHEDULE SEND</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={new Date(Date.now() + 120_000).toISOString().slice(0, 16)}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>EMAIL FOOTER</span>
              <input
                value={setupConfig?.companyName || "Online2Day"}
                readOnly
              />
            </label>
          </div>
          <div
            className={`${styles.dropzone} ${dragging ? styles.drag : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void attachFiles(event.dataTransfer.files);
            }}
          >
            <Paperclip size={20} />
            <div>
              <strong>Attach PDF</strong>
              <span>Drop here or choose a file · 25 MB maximum</span>
            </div>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(event) => {
                if (event.target.files) void attachFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              className={styles.action}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} /> Choose PDF
            </button>
          </div>
          {attachments.length ? (
            <div className={styles.uploadList}>
              {attachments.map((item) => (
                <div className={styles.uploadItem} key={item.id}>
                  <FileText size={16} />
                  <strong>{item.safe_filename}</strong>
                  {item.progress !== undefined && item.progress < 100 ? (
                    <div className={styles.uploadProgress}>
                      <div style={{ width: `${item.progress}%` }} />
                    </div>
                  ) : (
                    <span>{(item.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                  <button
                    className={styles.iconButton}
                    aria-label={`Remove ${item.safe_filename}`}
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((file) => file.id !== item.id),
                      )
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {feedback ? (
            <div
              className={`${styles.feedback} ${feedback.toLowerCase().includes("could not") || feedback.toLowerCase().includes("valid") ? styles.error : ""}`}
            >
              {feedback}
            </div>
          ) : null}
        </div>
        <footer className={styles.composerFooter}>
          <span>
            {dirty
              ? "Unsaved changes · drafts autosave after you pause"
              : draftId
                ? "Draft saved"
                : "Ready"}
          </span>
          <button
            className={styles.action}
            onClick={() => void saveDraft()}
            disabled={Boolean(busy)}
          >
            {busy === "draft" ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} />
            )}{" "}
            Save draft
          </button>
          {draftId ? (
            <button
              className={styles.action}
              onClick={() => void discard()}
              disabled={Boolean(busy)}
            >
              {busy === "discard" ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Trash2 size={14} />
              )}{" "}
              Discard
            </button>
          ) : null}
          <button
            className={styles.primary}
            onClick={() => void send()}
            disabled={
              Boolean(busy) ||
              !to.length ||
              !subject.trim() ||
              !plain.trim() ||
              attachments.some((item) => item.id.startsWith("upload-"))
            }
          >
            {busy === "send" ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Send size={14} />
            )}
            {scheduledAt ? "Schedule" : "Send"}
          </button>
        </footer>
      </section>
    </div>
  );
}

type PositionedField = {
  id: string;
  signerId: string;
  fieldType: "signature" | "date" | "name" | "text";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string;
};
type SignerDraft = { id: string; name: string; email: string };
function SignatureWorkspace({
  leads,
  onFeedback,
}: {
  leads: EmailComposerLead[];
  onFeedback: (message: string) => void;
}) {
  const [documents, setDocuments] = useState<PlatformDocumentDto[]>([]);
  const [requests, setRequests] = useState<SignatureRequestDto[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [title, setTitle] = useState("Please review and sign");
  const [message, setMessage] = useState(
    "Please review the document and complete the highlighted fields.",
  );
  const [signers, setSigners] = useState<SignerDraft[]>(() => [
    { id: crypto.randomUUID(), name: "", email: "" },
  ]);
  const [activeSignerId, setActiveSignerId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [page, setPage] = useState(1);
  const [fieldType, setFieldType] =
    useState<PositionedField["fieldType"]>("signature");
  const [fields, setFields] = useState<PositionedField[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = documents.find((item) => item.id === documentId);
  const refresh = useCallback(async () => {
    const [docs, sigs] = await Promise.all([
      listPlatformDocuments(),
      listSignatureRequests(),
    ]);
    if (!("error" in docs)) {
      setDocuments(docs);
      setDocumentId(
        (current) =>
          current ||
          docs.find((item) => item.document_kind !== "signature_completed")
            ?.id ||
          "",
      );
    }
    if (!("error" in sigs)) setRequests(sigs);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setPreviewUrl("");
    if (documentId) {
      void getPlatformDocumentDownload(documentId).then((result) => {
        if (!active) return;
        if ("error" in result) onFeedback(result.error);
        else setPreviewUrl(result.url);
      });
    }
    return () => {
      active = false;
    };
  }, [documentId, onFeedback]);

  const selectedSignerId = activeSignerId || signers[0]?.id || "";
  const activeSigner = signers.find((signer) => signer.id === selectedSignerId);
  function updateSigner(patch: Partial<Omit<SignerDraft, "id">>) {
    setSigners((current) =>
      current.map((signer) =>
        signer.id === selectedSignerId ? { ...signer, ...patch } : signer,
      ),
    );
  }
  function addSigner() {
    if (signers.length >= 20) return;
    const id = crypto.randomUUID();
    setSigners((current) => [...current, { id, name: "", email: "" }]);
    setActiveSignerId(id);
  }
  function removeSigner(id: string) {
    if (signers.length === 1) return;
    const next = signers.filter((signer) => signer.id !== id);
    setSigners(next);
    setFields((current) => current.filter((field) => field.signerId !== id));
    if (selectedSignerId === id) setActiveSignerId(next[0].id);
  }
  function place(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeSigner) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = fieldType === "signature" ? 0.32 : 0.23;
    const height = fieldType === "signature" ? 0.09 : 0.055;
    const x = Math.min(
      1 - width,
      Math.max(0, (event.clientX - bounds.left) / bounds.width - width / 2),
    );
    const y = Math.min(
      1 - height,
      Math.max(0, (event.clientY - bounds.top) / bounds.height - height / 2),
    );
    setFields((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        signerId: activeSigner.id,
        fieldType,
        pageNumber: page,
        x,
        y,
        width,
        height,
        required: true,
        label:
          fieldType === "signature"
            ? "Signature"
            : fieldType[0].toUpperCase() + fieldType.slice(1),
      },
    ]);
  }
  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const doc = await uploadPdf(
        file,
        "signature_original",
        null,
        () => undefined,
      );
      setDocuments((current) => [doc, ...current]);
      setDocumentId(doc.id);
      onFeedback("PDF validated and ready for field placement.");
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : "PDF upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function sendRequest() {
    if (!selected || !fields.length)
      return onFeedback("Select a PDF and position at least one field.");
    if (
      signers.some(
        (signer) => !signer.name.trim() || !/^\S+@\S+\.\S+$/.test(signer.email),
      )
    )
      return onFeedback("Add a valid name and email for every signer.");
    if (
      signers.some(
        (signer) => !fields.some((field) => field.signerId === signer.id),
      )
    )
      return onFeedback("Position at least one field for every signer.");
    setBusy(true);
    const result = await createNativeSignatureRequest({
      documentId: selected.id,
      title,
      message,
      recipients: signers.map((signer, index) => ({
        name: signer.name,
        email: signer.email,
        signingOrder: index + 1,
        fields: fields
          .filter((field) => field.signerId === signer.id)
          .map((field) => ({
            fieldType: field.fieldType,
            pageNumber: field.pageNumber,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required,
            label: field.label,
          })),
      })),
    });
    setBusy(false);
    if ("error" in result) return onFeedback(result.error);
    setFields([]);
    const id = crypto.randomUUID();
    setSigners([{ id, name: "", email: "" }]);
    setActiveSignerId(id);
    onFeedback("Secure signature request sent.");
    void refresh();
  }
  return (
    <div className={styles.signatureLayout}>
      <aside className={styles.signaturePanel}>
        <h3>Prepare a document</h3>
        <input
          ref={fileRef}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          className={styles.action}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={14} /> Upload PDF
        </button>
        <div className={styles.documentList}>
          {documents
            .filter((doc) => doc.document_kind !== "signature_completed")
            .map((doc) => (
              <button
                className={doc.id === documentId ? styles.selectedDoc : ""}
                key={doc.id}
                onClick={() => {
                  setDocumentId(doc.id);
                  setPage(1);
                  setFields([]);
                }}
              >
                {doc.safe_filename}
                <br />
                {doc.page_count} page{doc.page_count === 1 ? "" : "s"} ·{" "}
                {(doc.size_bytes / 1024 / 1024).toFixed(1)} MB
              </button>
            ))}
        </div>
        <div className={styles.signerHeader}>
          <strong>Signers</strong>
          <button className={styles.action} type="button" onClick={addSigner}>
            <Plus size={13} /> Add signer
          </button>
        </div>
        <div className={styles.signerTabs}>
          {signers.map((signer, index) => (
            <button
              key={signer.id}
              type="button"
              className={
                signer.id === selectedSignerId ? styles.activeSigner : ""
              }
              onClick={() => setActiveSignerId(signer.id)}
            >
              <span>{index + 1}</span>
              {signer.name || signer.email || `Signer ${index + 1}`}
              {signers.length > 1 ? (
                <X
                  size={12}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSigner(signer.id);
                  }}
                />
              ) : null}
            </button>
          ))}
        </div>
        <label>
          Signer name
          <input
            value={activeSigner?.name || ""}
            onChange={(event) => updateSigner({ name: event.target.value })}
          />
        </label>
        <label>
          Signer email
          <select
            value={activeSigner?.email || ""}
            onChange={(event) => {
              updateSigner({ email: event.target.value });
              const lead = leads.find(
                (item) => item.email === event.target.value,
              );
              if (lead) updateSigner({ name: lead.name });
            }}
          >
            <option value="">Select or type below</option>
            {leads
              .filter((lead) => lead.email)
              .map((lead) => (
                <option key={lead.id} value={lead.email}>
                  {lead.name} · {lead.email}
                </option>
              ))}
          </select>
          <input
            type="email"
            value={activeSigner?.email || ""}
            onChange={(event) => updateSigner({ email: event.target.value })}
            placeholder="signer@company.com"
          />
        </label>
        <label>
          Request title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Message
          <textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <label>
          Field type
          <select
            value={fieldType}
            onChange={(event) =>
              setFieldType(event.target.value as PositionedField["fieldType"])
            }
          >
            <option value="signature">Signature</option>
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label>
          PDF page
          <input
            type="number"
            min={1}
            max={selected?.page_count || 1}
            value={page}
            onChange={(event) =>
              setPage(
                Math.max(
                  1,
                  Math.min(
                    selected?.page_count || 1,
                    Number(event.target.value),
                  ),
                ),
              )
            }
          />
        </label>
        <button
          className={styles.primary}
          disabled={
            busy ||
            !selected ||
            signers.some((signer) => !signer.name || !signer.email) ||
            !fields.length
          }
          onClick={() => void sendRequest()}
        >
          {busy ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Send size={14} />
          )}{" "}
          Send request
        </button>
      </aside>
      <main>
        <div className={styles.pageToolbar}>
          <span>
            Page {page} of {selected?.page_count || 1}
          </span>
          <span>
            Assigning fields to{" "}
            {activeSigner?.name || activeSigner?.email || "the selected signer"}
          </span>
        </div>
        <div
          className={`${styles.pageSurface} ${previewUrl ? "" : styles.emptyPage}`}
          onClick={place}
          aria-label={`Position fields on PDF page ${page}`}
        >
          {previewUrl ? (
            <iframe
              title={`Preview ${selected?.safe_filename || "document"}`}
              src={`${previewUrl}#page=${page}&toolbar=0&navpanes=0&scrollbar=0`}
            />
          ) : null}
          {fields
            .filter((field) => field.pageNumber === page)
            .map((field) => (
              <button
                key={field.id}
                className={styles.sigField}
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setFields((current) =>
                    current.filter((item) => item.id !== field.id),
                  );
                }}
              >
                {field.label} · signer{" "}
                {signers.findIndex((signer) => signer.id === field.signerId) +
                  1}{" "}
                · click to remove
              </button>
            ))}
        </div>
        <div className={styles.requestList} style={{ marginTop: 14 }}>
          {requests.map((request) => (
            <article className={styles.requestCard} key={request.id}>
              <div>
                <strong>{request.title}</strong>
                <span className={styles.status}>
                  {request.status.replace("_", " ")}
                </span>
              </div>
              <p>
                {request.document.safe_filename} ·{" "}
                {request.recipients
                  .map((item) => `${item.name} (${item.status})`)
                  .join(", ")}
              </p>
              {["sent", "viewed", "partially_signed"].includes(
                request.status,
              ) ? (
                <button
                  className={styles.action}
                  onClick={async () => {
                    const result = await cancelNativeSignatureRequest(
                      request.id,
                    );
                    if ("error" in result) onFeedback(result.error);
                    else {
                      onFeedback("Signature request cancelled.");
                      void refresh();
                    }
                  }}
                >
                  Cancel request
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
