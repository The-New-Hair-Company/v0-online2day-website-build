"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  completePublicSignature,
  declinePublicSignature,
  markPublicSignatureViewed,
  type PublicSignatureEnvelope,
} from "@/lib/actions/signature-public-actions";
import styles from "./signature.module.css";

type SignatureMethod = "typed" | "drawn" | "uploaded";
export function SignatureClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicSignatureEnvelope | { error: string };
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<Record<string, SignatureMethod>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState(false);
  const envelope = "error" in initial ? null : initial;
  useEffect(() => {
    if (envelope) {
      const defaults: Record<string, string> = {};
      const initialMethods: Record<string, SignatureMethod> = {};
      envelope.fields.forEach((field) => {
        if (field.field_type === "name")
          defaults[field.id] = envelope.recipient.name;
        if (field.field_type === "date")
          defaults[field.id] = new Date().toLocaleDateString("en-GB");
        if (field.field_type === "signature")
          initialMethods[field.id] = "typed";
      });
      setValues(defaults);
      setMethods(initialMethods);
      void markPublicSignatureViewed(token);
    }
  }, [envelope, token]);
  if (!envelope)
    return (
      <main className={styles.complete}>
        <div>
          <h1>Signing request unavailable</h1>
          <p>
            {"error" in initial
              ? initial.error
              : "This signing request is unavailable."}
          </p>
        </div>
      </main>
    );
  const safeEnvelope = envelope;
  if (complete)
    return (
      <main className={styles.complete}>
        <div>
          <CheckCircle2 size={42} />
          <h1>Document signed</h1>
          <p>
            Your fields were recorded securely. Online2Day preserved the
            original PDF and created a separately hashed completed copy with an
            audit record.
          </p>
        </div>
      </main>
    );
  async function submit() {
    const missing = safeEnvelope.fields.find(
      (field) => field.required && !values[field.id]?.trim(),
    );
    if (missing)
      return setFeedback(
        `Complete the ${missing.label || missing.field_type} field.`,
      );
    setBusy(true);
    setFeedback("");
    const result = await completePublicSignature(
      token,
      safeEnvelope.fields.map((field) => ({
        id: field.id,
        value: values[field.id] || "",
        signatureMethod:
          field.field_type === "signature"
            ? methods[field.id] || "typed"
            : null,
      })),
    );
    setBusy(false);
    if ("error" in result) return setFeedback(result.error);
    setComplete(true);
  }
  async function decline() {
    const reason =
      window.prompt("Optional reason for declining this request:") ?? null;
    if (reason === null) return;
    if (!window.confirm("Decline this signature request?")) return;
    setBusy(true);
    const result = await declinePublicSignature(token, reason);
    setBusy(false);
    if ("error" in result) return setFeedback(result.error);
    setFeedback(
      "You declined this signing request. This page may now be closed.",
    );
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <strong>Online2Day</strong>
          <span>Secure document review</span>
        </div>
        <span className={styles.secure}>
          <ShieldCheck size={14} /> Private expiring signing session
        </span>
      </header>
      <div className={styles.layout}>
        <section className={styles.document}>
          <iframe
            title={envelope.document.filename}
            src={envelope.document.url}
          />
        </section>
        <aside className={styles.panel}>
          <h1>{envelope.request.title}</h1>
          <p>{envelope.request.message}</p>
          <div className={styles.meta}>
            <strong>{envelope.document.filename}</strong>
            <span>
              {envelope.document.pageCount} page
              {envelope.document.pageCount === 1 ? "" : "s"} · expires{" "}
              {new Date(envelope.request.expiresAt).toLocaleString("en-GB")}
            </span>
            <span>
              Signer: {envelope.recipient.name} · {envelope.recipient.email}
            </span>
          </div>
          <div className={styles.fields}>
            {envelope.fields.map((field) => (
              <SignatureField
                key={field.id}
                field={field}
                recipientName={envelope.recipient.name}
                value={values[field.id] || ""}
                method={methods[field.id] || "typed"}
                onMethod={(method) =>
                  setMethods((current) => ({ ...current, [field.id]: method }))
                }
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.id]: value }))
                }
              />
            ))}
          </div>
          {feedback ? (
            <div className={`${styles.notice} ${styles.error}`} role="alert">
              {feedback}
            </div>
          ) : null}
          <button
            className={styles.submit}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}{" "}
            Agree and complete signing
          </button>
          <button
            className={styles.decline}
            onClick={() => void decline()}
            disabled={busy}
          >
            Decline request
          </button>
          <div className={styles.notice}>
            Completing records your submitted fields, timestamp and security
            audit metadata. It does not make a claim about a particular legal
            status.
          </div>
        </aside>
      </div>
    </main>
  );
}

