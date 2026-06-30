import { EmailDirection, PrismaClient, UserStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const companyA = await prisma.company.create({
    data: {
      name: `Tenant A ${suffix}`,
      slug: `tenant-a-${suffix}`
    }
  });
  const companyB = await prisma.company.create({
    data: {
      name: `Tenant B ${suffix}`,
      slug: `tenant-b-${suffix}`
    }
  });

  try {
    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          companyId: companyA.id,
          email: `tenant-a-${suffix}@example.com`,
          passwordHash: "test",
          name: "Tenant A User",
          status: UserStatus.ACTIVE
        }
      }),
      prisma.user.create({
        data: {
          companyId: companyB.id,
          email: `tenant-b-${suffix}@example.com`,
          passwordHash: "test",
          name: "Tenant B User",
          status: UserStatus.ACTIVE
        }
      })
    ]);

    const [taskA, taskB] = await Promise.all([
      prisma.task.create({
        data: {
          companyId: companyA.id,
          createdById: userA.id,
          title: "Tenant A Task"
        }
      }),
      prisma.task.create({
        data: {
          companyId: companyB.id,
          createdById: userB.id,
          title: "Tenant B Task"
        }
      })
    ]);

    const [emailA, emailB] = await Promise.all([
      prisma.emailMessage.create({
        data: {
          companyId: companyA.id,
          senderId: userA.id,
          direction: EmailDirection.OUTBOUND,
          subject: "Tenant A Email",
          body: "Tenant A body",
          fromAddress: "tenant-a@example.com",
          toAddresses: ["recipient@example.com"]
        }
      }),
      prisma.emailMessage.create({
        data: {
          companyId: companyB.id,
          senderId: userB.id,
          direction: EmailDirection.OUTBOUND,
          subject: "Tenant B Email",
          body: "Tenant B body",
          fromAddress: "tenant-b@example.com",
          toAddresses: ["recipient@example.com"]
        }
      })
    ]);

    assert.equal(await canFindUser(companyA.id, userA.id), true, "Company A should access its own user");
    assert.equal(await canFindUser(companyA.id, userB.id), false, "Company A must not access Company B users");
    assert.equal(await canFindUser(companyB.id, userA.id), false, "Company B must not access Company A users");

    assert.equal(await canFindTask(companyA.id, taskA.id), true, "Company A should access its own task");
    assert.equal(await canFindTask(companyA.id, taskB.id), false, "Company A must not access Company B tasks");
    assert.equal(await canFindTask(companyB.id, taskA.id), false, "Company B must not access Company A tasks");

    assert.equal(await canFindEmail(companyA.id, emailA.id), true, "Company A should access its own email");
    assert.equal(await canFindEmail(companyA.id, emailB.id), false, "Company A must not access Company B emails");
    assert.equal(await canFindEmail(companyB.id, emailA.id), false, "Company B must not access Company A emails");

    console.log("Tenant isolation assertions passed for users, tasks, and emails.");
  } finally {
    await cleanup(companyA.id, companyB.id);
    await prisma.$disconnect();
  }
}

async function canFindUser(companyId: string, id: string) {
  return Boolean(await prisma.user.findFirst({ where: { companyId, id, deletedAt: null }, select: { id: true } }));
}

async function canFindTask(companyId: string, id: string) {
  return Boolean(await prisma.task.findFirst({ where: { companyId, id, deletedAt: null }, select: { id: true } }));
}

async function canFindEmail(companyId: string, id: string) {
  return Boolean(await prisma.emailMessage.findFirst({ where: { companyId, id, deletedAt: null }, select: { id: true } }));
}

async function cleanup(...companyIds: string[]) {
  await prisma.emailMessage.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.taskAssignee.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.task.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
