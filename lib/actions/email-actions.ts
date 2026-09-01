"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailWorkspaceApi } from "@/lib/api/client";
import { z } from "zod";

type SendEnterpriseEmailInput = {
  leadId?: string;
  to: string;
  recipientName?: string;
  subject: string;
  body: string;
  templateId?: string;
  templateName?: string;
  videoAssetId?: string;
  videoSlug?: string;
  ctaLabel?: string;
};

async function getToken() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function sendEnterpriseEmail(input: SendEnterpriseEmailInput) {
  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { error: "Enter a valid recipient email address." };
  }

  if (!input.subject.trim() || !input.body.trim()) {
    return { error: "Subject and message body are required." };
  }
  if (input.subject.trim().length > 180)
    return { error: "Keep the subject under 180 characters." };
  if (input.body.trim().length > 20_000)
    return { error: "Keep the message under 20,000 characters." };

  const token = await getToken();
  if (!token)
    return { error: "Your session has expired. Sign in and try again." };
  try {
    const result = await emailWorkspaceApi.sendEmail(token, {
      leadId: input.leadId || null,
      templateId: input.templateId || null,
      to,
      recipientName: input.recipientName,
      subject: input.subject.trim(),
      body: input.body.trim(),
      templateName: input.templateName,
      videoAssetId: input.videoAssetId,
      videoSlug: input.videoSlug,
      ctaLabel: input.ctaLabel,
      idempotencyKey: crypto.randomUUID(),
    });
    if (input.leadId) revalidatePath(`/dashboard/leads/${input.leadId}`);
    revalidatePath("/dashboard/emails");
    return { success: true, id: result.id, warning: result.warning };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The Online2Day API could not deliver the email.",
    };
  }
}

type EmailTemplateInput = {
  name: string;
  subject: string;
  body: string;
  category?: string;
  audience?: string;
  stage?: string;
  ctaLabel?: string;
};

function validateTemplate(input: EmailTemplateInput) {
  if (!input.name.trim()) return "Template name is required.";
  if (!input.subject.trim()) return "Subject is required.";
  if (!input.body.trim()) return "Message body is required.";
  if (input.name.trim().length > 120)
    return "Keep the template name under 120 characters.";
  if (input.subject.trim().length > 180)
    return "Keep the subject under 180 characters.";
  if (input.body.trim().length > 20_000)
    return "Keep the message under 20,000 characters.";
  return null;
}

export async function createEmailTemplate(input: EmailTemplateInput) {
  const validation = validateTemplate(input);
  if (validation) return { error: validation };
  const token = await getToken();
  if (!token)
    return { error: "Your session has expired. Sign in and try again." };
  try {
    const template = await emailWorkspaceApi.createTemplate(token, input);
    revalidatePath("/dashboard/emails");
    return { success: true, template };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Template could not be created.",
    };
  }
}

export async function updateEmailTemplate(
  id: string,
  input: EmailTemplateInput,
) {
  if (!id) return { error: "Template is required." };
  const validation = validateTemplate(input);
  if (validation) return { error: validation };
  const token = await getToken();
  if (!token)
    return { error: "Your session has expired. Sign in and try again." };
  try {
    const template = await emailWorkspaceApi.updateTemplate(token, id, input);
    revalidatePath("/dashboard/emails");
    return { success: true, template };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Template could not be updated.",
    };
  }
}

export async function deleteEmailTemplate(id: string) {
  if (!id) return { error: "Template is required." };
  const token = await getToken();
  if (!token)
    return { error: "Your session has expired. Sign in and try again." };
  try {
    await emailWorkspaceApi.deleteTemplate(token, id);
    revalidatePath("/dashboard/emails");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Template could not be deleted.",
    };
  }
}

export async function sendVideoFollowUpEmail(
  leadId: string,
  email: string,
  name: string,
  videoSlug: string,
) {
  try {
    const result = await sendEnterpriseEmail({
      leadId,
      to: email,
      recipientName: name,
      subject: "Your personalised video from Online2Day",
      body: "I recorded a short personalised video for you.\n\nHave a look when you get a moment, and reply with any questions.",
      templateName: "Video Follow-up",
      videoSlug,
      ctaLabel: "Watch video",
    });

    return result;
  } catch (error) {
    return { error: "Failed to send email" };
  }
}

const mailboxAddress = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const mailboxDraftSchema = z.object({
  id: z.string().uuid().optional(),
  leadId: z.string().uuid().nullable().optional(),
  threadId: z.string().uuid().nullable().optional(),
  to: z.array(mailboxAddress).max(50),
  cc: z.array(mailboxAddress).max(50),
  bcc: z.array(mailboxAddress).max(50),
  subject: z.string().max(300),
  htmlBody: z.string().max(100_000),
  plainBody: z.string().max(50_000),
  priority: z.enum(["low", "normal", "high"]),
  attachmentIds: z.array(z.string().uuid()).max(20),
});
const mailboxSendSchema = mailboxDraftSchema.omit({ id: true }).extend({
  draftId: z.string().uuid().optional(),
  replyToMessageId: z.string().uuid().optional(),
  to: z.array(mailboxAddress).min(1).max(50),
  subject: z.string().trim().min(1).max(300),
  htmlBody: z.string().min(1).max(100_000),
  scheduledAt: z.string().datetime().optional(),
});

async function withMailboxToken<T>(work: (token: string) => Promise<T>) {
  const token = await getToken();
  if (!token)
    throw new Error("Your session has expired. Sign in and try again.");
  return work(token);
}

