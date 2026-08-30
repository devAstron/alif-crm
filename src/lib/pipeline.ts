import { prisma } from "./prisma";
import type { PipelineStage } from "@prisma/client";

/** Default pipeline (bosqichlari bilan, tartiblangan). */
export async function getDefaultPipeline() {
  const pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: {
      stages: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!pipeline) {
    throw new Error("Default pipeline topilmadi. Seed ishga tushirilganmi?");
  }
  return pipeline;
}

/** Slug bo'yicha bosqichni topadi (default pipeline ichida). */
export async function getStageBySlug(slug: string): Promise<PipelineStage> {
  const pipeline = await prisma.pipeline.findFirst({ where: { isDefault: true } });
  if (!pipeline) throw new Error("Default pipeline topilmadi.");
  const stage = await prisma.pipelineStage.findUnique({
    where: { pipelineId_slug: { pipelineId: pipeline.id, slug } },
  });
  if (!stage) throw new Error(`Bosqich topilmadi: ${slug}`);
  return stage;
}
