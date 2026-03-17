export type UploadedFile = {
  id?: string;        // whiteboard_files DB row ID (present after first message send)
  fileName: string;
  storagePath: string;
  text: string;       // empty string means not yet parsed (file was loaded from DB)
  size: number;
};
