import { prisma } from "@/lib/prisma";

export type MemoryInput = { projectId: string; agentType: string; role: string; content: string; metadata?: unknown };

export async function remember(input: MemoryInput) {
  const content = input.content.trim();
  if (!content) return null;
  return prisma.agentMemory.create({
    data: {
      projectId: input.projectId,
      agentType: input.agentType,
      role: input.role,
      content: content.slice(0, 20000),
      metadata: input.metadata as any,
    },
  });
}

export async function recall(projectId: string, limit = 12) {
  const take = Math.min(Math.max(limit, 1), 30);
  return prisma.agentMemory.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function memoryContext(memories: Array<{ agentType: string; role: string; content: string }>) {
  if (!memories.length) return "No previous project memory is available.";
  return memories.map((m, i) => `[${i + 1}] ${m.agentType}/${m.role}: ${m.content}`).join("\n");
}
