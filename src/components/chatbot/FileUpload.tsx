import { useRef, ChangeEvent } from "react";
import { ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onFileUploaded: (url: string) => void;
  disabled: boolean;
}

export const FileUpload = ({ onFileUploaded, disabled }: FileUploadProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return;

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("chat-files")
      .upload(fileName, file, { contentType: file.type });

    if (error || !data) return;

    const { data: urlData } = supabase.storage
      .from("chat-files")
      .getPublicUrl(data.path);

    onFileUploaded(urlData.publicUrl);

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent/20 disabled:opacity-50 transition-colors"
        aria-label="Upload file"
      >
        <ImagePlus className="w-4 h-4" />
      </button>
    </>
  );
};