function SignatureField({
  field,
  recipientName,
  value,
  method,
  onMethod,
  onChange,
}: {
  field: PublicSignatureEnvelope["fields"][number];
  recipientName: string;
  value: string;
  method: SignatureMethod;
  onMethod: (method: SignatureMethod) => void;
  onChange: (value: string) => void;
}) {
  if (field.field_type !== "signature")
    return (
      <label className={styles.field}>
        <span>
          {(field.label || field.field_type).toUpperCase()} · PAGE{" "}
          {field.page_number}
        </span>
        {field.field_type === "text" ? (
          <textarea
            rows={3}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </label>
    );
  return (
    <div className={styles.field}>
      <span>
        {(field.label || "SIGNATURE").toUpperCase()} · PAGE {field.page_number}
      </span>
      <div className={styles.methods}>
        <button
          className={method === "typed" ? styles.active : ""}
          onClick={() => {
            onMethod("typed");
            onChange(recipientName);
          }}
        >
          Type
        </button>
        <button
          className={method === "drawn" ? styles.active : ""}
          onClick={() => {
            onMethod("drawn");
            onChange("");
          }}
        >
          Draw
        </button>
        <button
          className={method === "uploaded" ? styles.active : ""}
          onClick={() => {
            onMethod("uploaded");
            onChange("");
          }}
        >
          Upload
        </button>
      </div>
      {method === "typed" ? (
        <input
          aria-label="Typed signature"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={recipientName}
          style={{ fontFamily: "cursive", fontSize: 22 }}
        />
      ) : method === "drawn" ? (
        <DrawSignature value={value} onChange={onChange} />
      ) : (
        <label className={styles.upload}>
          Upload a PNG signature image (maximum 2 MB)
          <input
            type="file"
            accept="image/png"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (
                !file ||
                file.type !== "image/png" ||
                file.size > 2 * 1024 * 1024
              )
                return;
              const reader = new FileReader();
              reader.onload = () => onChange(String(reader.result || ""));
              reader.readAsDataURL(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

function DrawSignature({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = bounds.width * ratio;
    canvas.height = bounds.height * ratio;
    const context = canvas.getContext("2d");
    context?.scale(ratio, ratio);
    if (context) {
      context.strokeStyle = "#111827";
      context.lineWidth = 2.2;
      context.lineCap = "round";
    }
    if (value) {
      const image = new Image();
      image.onload = () =>
        context?.drawImage(image, 0, 0, bounds.width, bounds.height);
      image.src = value;
    }
  }, [value]);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  return (
    <canvas
      ref={ref}
      className={styles.canvas}
      onPointerDown={(event) => {
        drawing.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const context = event.currentTarget.getContext("2d");
        const next = point(event);
        context?.beginPath();
        context?.moveTo(next.x, next.y);
      }}
      onPointerMove={(event) => {
        if (!drawing.current) return;
        const next = point(event);
        const context = event.currentTarget.getContext("2d");
        context?.lineTo(next.x, next.y);
        context?.stroke();
      }}
      onPointerUp={(event) => {
        drawing.current = false;
        onChange(event.currentTarget.toDataURL("image/png"));
      }}
    />
  );
}