export async function loadMailbox(
  folder: "inbox" | "sent" | "drafts" | "trash" | "archive" = "inbox",
) {
  try {
    return await withMailboxToken((token) =>
      emailWorkspaceApi.mailbox(token, folder),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The mailbox could not be loaded.",
    };
  }
}

export async function sendMailboxEmail(
  input: z.infer<typeof mailboxSendSchema>,
) {
  const parsed = mailboxSendSchema.safeParse(input);
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ||
        "Check the message fields and recipients.",
    };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.sendMailbox(token, {
        ...parsed.data,
        idempotencyKey: crypto.randomUUID(),
      }),
    );
    revalidatePath("/dashboard/emails");
    revalidatePath("/dashboard/overview");
    if (parsed.data.leadId)
      revalidatePath(`/dashboard/leads/${parsed.data.leadId}`);
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "The email could not be sent.",
    };
  }
}

export async function saveMailboxDraft(
  input: z.infer<typeof mailboxDraftSchema>,
) {
  const parsed = mailboxDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message || "The draft contains invalid fields.",
    };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.saveDraft(token, parsed.data),
    );
    revalidatePath("/dashboard/emails");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The draft could not be saved.",
    };
  }
}

export async function setMailboxReadState(id: string, read: boolean) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid email." };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.markRead(token, id, read),
    );
    revalidatePath("/dashboard/emails");
    revalidatePath("/dashboard/overview");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The read state could not be updated.",
    };
  }
}

export async function trashMailboxEmail(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid email." };
  try {
    await withMailboxToken((token) => emailWorkspaceApi.trash(token, id));
    revalidatePath("/dashboard/emails");
    revalidatePath("/dashboard/overview");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The email could not be moved to trash.",
    };
  }
}

export async function restoreMailboxEmail(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid email." };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.restore(token, id),
    );
    revalidatePath("/dashboard/emails");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The email could not be restored.",
    };
  }
}

export async function permanentlyDeleteMailboxEmail(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid email." };
  try {
    await withMailboxToken((token) =>
      emailWorkspaceApi.permanentDelete(token, id),
    );
    revalidatePath("/dashboard/emails");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The email could not be permanently deleted.",
    };
  }
}

export async function discardMailboxDraft(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid draft." };
  try {
    await withMailboxToken(async (token) => {
      await emailWorkspaceApi.trash(token, id);
      await emailWorkspaceApi.permanentDelete(token, id);
    });
    revalidatePath("/dashboard/emails");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The draft could not be discarded.",
    };
  }
}

const documentInput = z.object({
  filename: z.string().trim().min(1).max(240),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  kind: z.enum(["attachment", "signature_original"]),
});
export async function createPdfUpload(input: z.infer<typeof documentInput>) {
  const parsed = documentInput.safeParse(input);
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message || "Choose a valid PDF up to 25 MB.",
    };
  try {
    return await withMailboxToken((token) =>
      emailWorkspaceApi.createDocumentUpload(token, parsed.data),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The PDF upload could not be started.",
    };
  }
}

export async function completePdfUpload(
  input: z.infer<typeof documentInput> & {
    storagePath: string;
    leadId?: string | null;
  },
) {
  const parsed = documentInput
    .extend({
      storagePath: z.string().min(1).max(700),
      leadId: z.string().uuid().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "The PDF upload is invalid.",
    };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.registerDocument(token, parsed.data),
    );
    revalidatePath("/dashboard/emails");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The PDF could not be validated.",
    };
  }
}

export async function listPlatformDocuments() {
  try {
    return await withMailboxToken((token) =>
      emailWorkspaceApi.documents(token),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Documents could not be loaded.",
    };
  }
}

export async function getPlatformDocumentDownload(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid document." };
  try {
    return await withMailboxToken((token) =>
      emailWorkspaceApi.documentDownload(token, id),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The secure download could not be created.",
    };
  }
}

const signatureRequestSchema = z.object({
  documentId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(180),
  message: z.string().max(5_000),
  expiresAt: z.string().datetime().optional(),
  recipients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        email: mailboxAddress,
        signingOrder: z.number().int().min(1).max(100),
        fields: z
          .array(
            z.object({
              fieldType: z.enum(["signature", "date", "name", "text"]),
              pageNumber: z.number().int().min(1).max(2_000),
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
              width: z.number().positive().max(1),
              height: z.number().positive().max(1),
              required: z.boolean(),
              label: z.string().max(120),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .min(1)
    .max(20),
});

export async function listSignatureRequests() {
  try {
    return await withMailboxToken((token) =>
      emailWorkspaceApi.signatureRequests(token),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Signature requests could not be loaded.",
    };
  }
}

export async function createNativeSignatureRequest(
  input: z.infer<typeof signatureRequestSchema>,
) {
  const parsed = signatureRequestSchema.safeParse(input);
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ||
        "Check the signature request fields.",
    };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.createSignatureRequest(token, parsed.data),
    );
    revalidatePath("/dashboard/emails");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The signature request could not be sent.",
    };
  }
}

export async function cancelNativeSignatureRequest(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    return { error: "Invalid signature request." };
  try {
    const result = await withMailboxToken((token) =>
      emailWorkspaceApi.cancelSignatureRequest(token, id),
    );
    revalidatePath("/dashboard/emails");
    return result;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The signature request could not be cancelled.",
    };
  }
}
