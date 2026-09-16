import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SyncFile = { path: string; content: string };
const SAFE_PATH = /^(?!\.)(?!.*\.\.)(?!.*\\)(?!.*(?:^|\/)\.git(?:\/|$))[A-Za-z0-9._@+\-\/]+$/;

async function github(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `GitHub API error ${response.status}`);
  return data;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const repository = typeof body?.repository === "string" ? body.repository.trim() : "";
    const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
    const message = typeof body?.message === "string" && body.message.trim() ? body.message.trim() : "Update from Lumia AI";
    const files: SyncFile[] = Array.isArray(body?.files) ? body.files : [];
    if (!token) return NextResponse.json({ error: "A GitHub token is required. It is used only for this request and is not stored." }, { status: 400 });
    if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) return NextResponse.json({ error: "Repository must be owner/name." }, { status: 400 });
    if (!files.length || files.length > 100) return NextResponse.json({ error: "Provide 1–100 files." }, { status: 400 });
    if (body?.projectId) {
      const project = await prisma.builderProject.findFirst({ where: { id: body.projectId, ownerId: user.id }, select: { id: true } });
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    for (const file of files) {
      if (!file || typeof file.path !== "string" || typeof file.content !== "string" || !SAFE_PATH.test(file.path)) {
        return NextResponse.json({ error: "Invalid file path or content." }, { status: 400 });
      }
    }

    const [owner, repo] = repository.split("/");
    const ref = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`, token);
    const parentSha = ref.object.sha as string;
    const parentCommit = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${parentSha}`, token);
    const blobs: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
    for (const file of files) {
      const blob = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, token, {
        method: "POST",
        body: JSON.stringify({ content: Buffer.from(file.content, "utf8").toString("base64"), encoding: "base64" }),
      });
      blobs.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: blobs }),
    });
    const commit = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
    });
    await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return NextResponse.json({ ok: true, repository, branch, commitSha: commit.sha, url: commit.html_url, files: blobs.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub sync failed." }, { status: 500 });
  }
}
