"use client";

import * as React from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { LIMITS, VARIANT_KEYS, type CardLanguage, type LanguageValue, type LogoValue } from "@/features/decks/fields";
import { safeImageSrc } from "@/features/decks/image";
import type { VersionValue, WizardForm } from "@/features/decks/wizard";
import { cn } from "@/shared/lib/utils";
import { errorFor } from "./api";
import { readLogo, readScreenshot } from "./image-upload";
import { ErrorText, FieldLabel, TextArea, TextInput } from "./primitives";
import type { FieldError } from "@/features/decks/types";

interface EditorProps {
  form: WizardForm;
  errors: FieldError[];
  onVersion: (index: number, value: VersionValue) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

/** Green letter badge A / B / C / D. */
export function VariantBadge({ index, className }: { index: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold text-accent-foreground", className)}>
      {VARIANT_KEYS[index]}
    </span>
  );
}

function RemoveButton({ index, onRemove, show }: { index: number; onRemove: (i: number) => void; show: boolean }) {
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label={`Remove version ${VARIANT_KEYS[index]}`}
      onClick={() => onRemove(index)}
      className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="size-4" />
    </button>
  );
}

/** Headline, description, reward and price versions: one text box each. */
export function TextVersions({ form, errors, onVersion, onRemove, canRemove }: EditorProps) {
  const long = form.variable === "description";
  const placeholder: Record<string, string> = {
    headline: "Stop chasing payments. Get paid on time.",
    description: "Say who bought on credit and Voice Khata records it…",
    reward: "Get 3 months free at launch",
    price: form.priceMode === "framing" ? "Rs 10 a day" : "Rs 199 / mo",
  };
  return (
    <ul className="space-y-3">
      {form.versions.map((v, i) => {
        const message = errorFor(errors, `cards.${i}`);
        const Input = long ? TextArea : TextInput;
        return (
          <li key={i}>
            <div className="flex items-start gap-3">
              <VariantBadge index={i} className="mt-1" />
              <div className="min-w-0 flex-1">
                <Input
                  aria-label={`Version ${VARIANT_KEYS[i]}`}
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => onVersion(i, e.target.value)}
                  placeholder={placeholder[form.variable]}
                  maxLength={form.variable === "headline" ? LIMITS.headline : form.variable === "description" ? LIMITS.description : form.variable === "reward" ? LIMITS.reward : LIMITS.price}
                />
                <ErrorText message={message} />
              </div>
              <RemoveButton index={i} onRemove={onRemove} show={canRemove} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Product UI: each version is a set of up to 5 screenshots. */
export function ScreenshotVersions({ form, errors, onVersion, onRemove, canRemove }: EditorProps) {
  const [uploadError, setUploadError] = React.useState<string>();
  return (
    <ul className="space-y-4">
      {form.versions.map((v, i) => {
        const shots = Array.isArray(v) ? v : [];
        return (
          <li key={i}>
            <div className="flex items-start gap-3">
              <VariantBadge index={i} />
              <div className="min-w-0 flex-1">
                <ScreenshotSlots
                  label={`Version ${VARIANT_KEYS[i]} screenshots`}
                  images={shots}
                  onChange={(next) => onVersion(i, next)}
                  onError={setUploadError}
                />
                <ErrorText message={errorFor(errors, `cards.${i}`)} />
              </div>
              <RemoveButton index={i} onRemove={onRemove} show={canRemove} />
            </div>
          </li>
        );
      })}
      <ErrorText message={uploadError} />
    </ul>
  );
}

/** Row of image slots with "+ Add" tiles (design 07 "Product UI · Optional · up to 5"). */
export function ScreenshotSlots({
  label,
  images,
  onChange,
  onError,
}: {
  label: string;
  images: string[];
  onChange: (next: string[]) => void;
  onError: (message?: string) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  async function onFiles(files: FileList | null) {
    if (!files) return;
    onError(undefined);
    try {
      const room = LIMITS.productUiMax - images.length;
      const added = await Promise.all(Array.from(files).slice(0, room).map(readScreenshot));
      onChange([...images, ...added]);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not add that image.");
    }
    if (input.current) input.current.value = "";
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {images.map((src, i) => (
        <span key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safeImageSrc(src)} alt={`Screenshot ${i + 1}`} className="h-24 w-16 rounded-lg border border-border object-cover" />
          <button
            type="button"
            aria-label={`Remove screenshot ${i + 1}`}
            onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-1 text-background"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {images.length < LIMITS.productUiMax ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-24 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs font-semibold text-accent hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" /> Add
        </button>
      ) : null}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}

/** Logo: each version is a named square mark. */
export function LogoVersions({ form, errors, onVersion, onRemove, canRemove }: EditorProps) {
  const [uploadError, setUploadError] = React.useState<string>();
  async function onFile(i: number, current: LogoValue, file?: File) {
    if (!file) return;
    setUploadError(undefined);
    try {
      onVersion(i, { ...current, src: await readLogo(file) });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not add that logo.");
    }
  }
  return (
    <ul className="space-y-3">
      {form.versions.map((v, i) => {
        const logo: LogoValue = typeof v === "object" && !Array.isArray(v) && "src" in v ? (v as LogoValue) : { name: "", src: "" };
        return (
          <li key={i} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <VariantBadge index={i} className="size-9" />
              <label className="relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border text-xs font-semibold text-accent hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                {safeImageSrc(logo.src) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeImageSrc(logo.src)} alt={logo.name || `Logo ${VARIANT_KEYS[i]}`} className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center">
                    <Plus className="size-4" /> Add
                  </span>
                )}
                <input type="file" accept="image/png" className="sr-only" aria-label={`Upload logo ${VARIANT_KEYS[i]}`} onChange={(e) => onFile(i, logo, e.target.files?.[0])} />
              </label>
              <div className="min-w-0 flex-1">
                <TextInput
                  aria-label={`Logo ${VARIANT_KEYS[i]} name`}
                  placeholder="Sound wave"
                  value={logo.name}
                  maxLength={LIMITS.logoName}
                  onChange={(e) => onVersion(i, { ...logo, name: e.target.value })}
                />
              </div>
              <RemoveButton index={i} onRemove={onRemove} show={canRemove} />
            </div>
            <ErrorText message={errorFor(errors, `cards.${i}`)} />
          </li>
        );
      })}
      <p className="text-sm text-muted-foreground">Square PNG or SVG, at least 256 px. Each card shows its own logo in the icon slot.</p>
      <ErrorText message={uploadError} />
    </ul>
  );
}

const LANGUAGE_LABELS: Record<CardLanguage, string> = { English: "English", Hindi: "हिन्दी · Hindi", Bengali: "বাংলা · Bengali" };

/** Language test: the whole card per language, AI-drafted (stub) and edited by the founder. */
export function LanguageVersions({
  form,
  errors,
  onVersion,
  onRemove,
  canRemove,
  onTranslate,
  translating,
}: EditorProps & { onTranslate: () => void; translating: boolean }) {
  const [openIndex, setOpenIndex] = React.useState<number>(0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="whitespace-nowrap text-sm font-semibold text-accent">AI drafted · check them</p>
        <Button variant="outline" size="sm" onClick={onTranslate} disabled={translating}>
          <Sparkles className="text-accent" /> {translating ? "Translating…" : "Translate with AI"}
        </Button>
      </div>
      <ul className="space-y-3">
        {form.versions.map((v, i) => {
          const lang = v as LanguageValue;
          const open = openIndex === i;
          return (
            <li key={i} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <VariantBadge index={i} className="size-9" />
                <span className="font-bold">{LANGUAGE_LABELS[lang.language]}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  className="text-sm font-semibold text-muted-foreground underline"
                >
                  {open ? "Done" : "Edit"}
                </button>
                <RemoveButton index={i} onRemove={onRemove} show={canRemove && lang.language !== "English"} />
              </div>
              {!open ? <p className="mt-2 text-lg font-bold leading-snug">{lang.headline || <span className="font-normal text-muted-foreground">Not written yet</span>}</p> : null}
              {open ? (
                <div className="mt-3 space-y-3">
                  {(
                    [
                      ["headline", "Headline", LIMITS.headline],
                      ["description", "Description", LIMITS.description],
                      ["reward", "Launch reward", LIMITS.reward],
                      ["question", "Swipe question", LIMITS.question],
                      ["positiveLabel", "Positive answer", LIMITS.label],
                      ["negativeLabel", "Negative answer", LIMITS.label],
                    ] as const
                  ).map(([key, label, max]) => (
                    <div key={key}>
                      <FieldLabel htmlFor={`lang-${i}-${key}`}>{label}</FieldLabel>
                      <TextInput
                        id={`lang-${i}-${key}`}
                        value={lang[key]}
                        maxLength={max}
                        lang={lang.language === "Hindi" ? "hi" : lang.language === "Bengali" ? "bn" : "en"}
                        onChange={(e) => onVersion(i, { ...lang, [key]: e.target.value })}
                      />
                      <ErrorText message={errorFor(errors, `cards.${i}.value.${key}`)} />
                    </div>
                  ))}
                </div>
              ) : null}
              <ErrorText message={errors.find((e) => e.path === `cards.${i}.value` || e.path === `cards.${i}`)?.message} />
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        The whole card is translated: headline, description, reward, question and answers. Price and product UI stay the same.
      </p>
    </div>
  );
}
