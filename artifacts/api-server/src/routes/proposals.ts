import { Router, type IRouter } from "express";
import { db, proposalSubmissionsTable } from "@workspace/db";
import { SubmitProposalBody, SubmitProposalResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const rateLimitWindowMs = 15 * 60 * 1000;
const maxSubmissionsPerWindow = 5;
const submissionWindows = new Map<string, { count: number; startedAt: number }>();

function hasValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const digitFor = (base: string, weights: number[]): number => {
    const total = [...base].reduce(
      (sum, digit, index) => sum + Number(digit) * weights[index],
      0,
    );
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = digitFor(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitFor(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}

function hasValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) return false;
  const areaCode = Number(digits.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) return false;
  return digits.length === 11 ? digits[2] === "9" : /^[2-5]/.test(digits.slice(2));
}

router.post("/proposals", async (req, res): Promise<void> => {
  const honeypot = typeof req.body?.website === "string" ? req.body.website.trim() : "";
  if (honeypot) {
    res.status(201).json({ received: true });
    return;
  }

  const parsed = SubmitProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Confira os campos obrigatórios e os formatos informados." });
    return;
  }

  const cnpj = parsed.data.cnpj?.trim() ?? "";
  if (cnpj && !hasValidCnpj(cnpj)) {
    res.status(400).json({ error: "Informe um CNPJ válido." });
    return;
  }

  if (!hasValidBrazilianPhone(parsed.data.phone)) {
    res.status(400).json({ error: "Informe um telefone brasileiro válido com DDD." });
    return;
  }

  const now = Date.now();
  const key = req.ip ?? "unknown";
  const currentWindow = submissionWindows.get(key);
  if (!currentWindow || now - currentWindow.startedAt >= rateLimitWindowMs) {
    submissionWindows.set(key, { count: 1, startedAt: now });
  } else if (currentWindow.count >= maxSubmissionsPerWindow) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return;
  } else {
    currentWindow.count += 1;
  }

  await db.insert(proposalSubmissionsTable).values({
    companyName: parsed.data.companyName.trim(),
    cnpj: cnpj || null,
    contactName: parsed.data.contactName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    phone: parsed.data.phone.trim(),
    employeeCount: parsed.data.employeeCount,
    message: parsed.data.message.trim(),
  });

  req.log.info({ event: "proposal_submission_saved" }, "Proposal submission saved");
  res.status(201).json(SubmitProposalResponse.parse({ received: true }));
});

export default router;
