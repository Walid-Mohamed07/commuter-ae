import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth/session";

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "assets",
  "uploads",
  "documents",
);

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File))
      return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const ext = ALLOWED_TYPES[file.type];
    if (!ext)
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WEBP or PDF." },
        { status: 400 },
      );

    if (file.size > MAX_SIZE)
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 },
      );

    await mkdir(UPLOAD_DIR, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    const relativePath = `/assets/uploads/documents/${filename}`;
    return NextResponse.json({ ok: true, path: relativePath }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
