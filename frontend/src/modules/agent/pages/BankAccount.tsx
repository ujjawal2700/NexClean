import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Landmark, Loader2, CheckCircle2, ShieldCheck, Pencil } from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { ApiError } from "@shared/lib/api";
import { useBankAccount, useSaveBankAccount, lookupIfsc } from "../api/agent.api";
import type { IfscBranch } from "../types";

type Draft = {
  holderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
};

const EMPTY: Draft = { holderName: "", bankName: "", accountNumber: "", confirmAccountNumber: "", ifsc: "" };

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function BankAccount() {
  const navigate = useNavigate();
  const { data: account, isLoading } = useBankAccount();
  const save = useSaveBankAccount();

  // A saved account shows as a summary card by default; "Change details"
  // opens the form again. A first-time save goes straight to the summary.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // IFSC live lookup: resolved branch is what actually gets saved (see
  // bankAccount.service.ts — the server re-resolves it anyway), this is only
  // to show the agent what they're about to save before they save it.
  const [branch, setBranch] = useState<IfscBranch | null>(null);
  const [ifscError, setIfscError] = useState("");
  const [checkingIfsc, setCheckingIfsc] = useState(false);
  const lookupToken = useRef(0);

  useEffect(() => {
    const code = draft.ifsc.trim().toUpperCase();
    setBranch(null);
    setIfscError("");
    if (!IFSC_RE.test(code)) return;

    const token = ++lookupToken.current;
    setCheckingIfsc(true);
    const timer = setTimeout(() => {
      lookupIfsc(code)
        .then((b) => {
          if (lookupToken.current !== token) return; // a newer keystroke has already superseded this lookup
          setBranch(b);
        })
        .catch((e: unknown) => {
          if (lookupToken.current !== token) return;
          setIfscError(e instanceof ApiError ? e.message : "Couldn't verify that IFSC code");
        })
        .finally(() => {
          if (lookupToken.current === token) setCheckingIfsc(false);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.ifsc]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const accountMismatch =
    draft.confirmAccountNumber.length > 0 && draft.accountNumber !== draft.confirmAccountNumber;
  const canSubmit =
    draft.holderName.trim().length >= 2 &&
    draft.bankName.trim().length >= 2 &&
    /^\d{9,18}$/.test(draft.accountNumber) &&
    !accountMismatch &&
    !!branch &&
    !checkingIfsc;

  const startEditing = () => {
    setDraft(
      account
        ? { holderName: account.holderName, bankName: account.bankName, accountNumber: "", confirmAccountNumber: "", ifsc: account.ifsc }
        : EMPTY,
    );
    setError("");
    setSaved(false);
    setEditing(true);
  };

  const submit = () => {
    setError("");
    save.mutate(draft, {
      onSuccess: () => {
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save your bank account"),
    });
  };

  const showForm = editing || (!isLoading && !account);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-9 rounded-xl border border-line bg-surface text-ink-soft hover:text-primary transition-colors cursor-pointer shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Bank Account</h1>
      </div>

      <GlassCard className="flex items-start gap-3 text-sm text-muted">
        <Landmark className="mt-0.5 size-4.5 shrink-0 text-primary" />
        <p>
          This is where your payout requests get paid to. Branch and address are looked up automatically from your
          IFSC code — you only need to enter the code itself.
        </p>
      </GlassCard>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" /> Bank account saved.
        </div>
      )}

      {isLoading ? (
        <GlassCard className="py-10 text-center text-muted">Loading…</GlassCard>
      ) : !showForm && account ? (
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Landmark className="size-5" />
              </span>
              <div>
                <p className="font-display font-semibold text-ink">{account.bankName}</p>
                <p className="text-sm text-muted">{account.holderName}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="size-4" /> Change
            </Button>
          </div>

          <div className="grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
            <Field label="Account number" value={`••••••${account.accountNumber.slice(-4)}`} />
            <Field label="IFSC" value={account.ifsc} />
            <Field label="Branch" value={account.branch} />
            <Field label="Address" value={account.address} />
          </div>

          <p className="flex items-center gap-1.5 border-t border-line pt-3 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-emerald-500" /> Verified against the IFSC master when saved.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="space-y-4">
          <Input
            label="Account holder name"
            name="holderName"
            placeholder="As it appears on the bank account"
            value={draft.holderName}
            onChange={(e) => patch({ holderName: e.target.value })}
          />
          <Input
            label="Bank name"
            name="bankName"
            placeholder="e.g. HDFC Bank"
            value={draft.bankName}
            onChange={(e) => patch({ bankName: e.target.value })}
          />
          <Input
            label="Account number"
            name="accountNumber"
            inputMode="numeric"
            placeholder="9–18 digit account number"
            value={draft.accountNumber}
            onChange={(e) => patch({ accountNumber: e.target.value.replace(/\D/g, "") })}
          />
          <Input
            label="Confirm account number"
            name="confirmAccountNumber"
            inputMode="numeric"
            placeholder="Re-enter the account number"
            value={draft.confirmAccountNumber}
            onChange={(e) => patch({ confirmAccountNumber: e.target.value.replace(/\D/g, "") })}
            error={accountMismatch ? "Account numbers don't match" : undefined}
          />
          <Input
            label="IFSC code"
            name="ifsc"
            placeholder="e.g. HDFC0001234"
            value={draft.ifsc}
            onChange={(e) => patch({ ifsc: e.target.value.toUpperCase() })}
            error={ifscError || undefined}
            hint={!ifscError && !branch ? "11 characters — the branch and address fill in automatically." : undefined}
            trailing={checkingIfsc ? <Loader2 className="size-4 animate-spin" /> : undefined}
            maxLength={11}
          />

          {branch && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="size-4" /> {branch.bank}
              </p>
              <p className="mt-1 text-ink-soft">{branch.branch}</p>
              <p className="text-xs text-muted">{branch.address}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            {account && (
              <Button variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
                Cancel
              </Button>
            )}
            <Button onClick={submit} disabled={!canSubmit || save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save bank account"}
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-medium text-ink">{value}</p>
    </div>
  );
}
