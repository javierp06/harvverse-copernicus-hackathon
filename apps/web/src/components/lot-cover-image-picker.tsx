"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@harvverse-copernicus-hackathon/ui/components/button";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface LotCoverImagePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function LotCoverImagePicker({ value, onChange }: LotCoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Tipo no permitido. Usa JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("La imagen debe pesar máximo 3MB.");
      return;
    }

    setIsLoading(true);
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      toast.error("No se pudo cargar la imagen.");
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {value ? (
        <div className="relative h-56 bg-black/30">
          <img
            src={value}
            alt="Lot cover preview"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-4">
            <Button
              type="button"
              variant="outline"
              className="border-white/25 bg-black/40 text-white hover:bg-white/10"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Cambiar imagen
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              onClick={() => onChange(null)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="flex min-h-44 w-full flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-white/[0.04]"
          onClick={() => inputRef.current?.click()}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ImagePlus className="h-5 w-5 text-primary" />
            )}
          </span>
          <span>
            <span className="block text-sm font-bold text-white">
              Cargar imagen del lote
            </span>
            <span className="mt-1 block text-xs text-white/45">
              JPG, PNG o WebP. Máximo 3MB.
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
