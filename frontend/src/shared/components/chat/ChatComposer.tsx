import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Send, X } from "lucide-react";
import { Button } from "@shared/ui/Button";
import { fileToCompressedDataUri } from "@shared/lib/imageUtils";

/** One upload experience for customers, support staff and private staff chats. */
export function ChatComposer({ onSend, disabled = false, placeholder = "Type your message…", sendLabel = "Send" }: {
  onSend: (text: string, image?: string) => Promise<unknown>;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
}) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const choose = (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) {
      setError("Choose a photo up to 25 MB.");
      return;
    }
    setPhoto(file);
  };

  const submit = async () => {
    if (disabled || lock.current || (!text.trim() && !photo)) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      let image: string | undefined;
      if (photo) {
        try {
          image = await fileToCompressedDataUri(photo, 1600, 0.8, 800 * 1024);
        } catch {
          throw new Error("This photo could not be opened. Choose another photo or take a new one.");
        }
      }
      await onSend(text.trim(), image);
      setText("");
      setPhoto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message not sent. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {photo && (
        <div className="mb-2 flex justify-end" data-testid="pending-photo">
          <div className="relative max-w-[75%] rounded-2xl bg-primary/10 p-2">
            <img src={preview} alt="Selected photo" className="max-h-40 max-w-full rounded-xl object-contain" />
            {text && pending && <p className="mt-1 break-words text-sm text-ink">{text}</p>}
            <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted" role="status">
              {pending ? <><Loader2 className="size-3 animate-spin" /> Uploading…</> : "Ready to send"}
            </div>
            {!pending && <button type="button" className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-ink/80 text-white" onClick={() => setPhoto(null)} aria-label="Remove photo"><X className="size-4" /></button>}
          </div>
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-600" role="alert">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex items-end gap-1.5">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take photo" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={library} type="file" accept="image/*" className="hidden" aria-label="Choose photo" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <Button type="button" variant="ghost" className="size-11 shrink-0 p-0" disabled={disabled || pending} onClick={() => camera.current?.click()} aria-label="Camera"><Camera className="size-5" /></Button>
        <Button type="button" variant="ghost" className="size-11 shrink-0 p-0" disabled={disabled || pending} onClick={() => library.current?.click()} aria-label="Attach photo"><ImagePlus className="size-5" /></Button>
        <textarea aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={1} disabled={disabled || pending} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface-muted/30 px-3 py-2.5 text-base text-ink outline-none focus:border-primary/50 disabled:opacity-60 sm:text-sm" />
        <Button type="submit" className="size-11 shrink-0 rounded-2xl p-0" disabled={disabled || pending || (!text.trim() && !photo)} aria-label={sendLabel}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
