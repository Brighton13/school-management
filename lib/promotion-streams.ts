import { prisma } from "@/lib/prisma"

type ClassItem = {
  id: string
  name: string
  level: number
}

const defaultStreams = [
  { name: "Primary Stream", min: 1, max: 7, order: 1 },
  { name: "Junior Secondary Stream", min: 8, max: 9, order: 2 },
  { name: "Senior Secondary Stream", min: 10, max: 12, order: 3 },
]

function defaultStreamForClass(cls: ClassItem) {
  return defaultStreams.find((stream) => cls.level >= stream.min && cls.level <= stream.max)
}

export async function ensureDefaultPromotionStreams(classes?: ClassItem[]) {
  const existingLevelCount = await prisma.promotionStreamLevel.count()
  if (existingLevelCount > 0) return

  const allClasses =
    classes ||
    await prisma.class.findMany({
      select: { id: true, name: true, level: true },
      orderBy: { level: "asc" },
    })

  await prisma.$transaction(async (tx) => {
    for (const streamDef of defaultStreams) {
      const stream = await tx.promotionStream.upsert({
        where: { name: streamDef.name },
        update: { displayOrder: streamDef.order, isActive: true },
        create: {
          name: streamDef.name,
          description: `Default ${streamDef.name.toLowerCase()} promotion path`,
          displayOrder: streamDef.order,
          isActive: true,
        },
      })

      const streamClasses = allClasses
        .filter((cls) => cls.level >= streamDef.min && cls.level <= streamDef.max)
        .sort((a, b) => a.level - b.level)

      for (let index = 0; index < streamClasses.length; index++) {
        const cls = streamClasses[index]
        await tx.promotionStreamLevel.upsert({
          where: { streamId_classId: { streamId: stream.id, classId: cls.id } },
          update: {
            sequence: index + 1,
            isGraduationPoint: cls.level === streamDef.max || index === streamClasses.length - 1,
          },
          create: {
            streamId: stream.id,
            classId: cls.id,
            sequence: index + 1,
            isGraduationPoint: cls.level === streamDef.max || index === streamClasses.length - 1,
          },
        })
      }
    }

    const otherClasses = allClasses.filter((cls) => !defaultStreamForClass(cls))
    if (otherClasses.length > 0) {
      const stream = await tx.promotionStream.upsert({
        where: { name: "Other Levels" },
        update: { displayOrder: 99, isActive: true },
        create: {
          name: "Other Levels",
          description: "Promotion path for classes outside the default grade bands",
          displayOrder: 99,
          isActive: true,
        },
      })

      for (let index = 0; index < otherClasses.length; index++) {
        const cls = otherClasses[index]
        await tx.promotionStreamLevel.upsert({
          where: { streamId_classId: { streamId: stream.id, classId: cls.id } },
          update: { sequence: index + 1, isGraduationPoint: index === otherClasses.length - 1 },
          create: {
            streamId: stream.id,
            classId: cls.id,
            sequence: index + 1,
            isGraduationPoint: index === otherClasses.length - 1,
          },
        })
      }
    }
  })
}

export async function getPromotionStreams() {
  await ensureDefaultPromotionStreams()

  return prisma.promotionStream.findMany({
    where: { isActive: true },
    include: {
      levels: {
        include: { class: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  })
}

export async function getPromotionRuleForClass(classId: string) {
  await ensureDefaultPromotionStreams()

  const currentLevel = await prisma.promotionStreamLevel.findFirst({
    where: { classId, stream: { isActive: true } },
    include: {
      stream: true,
      class: true,
    },
  })

  if (!currentLevel) {
    return { currentLevel: null, nextLevel: null, nextClass: null, isGraduationPoint: true }
  }

  if (currentLevel.isGraduationPoint) {
    return { currentLevel, nextLevel: null, nextClass: null, isGraduationPoint: true }
  }

  const nextLevel = await prisma.promotionStreamLevel.findFirst({
    where: {
      streamId: currentLevel.streamId,
      sequence: { gt: currentLevel.sequence },
    },
    include: { class: { include: { sections: true } } },
    orderBy: { sequence: "asc" },
  })

  return {
    currentLevel,
    nextLevel,
    nextClass: nextLevel?.class || null,
    isGraduationPoint: !nextLevel,
  }
}
