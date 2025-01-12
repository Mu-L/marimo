/* Copyright 2024 Marimo. All rights reserved. */
import { toast } from "@/components/ui/use-toast";
import { sendCreateFileOrFolder } from "@/core/network/requests";
import { FilePath } from "@/utils/paths";
import { DropzoneOptions, useDropzone } from "react-dropzone";
import { refreshRoot } from "./state";

const MAX_SIZE = 1024 * 1024 * 50; // 50MB

export function useFileExplorerUpload(options: DropzoneOptions = {}) {
  return useDropzone({
    multiple: true,
    maxSize: MAX_SIZE,
    onError: (error) => {
      console.error(error);
      toast({
        title: "File upload failed",
        description: error.message,
        variant: "danger",
      });
    },
    onDropRejected: (rejectedFiles) => {
      toast({
        title: "File upload failed",
        description: (
          <div className="flex flex-col gap-1">
            {rejectedFiles.map((file) => (
              <div key={file.file.name}>
                {file.file.name} ({file.errors.map((e) => e.message).join(", ")}
                )
              </div>
            ))}
          </div>
        ),
        variant: "danger",
      });
    },
    onDrop: async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        await sendCreateFileOrFolder({
          path: "" as FilePath, // add to root
          type: "file",
          name: file.name,
          contents: await file.text(),
        }).catch((error) => {
          console.error(error);
          toast({
            title: "File upload failed",
            description: error.message,
            variant: "danger",
          });
        });
      }
      await refreshRoot();
    },
    ...options,
  });
}
